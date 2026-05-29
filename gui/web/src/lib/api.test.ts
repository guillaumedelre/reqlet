import { describe, it, expect, vi, beforeEach } from "vitest"
import { api } from "./api"
import type { Collection, Environment, RunEvent, RunSummary } from "@/types"

const mockFetch = vi.fn()
globalThis.fetch = mockFetch as typeof fetch

function okResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

function errorResponse(body: unknown, status = 404) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

function noContentResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.resolve(null),
  } as Response)
}

beforeEach(() => {
  vi.clearAllMocks()
})

const sampleCollection: Collection = {
  id: "col-1",
  name: "Test",
  description: "",
  items: [],
  variables: [],
  preRequestScript: "",
  testScript: "",
  auth: { type: "none" },
}

const sampleEnvironment: Environment = {
  id: "env-1",
  name: "Dev",
  variables: [],
}

describe("api.collections", () => {
  it("list sends GET /api/collections", async () => {
    mockFetch.mockReturnValue(okResponse([sampleCollection]))
    const result = await api.collections.list()
    expect(mockFetch).toHaveBeenCalledWith("/api/collections", {
      method: "GET",
      headers: undefined,
      body: undefined,
    })
    expect(result).toEqual([sampleCollection])
  })

  it("create sends POST /api/collections with body", async () => {
    mockFetch.mockReturnValue(okResponse(sampleCollection, 201))
    const result = await api.collections.create(sampleCollection)
    expect(mockFetch).toHaveBeenCalledWith("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleCollection),
    })
    expect(result).toEqual(sampleCollection)
  })

  it("get sends GET /api/collections/:id", async () => {
    mockFetch.mockReturnValue(okResponse(sampleCollection))
    const result = await api.collections.get("col-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1", {
      method: "GET",
      headers: undefined,
      body: undefined,
    })
    expect(result).toEqual(sampleCollection)
  })

  it("update sends PUT /api/collections/:id with body", async () => {
    mockFetch.mockReturnValue(okResponse(sampleCollection))
    const result = await api.collections.update("col-1", sampleCollection)
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleCollection),
    })
    expect(result).toEqual(sampleCollection)
  })

  it("delete sends DELETE /api/collections/:id", async () => {
    mockFetch.mockReturnValue(noContentResponse())
    const result = await api.collections.delete("col-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1", {
      method: "DELETE",
      headers: undefined,
      body: undefined,
    })
    expect(result).toBeUndefined()
  })

  it("throws on error response with server error message", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "not found", code: "not_found" }))
    await expect(api.collections.get("nonexistent")).rejects.toThrow("not found")
  })

  it("throws with fallback message when JSON parse fails", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("bad json")),
      } as Response),
    )
    await expect(api.collections.get("x")).rejects.toThrow("Request failed")
  })

  it("throws fallback message when error field is absent from response body", async () => {
    // error field missing → (err as ...).error is undefined → ?? "Request failed" branch
    mockFetch.mockReturnValue(errorResponse({ code: "bad_request" }))
    await expect(api.collections.get("x")).rejects.toThrow("Request failed")
  })
})

describe("api.environments", () => {
  it("list sends GET /api/environments", async () => {
    mockFetch.mockReturnValue(okResponse([sampleEnvironment]))
    const result = await api.environments.list()
    expect(mockFetch).toHaveBeenCalledWith("/api/environments", {
      method: "GET",
      headers: undefined,
      body: undefined,
    })
    expect(result).toEqual([sampleEnvironment])
  })

  it("create sends POST /api/environments with body", async () => {
    mockFetch.mockReturnValue(okResponse(sampleEnvironment, 201))
    const result = await api.environments.create(sampleEnvironment)
    expect(mockFetch).toHaveBeenCalledWith("/api/environments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleEnvironment),
    })
    expect(result).toEqual(sampleEnvironment)
  })

  it("get sends GET /api/environments/:id", async () => {
    mockFetch.mockReturnValue(okResponse(sampleEnvironment))
    await api.environments.get("env-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/environments/env-1", expect.any(Object))
  })

  it("update sends PUT /api/environments/:id", async () => {
    mockFetch.mockReturnValue(okResponse(sampleEnvironment))
    await api.environments.update("env-1", sampleEnvironment)
    expect(mockFetch).toHaveBeenCalledWith("/api/environments/env-1", expect.any(Object))
  })

  it("delete sends DELETE /api/environments/:id", async () => {
    mockFetch.mockReturnValue(noContentResponse())
    await api.environments.delete("env-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/environments/env-1", expect.any(Object))
  })
})

