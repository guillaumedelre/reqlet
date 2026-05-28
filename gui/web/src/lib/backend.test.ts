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

  it("throws BackendError on non-ok response", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "bad", code: "bad_request" }))
    await expect(sendRequest(minimalReq)).rejects.toBeInstanceOf(BackendError)
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
})
