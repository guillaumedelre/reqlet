import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it, expect } from "@jest/globals"

const RUNNER = resolve(dirname(fileURLToPath(import.meta.url)), "../index.js")

function spawnRunner() {
  return spawn(process.execPath, [RUNNER], { stdio: ["pipe", "pipe", "pipe"] })
}

function send(proc, msg) {
  proc.stdin.write(JSON.stringify(msg) + "\n")
}

function createLineReader(proc) {
  let buffer = ""
  const queue = []
  const waiters = []

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split("\n")
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      const parsed = JSON.parse(line)
      if (waiters.length > 0) {
        waiters.shift()(parsed)
      } else {
        queue.push(parsed)
      }
    }
  })

  return function readLine() {
    return new Promise((resolve) => {
      if (queue.length > 0) {
        resolve(queue.shift())
      } else {
        waiters.push(resolve)
      }
    })
  }
}

function waitClose(proc) {
  return new Promise((resolve) => proc.on("close", (code) => resolve(code)))
}

const BASE_CONTEXT = {
  globals: {},
  environment: {},
  collectionVariables: {},
  iterationData: {},
  request: { url: "https://api.example.com", method: "GET", headers: {}, body: "" },
  response: {
    status: "OK",
    code: 200,
    responseTime: 42,
    responseSize: 11,
    headers: { "content-type": "application/json" },
    body: '{"ok":true}',
  },
  info: { eventName: "test", iteration: 0, iterationCount: 1, requestName: "req1", requestId: "id-1" },
}

describe("R1 — complete execute cycle via subprocess", () => {
  it("executes a pm.test script and returns result", async () => {
    const proc = spawnRunner()
    const readLine = createLineReader(proc)
    let stderrOutput = ""
    proc.stderr.on("data", (d) => { stderrOutput += d.toString() })

    send(proc, {
      id: "1",
      method: "execute",
      params: {
        script: "pm.test('ok', () => pm.expect(pm.response.code).to.equal(200))",
        event: "test",
        context: BASE_CONTEXT,
      },
    })

    const res = await readLine()

    expect(res.id).toBe("1")
    expect(res.error).toBeNull()
    expect(res.result.tests).toHaveLength(1)
    expect(res.result.tests[0]).toMatchObject({ name: "ok", passed: true })
    expect(res.result.mutations).toBeDefined()
    expect(res.result.visualizerHtml).toBeNull()

    proc.stdin.end()
    expect(await waitClose(proc)).toBe(0)
    expect(stderrOutput).toBe("")
  })
})

describe("R2 — 10 sequential messages, verify response order", () => {
  it("handles 10 messages without mixing IDs", async () => {
    const proc = spawnRunner()
    const readLine = createLineReader(proc)

    for (let i = 0; i < 10; i++) {
      const script =
        i % 2 === 0
          ? "pm.test('t', () => pm.expect(pm.response.code).to.equal(200))"
          : `pm.environment.set('k', '${i}')`
      send(proc, {
        id: `req-${i}`,
        method: "execute",
        params: { script, event: "test", context: BASE_CONTEXT },
      })
    }

    const responses = []
    for (let i = 0; i < 10; i++) {
      responses.push(await readLine())
    }

    const ids = new Set(responses.map((r) => r.id))
    expect(ids.size).toBe(10)
    for (let i = 0; i < 10; i++) {
      expect(ids.has(`req-${i}`)).toBe(true)
    }

    const byId = Object.fromEntries(responses.map((r) => [r.id, r]))
    for (let i = 0; i < 10; i++) {
      const r = byId[`req-${i}`]
      if (i % 2 === 0) {
        expect(r.result.tests[0].passed).toBe(true)
      } else {
        expect(r.result.mutations.environment.k).toBe(String(i))
      }
    }

    proc.stdin.end()
    expect(await waitClose(proc)).toBe(0)
  })
})

describe("R3 — throw new Error → failed test, no crash", () => {
  it("captures script error as failed test and keeps process alive", async () => {
    const proc = spawnRunner()
    const readLine = createLineReader(proc)

    send(proc, {
      id: "err",
      method: "execute",
      params: { script: "throw new Error('intentional')", event: "test", context: BASE_CONTEXT },
    })

    const res = await readLine()
    expect(res.error).toBeNull()
    expect(res.result.tests).toHaveLength(1)
    expect(res.result.tests[0].passed).toBe(false)
    expect(res.result.tests[0].error).toMatch(/intentional/)

    send(proc, {
      id: "ok",
      method: "execute",
      params: {
        script: "pm.test('alive', () => pm.expect(pm.response.code).to.equal(200))",
        event: "test",
        context: BASE_CONTEXT,
      },
    })
    const res2 = await readLine()
    expect(res2.id).toBe("ok")
    expect(res2.result.tests[0].passed).toBe(true)

    proc.stdin.end()
    expect(await waitClose(proc)).toBe(0)
  })
})

