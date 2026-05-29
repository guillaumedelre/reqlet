import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  sendRequest,
  cancelRequest,
  runScript,
  listHistory,
  deleteHistoryEntry,
  clearHistory,
  getVariables,
  getSettings,
  putSettings,
  BackendError,
} from "./backend"
import type { SendRequest } from "./backend"

const mockFetch = vi.fn()
globalThis.fetch = mockFetch as typeof fetch

function okResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response)
}

function errorResponse(body: unknown, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

beforeEach(() => {
  vi.clearAllMocks()
  delete (window as Window & { go?: unknown }).go
})

const minimalReq: SendRequest = {
  method: "GET",
  url: "http://example.com",
  headers: [],
  bodyType: "none",
  bodyRaw: "",
  bodyRawContentType: "application/json",
  bodyFormData: [],
  bodyUrlencoded: [],
  followRedirects: true,
  sslVerification: true,
  timeout: 0,
  ignoreProxy: false,
}

describe("sendRequest", () => {
  it("POSTs to /api/send and returns the response", async () => {
    const resp = {
      status: 200,
      statusText: "OK",
      time: 42,
      size: 0,
      headers: {},
      body: "",
      contentType: "",
    }
    mockFetch.mockReturnValue(okResponse(resp))
    const result = await sendRequest(minimalReq)
    expect(mockFetch).toHaveBeenCalledWith("/api/send", expect.objectContaining({ method: "POST" }))
    expect(result.status).toBe(200)
  })

  it("includes visualizerHtml when present in response", async () => {
    mockFetch.mockReturnValue(
      okResponse({
        status: 200,
        statusText: "OK",
        time: 10,
        size: 0,
        headers: {},
        body: "",
        contentType: "",
        visualizerHtml: "<h1>Hello</h1>",
      }),
    )
    const result = await sendRequest(minimalReq)
    expect(result.visualizerHtml).toBe("<h1>Hello</h1>")
  })

  it("throws BackendError on non-ok response", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "bad", code: "bad_request" }))
    await expect(sendRequest(minimalReq)).rejects.toBeInstanceOf(BackendError)
  })

  it("uses fallback code and message when error fields are missing", async () => {
    mockFetch.mockReturnValue(errorResponse({}))
    await expect(sendRequest(minimalReq)).rejects.toMatchObject({
      code: "request_failed",
      message: "Request failed",
    })
  })
})

describe("cancelRequest", () => {
  it("sends DELETE to /api/send/:id", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({ ok: true, status: 204, json: vi.fn() } as unknown as Response),
    )
    await cancelRequest("req-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/send/req-1", { method: "DELETE" })
  })

  it("does not throw on 404", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: vi.fn() } as unknown as Response),
    )
    await expect(cancelRequest("req-1")).resolves.toBeUndefined()
  })

  it("throws BackendError on unexpected error", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "server error", code: "internal_error" }, 500))
    await expect(cancelRequest("req-1")).rejects.toBeInstanceOf(BackendError)
  })

  it("uses fallback code and message when error fields are missing", async () => {
    mockFetch.mockReturnValue(errorResponse({}, 500))
    await expect(cancelRequest("req-1")).rejects.toMatchObject({
      code: "cancel_failed",
      message: "Cancel failed",
    })
  })
})

describe("runScript", () => {
  it("POSTs to /api/sandbox/run", async () => {
    mockFetch.mockReturnValue(okResponse({ tests: [], mutations: null }))
    const result = await runScript({ script: "pm.test('x', () => {})" })
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sandbox/run",
      expect.objectContaining({ method: "POST" }),
    )
    expect(result.tests).toEqual([])
  })

  it("throws BackendError on non-ok response", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "fail", code: "sandbox_failed" }))
    await expect(runScript({ script: "" })).rejects.toBeInstanceOf(BackendError)
  })

  it("uses fallback code and message when error fields are missing", async () => {
    mockFetch.mockReturnValue(errorResponse({}))
    await expect(runScript({ script: "" })).rejects.toMatchObject({
      code: "sandbox_failed",
      message: "Script execution failed",
    })
  })
})

