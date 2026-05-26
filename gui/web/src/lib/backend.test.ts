import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SendError, isWails, sendRequest } from "./backend"

const baseTab = {
  id: "tab-1",
  type: "request" as const,
  method: "GET" as const,
  url: "https://example.com",
  params: [],
  headers: [],
  pathVars: [],
  bodyType: "none" as const,
  bodyRaw: "",
  bodyRawContentType: "JSON" as const,
  bodyFormData: [],
  bodyUrlencoded: [],
  response: null,
  dirty: false,
  activeSubTab: "Params" as const,
  preRequestScript: "",
  testScript: "",
  followRedirects: true,
  followOriginalMethod: false,
  followAuthorizationHeader: false,
  removeRefererOnRedirect: false,
  maxRedirects: 0,
  sslVerification: true,
  encodeUrl: true,
  disableCookieJar: false,
  httpVersion: "http1" as const,
  timeout: 0,
  ignoreProxy: false,
}

describe("isWails", () => {
  it("returns false when window.go is absent", () => {
    expect(isWails()).toBe(false)
  })

  it("returns true when window.go is defined", () => {
    ;(window as Window & { go?: unknown }).go = {}
    expect(isWails()).toBe(true)
    delete (window as Window & { go?: unknown }).go
  })
})

describe("sendRequest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("calls /api/send with correct payload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          statusText: "200 OK",
          time: 42,
          size: 13,
          headers: { "content-type": "application/json" },
          body: '{"ok":true}',
          contentType: "application/json",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const result = await sendRequest(baseTab)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe("/api/send")
    expect((init as RequestInit).method).toBe("POST")

    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.method).toBe("GET")
    expect(body.url).toBe("https://example.com")

    expect(result.status).toBe(200)
    expect(result.body).toBe('{"ok":true}')
  })

  it("wraps fetch network error (agent unreachable) in SendError", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"))

    const err = await sendRequest(baseTab).catch((e) => e)
    expect(err).toBeInstanceOf(SendError)
    expect(err.message).toMatch(/agent unreachable/i)
    expect(err.code).toBe("agent_unreachable")
  })

  it("throws SendError on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "connection refused", code: "network_error" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const err = await sendRequest(baseTab).catch((e) => e)
    expect(err).toBeInstanceOf(SendError)
    expect(err.message).toBe("connection refused")
    expect(err.code).toBe("network_error")
  })

  it("throws SendError with fallback message when error field is absent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const err = await sendRequest(baseTab).catch((e) => e)
    expect(err).toBeInstanceOf(SendError)
    expect(err.message).toBe("Request failed")
    expect(err.code).toBe("network_error")
  })

  it("includes assembled URL with enabled params", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          statusText: "OK",
          time: 1,
          size: 0,
          headers: {},
          body: "",
          contentType: "",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const tab = {
      ...baseTab,
      url: "https://example.com",
      params: [
        { id: "1", key: "q", value: "hello", enabled: true },
        { id: "2", key: "page", value: "2", enabled: false },
      ],
    }

    await sendRequest(tab)

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body.url).toBe("https://example.com?q=hello")
  })

  it("sends all tab settings fields in the payload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          statusText: "OK",
          time: 1,
          size: 0,
          headers: {},
          body: "",
          contentType: "",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const tab = {
      ...baseTab,
      method: "POST" as const,
      followRedirects: false,
      sslVerification: false,
      timeout: 3000,
      ignoreProxy: true,
      headers: [{ id: "h1", key: "X-Foo", value: "bar", enabled: true }],
      bodyType: "raw" as const,
      bodyRaw: '{"x":1}',
      bodyRawContentType: "JSON" as const,
    }

    await sendRequest(tab)

    const payload = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(payload.method).toBe("POST")
    expect(payload.followRedirects).toBe(false)
    expect(payload.sslVerification).toBe(false)
    expect(payload.timeout).toBe(3000)
    expect(payload.ignoreProxy).toBe(true)
    expect(payload.headers).toEqual(tab.headers)
    expect(payload.bodyType).toBe("raw")
    expect(payload.bodyRaw).toBe('{"x":1}')
  })

  it("throws SendError when in Wails context", async () => {
    ;(window as Window & { go?: unknown }).go = {}
    try {
      const err = await sendRequest(baseTab).catch((e) => e)
      expect(err).toBeInstanceOf(SendError)
      expect(err.code).toBe("not_implemented")
    } finally {
      delete (window as Window & { go?: unknown }).go
    }
  })
})