// ---- helpers for run tests ----

const sampleSummary: RunSummary = {
  runId: "run-1",
  collectionId: "col-1",
  startedAt: "2026-01-01T00:00:00Z",
  durationMs: 123,
  total: 2,
  passed: 2,
  failed: 0,
}

interface MockES {
  url: string
  onmessage: ((e: MessageEvent) => void) | null
  onerror: (() => void) | null
  close: ReturnType<typeof vi.fn>
}

// Minimal EventSource mock — regular function so it can be used with `new`.
function makeEventSourceMock() {
  const instances: MockES[] = []

  // Must be a regular function (not arrow) to support `new`
  const MockEventSource = vi.fn(function (this: MockES, url: string) {
    this.url = url
    this.onmessage = null
    this.onerror = null
    this.close = vi.fn()
    instances.push(this)
  })

  return { MockEventSource, instances }
}

describe("api.collections.run", () => {
  it("sends POST /api/collections/:id/run with options", async () => {
    mockFetch.mockReturnValue(okResponse({ runId: "run-abc" }))
    const result = await api.collections.run("col-1", { iterations: 3, bail: true })
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iterations: 3, bail: true }),
    })
    expect(result).toEqual({ runId: "run-abc" })
  })

  it("sends POST with empty body when no options provided", async () => {
    mockFetch.mockReturnValue(okResponse({ runId: "run-def" }))
    await api.collections.run("col-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  })
})

describe("api.runs.get", () => {
  it("sends GET /api/runs/:id and returns summary", async () => {
    mockFetch.mockReturnValue(okResponse(sampleSummary))
    const result = await api.runs.get("run-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/runs/run-1", {
      method: "GET",
      headers: undefined,
      body: undefined,
    })
    expect(result).toEqual(sampleSummary)
  })
})

describe("api.runs.stream", () => {
  it("opens EventSource at /api/runs/:id/stream and delivers events", () => {
    const { MockEventSource, instances } = makeEventSourceMock()
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const onEvent = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    api.runs.stream("run-1", { onEvent, onDone, onError })

    expect(MockEventSource).toHaveBeenCalledWith("/api/runs/run-1/stream")
    const inst = instances[0]

    const reqEvent: RunEvent = { type: "request", name: "req1", passed: true }
    inst.onmessage!({ data: JSON.stringify(reqEvent) } as MessageEvent)
    expect(onEvent).toHaveBeenCalledWith(reqEvent)
    expect(onDone).not.toHaveBeenCalled()
  })

  it("calls onDone and closes EventSource on done event", () => {
    const { MockEventSource, instances } = makeEventSourceMock()
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const onEvent = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    api.runs.stream("run-2", { onEvent, onDone, onError })

    const inst = instances[0]
    const doneEvent: RunEvent = { type: "done", passed: true, summary: sampleSummary }
    inst.onmessage!({ data: JSON.stringify(doneEvent) } as MessageEvent)

    expect(onEvent).toHaveBeenCalledWith(doneEvent)
    expect(onDone).toHaveBeenCalledWith(sampleSummary)
    expect(inst.close).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it("calls onError and closes on connection error before done", () => {
    const { MockEventSource, instances } = makeEventSourceMock()
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const onError = vi.fn()
    api.runs.stream("run-3", { onEvent: vi.fn(), onDone: vi.fn(), onError })

    const inst = instances[0]
    inst.onerror!()

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(inst.close).toHaveBeenCalled()
  })

  it("does not call onError after done event", () => {
    const { MockEventSource, instances } = makeEventSourceMock()
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const onError = vi.fn()
    api.runs.stream("run-4", { onEvent: vi.fn(), onDone: vi.fn(), onError })

    const inst = instances[0]
    // Receive done first, then server closes (triggers onerror in EventSource).
    const doneEvent: RunEvent = { type: "done", passed: true, summary: sampleSummary }
    inst.onmessage!({ data: JSON.stringify(doneEvent) } as MessageEvent)
    inst.onerror!()

    expect(onError).not.toHaveBeenCalled()
  })

  it("returned cleanup function closes the EventSource", () => {
    const { MockEventSource, instances } = makeEventSourceMock()
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const cleanup = api.runs.stream("run-5", { onEvent: vi.fn(), onDone: vi.fn(), onError: vi.fn() })
    cleanup()

    expect(instances[0].close).toHaveBeenCalled()
  })
})