describe("listHistory", () => {
  it("GETs /api/history with default params", async () => {
    mockFetch.mockReturnValue(okResponse([]))
    const result = await listHistory()
    expect(mockFetch).toHaveBeenCalledWith("/api/history?limit=50&offset=0")
    expect(result).toEqual([])
  })

  it("passes custom limit and offset", async () => {
    mockFetch.mockReturnValue(okResponse([]))
    await listHistory(10, 20)
    expect(mockFetch).toHaveBeenCalledWith("/api/history?limit=10&offset=20")
  })

  it("throws BackendError on non-ok response", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "fail", code: "internal_error" }))
    await expect(listHistory()).rejects.toBeInstanceOf(BackendError)
  })

  it("uses fallback code and message when error fields are missing", async () => {
    mockFetch.mockReturnValue(errorResponse({}))
    await expect(listHistory()).rejects.toMatchObject({
      code: "request_failed",
      message: "Request failed",
    })
  })
})

describe("deleteHistoryEntry", () => {
  it("sends DELETE to /api/history/:id", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({ ok: true, status: 204, json: vi.fn() } as unknown as Response),
    )
    await deleteHistoryEntry("entry-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/history/entry-1", { method: "DELETE" })
  })
})

describe("clearHistory", () => {
  it("sends DELETE to /api/history", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({ ok: true, status: 204, json: vi.fn() } as unknown as Response),
    )
    await clearHistory()
    expect(mockFetch).toHaveBeenCalledWith("/api/history", { method: "DELETE" })
  })
})

describe("getVariables", () => {
  const vars = { globals: [], environment: [], collection: [] }

  it("calls /api/variables with no params", async () => {
    mockFetch.mockReturnValue(okResponse(vars))
    const result = await getVariables()
    expect(mockFetch).toHaveBeenCalledWith("/api/variables")
    expect(result.globals).toEqual([])
  })

  it("appends collectionId query param", async () => {
    mockFetch.mockReturnValue(okResponse(vars))
    await getVariables("col-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/variables?collectionId=col-1")
  })

  it("appends environmentId query param", async () => {
    mockFetch.mockReturnValue(okResponse(vars))
    await getVariables(undefined, "env-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/variables?environmentId=env-1")
  })

  it("appends both query params", async () => {
    mockFetch.mockReturnValue(okResponse(vars))
    await getVariables("col-1", "env-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/variables?collectionId=col-1&environmentId=env-1")
  })

  it("throws BackendError on non-ok response", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "fail", code: "request_failed" }))
    await expect(getVariables()).rejects.toBeInstanceOf(BackendError)
  })

  it("uses fallback code and message when error fields are missing", async () => {
    mockFetch.mockReturnValue(errorResponse({}))
    await expect(getVariables()).rejects.toMatchObject({
      code: "request_failed",
      message: "Request failed",
    })
  })
})

describe("getSettings", () => {
  const defaults = {
    proxyUrl: "",
    proxyUsername: "",
    proxyPassword: "",
    noProxy: "",
    sslVerification: true,
  }

  it("GETs /api/settings", async () => {
    mockFetch.mockReturnValue(okResponse(defaults))
    const result = await getSettings()
    expect(mockFetch).toHaveBeenCalledWith("/api/settings")
    expect(result.sslVerification).toBe(true)
  })

  it("throws BackendError on non-ok response", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "fail", code: "internal_error" }))
    await expect(getSettings()).rejects.toBeInstanceOf(BackendError)
  })

  it("uses fallback code and message when error fields are missing", async () => {
    mockFetch.mockReturnValue(errorResponse({}))
    await expect(getSettings()).rejects.toMatchObject({
      code: "request_failed",
      message: "Request failed",
    })
  })
})

describe("putSettings", () => {
  const updated = {
    proxyUrl: "http://proxy:3128",
    proxyUsername: "",
    proxyPassword: "",
    noProxy: "",
    sslVerification: true,
  }

  it("PUTs to /api/settings with partial body", async () => {
    mockFetch.mockReturnValue(okResponse(updated))
    const result = await putSettings({ proxyUrl: "http://proxy:3128" })
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({ method: "PUT" }),
    )
    expect(result.proxyUrl).toBe("http://proxy:3128")
  })

  it("throws BackendError on non-ok response", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "fail", code: "internal_error" }))
    await expect(putSettings({ sslVerification: false })).rejects.toBeInstanceOf(BackendError)
  })

  it("uses fallback code and message when error fields are missing", async () => {
    mockFetch.mockReturnValue(errorResponse({}))
    await expect(putSettings({})).rejects.toMatchObject({
      code: "request_failed",
      message: "Request failed",
    })
  })
})