describe("R4 — fragmented JSON message", () => {
  it("reassembles a message split across two stdin writes", async () => {
    const proc = spawnRunner()
    const readLine = createLineReader(proc)
    let stderrOutput = ""
    proc.stderr.on("data", (d) => { stderrOutput += d.toString() })

    const msg = JSON.stringify({
      id: "frag",
      method: "execute",
      params: { script: "pm.test('x', () => true)", event: "test", context: BASE_CONTEXT },
    })
    const half = Math.floor(msg.length / 2)

    proc.stdin.write(msg.slice(0, half))
    await new Promise((r) => setTimeout(r, 20))
    proc.stdin.write(msg.slice(half) + "\n")

    const res = await readLine()
    expect(res.id).toBe("frag")
    expect(res.result.tests[0].passed).toBe(true)
    expect(stderrOutput).toBe("")

    proc.stdin.end()
    expect(await waitClose(proc)).toBe(0)
  })
})

describe("R5 — unknown method → clean error response", () => {
  it("returns error for unknown method without crashing", async () => {
    const proc = spawnRunner()
    const readLine = createLineReader(proc)

    send(proc, { id: "bad", method: "unknown", params: {} })

    const res = await readLine()
    expect(res.id).toBe("bad")
    expect(res.error).toMatch(/unknown method/)
    expect(res.result).toBeNull()

    send(proc, {
      id: "after",
      method: "execute",
      params: {
        script: "pm.test('still ok', () => true)",
        event: "test",
        context: BASE_CONTEXT,
      },
    })
    const res2 = await readLine()
    expect(res2.id).toBe("after")
    expect(res2.result.tests[0].passed).toBe(true)

    proc.stdin.end()
    expect(await waitClose(proc)).toBe(0)
  })
})

describe("R6 — pm.sendRequest makes real HTTP call", () => {
  it("calls a local server and verifies the response in pm.test", async () => {
    let port
    const ready = new Promise((resolve) => {
      const httpServer = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ pong: true }))
      })
      httpServer.listen(0, "127.0.0.1", () => {
        port = httpServer.address().port
        resolve(httpServer)
      })
    })
    const httpServer = await ready

    const proc = spawnRunner()
    const readLine = createLineReader(proc)

    // Wrap pm.sendRequest in a Promise so the async IIFE awaits the callback.
    send(proc, {
      id: "ping",
      method: "execute",
      params: {
        script: `
          await new Promise((done) => {
            pm.sendRequest("http://127.0.0.1:${port}/ping", (err, res) => {
              pm.test("pong", () => {
                pm.expect(err).to.be.null
                pm.expect(res.code).to.equal(200)
                pm.expect(res.json().pong).to.be.true
              })
              done()
            })
          })
        `,
        event: "test",
        context: BASE_CONTEXT,
      },
    })

    const res = await readLine()
    expect(res.error).toBeNull()
    expect(res.result.tests).toHaveLength(1)
    expect(res.result.tests[0].name).toBe("pong")
    expect(res.result.tests[0].passed).toBe(true)

    proc.stdin.end()
    await waitClose(proc)
    await new Promise((r) => httpServer.close(r))
  }, 10000)
})

describe("R7 — stdin close → exit code 0", () => {
  it("exits cleanly when stdin is closed", async () => {
    const proc = spawnRunner()
    const readLine = createLineReader(proc)
    let stderrOutput = ""
    proc.stderr.on("data", (d) => { stderrOutput += d.toString() })

    send(proc, {
      id: "pre",
      method: "execute",
      params: { script: "pm.test('ok', () => true)", event: "test", context: BASE_CONTEXT },
    })
    await readLine()

    proc.stdin.end()
    const code = await Promise.race([
      waitClose(proc),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout: process did not exit")), 1000)),
    ])
    expect(code).toBe(0)
    expect(stderrOutput).toBe("")
  })
})