describe("sendRequest — new optional fields", () => {
  const emptyResp = {
    status: 200,
    statusText: "OK",
    time: 0,
    size: 0,
    headers: {},
    body: "",
    contentType: "",
  }

  function parsedBody(callIndex = 0): Record<string, unknown> {
    return JSON.parse(mockFetch.mock.calls[callIndex][1].body as string) as Record<string, unknown>
  }

  beforeEach(() => {
    mockFetch.mockReturnValue(okResponse(emptyResp))
  })

  it("serializes bodyBinaryContent and bodyBinaryName when provided", async () => {
    await sendRequest({ ...minimalReq, bodyBinaryContent: "aGVsbG8=", bodyBinaryName: "file.bin" })
    const body = parsedBody()
    expect(body.bodyBinaryContent).toBe("aGVsbG8=")
    expect(body.bodyBinaryName).toBe("file.bin")
  })

  it("serializes httpVersion when provided", async () => {
    await sendRequest({ ...minimalReq, httpVersion: "http1" })
    const body = parsedBody()
    expect(body.httpVersion).toBe("http1")
  })

  it("serializes redirect flags when provided", async () => {
    await sendRequest({
      ...minimalReq,
      maxRedirects: 5,
      followOriginalMethod: true,
      followAuthHeader: false,
      removeReferer: true,
    })
    const body = parsedBody()
    expect(body.maxRedirects).toBe(5)
    expect(body.followOriginalMethod).toBe(true)
    expect(body.followAuthHeader).toBe(false)
    expect(body.removeReferer).toBe(true)
  })

  it("serializes per-request proxy fields when provided", async () => {
    await sendRequest({
      ...minimalReq,
      requestProxyUrl: "http://proxy:8080",
      requestProxyUsername: "user",
      requestProxyPassword: "pass",
    })
    const body = parsedBody()
    expect(body.requestProxyUrl).toBe("http://proxy:8080")
    expect(body.requestProxyUsername).toBe("user")
    expect(body.requestProxyPassword).toBe("pass")
  })

  it("omits undefined optional fields from the payload", async () => {
    await sendRequest(minimalReq)
    const body = parsedBody()
    expect(body.bodyBinaryContent).toBeUndefined()
    expect(body.bodyBinaryName).toBeUndefined()
    expect(body.httpVersion).toBeUndefined()
    expect(body.maxRedirects).toBeUndefined()
    expect(body.followOriginalMethod).toBeUndefined()
    expect(body.followAuthHeader).toBeUndefined()
    expect(body.removeReferer).toBeUndefined()
    expect(body.requestProxyUrl).toBeUndefined()
    expect(body.requestProxyUsername).toBeUndefined()
    expect(body.requestProxyPassword).toBeUndefined()
  })
})

// ── Wails context — not_implemented branches ───────────────────────────────

describe("Wails context — not_implemented branches", () => {
  beforeEach(() => {
    ;(window as Window & { go?: unknown }).go = {}
  })
  afterEach(() => {
    delete (window as Window & { go?: unknown }).go
  })

  it("runScript throws BackendError not_implemented", async () => {
    await expect(runScript({ script: "" })).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("getVariables throws BackendError not_implemented", async () => {
    await expect(getVariables()).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("getSettings throws BackendError not_implemented", async () => {
    await expect(getSettings()).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("putSettings throws BackendError not_implemented", async () => {
    await expect(putSettings({})).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("listHistory throws BackendError not_implemented", async () => {
    await expect(listHistory()).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("deleteHistoryEntry throws BackendError not_implemented", async () => {
    await expect(deleteHistoryEntry("e-1")).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("clearHistory throws BackendError not_implemented", async () => {
    await expect(clearHistory()).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("cancelRequest throws BackendError not_implemented", async () => {
    await expect(cancelRequest("req-1")).rejects.toMatchObject({ code: "not_implemented" })
  })

  it("sendRequest throws BackendError not_implemented", async () => {
    await expect(sendRequest(minimalReq)).rejects.toMatchObject({ code: "not_implemented" })
  })
})
