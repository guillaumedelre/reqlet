import { describe, expect, it } from "vitest"
import { buildFinalUrl, genCurl, genGo, genJS, genPython } from "./code-gen-dialog"
import { DEFAULT_REQUEST } from "@/types"
import type { RequestState } from "@/types"

function req(overrides: Partial<RequestState> = {}): RequestState {
  return { ...DEFAULT_REQUEST, ...overrides }
}

// ---------------------------------------------------------------------------
// buildFinalUrl
// ---------------------------------------------------------------------------

describe("buildFinalUrl", () => {
  it("returns bare URL when no params", () => {
    expect(buildFinalUrl("https://example.com", [])).toBe("https://example.com")
  })

  it("appends enabled params as query string", () => {
    const params = [{ id: "1", enabled: true, key: "a", value: "1", description: "" }]
    expect(buildFinalUrl("https://example.com", params)).toBe("https://example.com?a=1")
  })

  it("skips disabled params", () => {
    const params = [{ id: "1", enabled: false, key: "a", value: "1", description: "" }]
    expect(buildFinalUrl("https://example.com", params)).toBe("https://example.com")
  })

  it("skips params with empty key", () => {
    const params = [{ id: "1", enabled: true, key: "", value: "1", description: "" }]
    expect(buildFinalUrl("https://example.com", params)).toBe("https://example.com")
  })

  it("strips existing query string before appending params", () => {
    const params = [{ id: "1", enabled: true, key: "b", value: "2", description: "" }]
    expect(buildFinalUrl("https://example.com?old=x", params)).toBe("https://example.com?b=2")
  })

  it("joins multiple params with &", () => {
    const params = [
      { id: "1", enabled: true, key: "a", value: "1", description: "" },
      { id: "2", enabled: true, key: "b", value: "2", description: "" },
    ]
    expect(buildFinalUrl("https://example.com", params)).toBe("https://example.com?a=1&b=2")
  })
})

// ---------------------------------------------------------------------------
// genCurl
// ---------------------------------------------------------------------------

describe("genCurl", () => {
  it("generates minimal GET request", () => {
    const out = genCurl(req({ url: "https://api.example.com" }))
    expect(out).toBe("curl -X GET 'https://api.example.com'")
  })

  it("includes enabled headers", () => {
    const out = genCurl(
      req({
        url: "https://api.example.com",
        headers: [{ id: "1", enabled: true, key: "X-Foo", value: "bar", description: "" }],
      }),
    )
    expect(out).toContain("-H 'X-Foo: bar'")
  })

  it("skips disabled headers", () => {
    const out = genCurl(
      req({
        url: "https://api.example.com",
        headers: [{ id: "1", enabled: false, key: "X-Foo", value: "bar", description: "" }],
      }),
    )
    expect(out).not.toContain("X-Foo")
  })

  it("appends bearer token as Authorization header", () => {
    const out = genCurl(
      req({ url: "https://api.example.com", auth: { type: "bearer", bearer: { token: "tok" } } }),
    )
    expect(out).toContain("-H 'Authorization: Bearer tok'")
  })

  it("appends basic auth as Authorization header", () => {
    const out = genCurl(
      req({
        url: "https://api.example.com",
        auth: { type: "basic", basic: { username: "user", password: "pass" } },
      }),
    )
    expect(out).toContain("-H 'Authorization: Basic")
  })

  it("includes raw body and Content-Type", () => {
    const out = genCurl(
      req({
        url: "https://api.example.com",
        body: {
          ...DEFAULT_REQUEST.body,
          type: "raw",
          raw: '{"x":1}',
          rawContentType: "application/json",
        },
      }),
    )
    expect(out).toContain("-H 'Content-Type: application/json'")
    expect(out).toContain("-d '")
  })

  it("escapes single quotes in body", () => {
    const out = genCurl(
      req({
        url: "https://api.example.com",
        body: { ...DEFAULT_REQUEST.body, type: "raw", raw: "it's fine" },
      }),
    )
    expect(out).toContain("it'\\''s fine")
  })

  it("appends query params from params array", () => {
    const out = genCurl(
      req({
        url: "https://api.example.com",
        params: [{ id: "1", enabled: true, key: "q", value: "hello", description: "" }],
      }),
    )
    expect(out).toContain("?q=hello")
  })
})

// ---------------------------------------------------------------------------
// genPython
// ---------------------------------------------------------------------------

describe("genPython", () => {
  it("generates requests import and url variable", () => {
    const out = genPython(req({ url: "https://api.example.com" }))
    expect(out).toContain("import requests")
    expect(out).toContain('url = "https://api.example.com"')
  })

  it("includes method as requests.<method>", () => {
    const out = genPython(req({ url: "https://api.example.com", method: "POST" }))
    expect(out).toContain("requests.post(")
  })

  it("includes headers dict when headers are present", () => {
    const out = genPython(
      req({
        url: "https://api.example.com",
        headers: [
          { id: "1", enabled: true, key: "Accept", value: "application/json", description: "" },
        ],
      }),
    )
    expect(out).toContain('"Accept": "application/json"')
  })

  it("outputs empty headers dict when no headers", () => {
    const out = genPython(req({ url: "https://api.example.com" }))
    expect(out).toContain("headers = {}")
  })

  it("includes data= when body is set", () => {
    const out = genPython(
      req({
        url: "https://api.example.com",
        body: { ...DEFAULT_REQUEST.body, type: "raw", raw: '{"k":"v"}' },
      }),
    )
    expect(out).toContain("data=data")
  })
})

// ---------------------------------------------------------------------------
// genJS
// ---------------------------------------------------------------------------

describe("genJS", () => {
  it("generates fetch call with method", () => {
    const out = genJS(req({ url: "https://api.example.com", method: "DELETE" }))
    expect(out).toContain("await fetch('https://api.example.com'")
    expect(out).toContain("method: 'DELETE'")
  })

  it("includes headers object when headers present", () => {
    const out = genJS(
      req({
        url: "https://api.example.com",
        headers: [{ id: "1", enabled: true, key: "X-Key", value: "val", description: "" }],
      }),
    )
    expect(out).toContain("'X-Key': 'val'")
  })

  it("includes body when raw body is set", () => {
    const out = genJS(
      req({
        url: "https://api.example.com",
        body: { ...DEFAULT_REQUEST.body, type: "raw", raw: "payload" },
      }),
    )
    expect(out).toContain("body:")
  })

  it("prints response as text", () => {
    const out = genJS(req({ url: "https://api.example.com" }))
    expect(out).toContain("response.text()")
  })
})

// ---------------------------------------------------------------------------
// genGo
// ---------------------------------------------------------------------------

describe("genGo", () => {
  it("generates valid Go package main with http.NewRequest", () => {
    const out = genGo(req({ url: "https://api.example.com" }))
    expect(out).toContain("package main")
    expect(out).toContain("http.NewRequest")
    expect(out).toContain('"https://api.example.com"')
  })

  it("imports strings and uses strings.NewReader when body is set", () => {
    const out = genGo(
      req({
        url: "https://api.example.com",
        body: { ...DEFAULT_REQUEST.body, type: "raw", raw: '{"key":"value"}' },
      }),
    )
    expect(out).toContain('"strings"')
    expect(out).toContain("strings.NewReader")
  })

  it("passes nil body when no body", () => {
    const out = genGo(req({ url: "https://api.example.com" }))
    expect(out).toContain("nil")
    expect(out).not.toContain('"strings"')
  })

  it("sets headers via req.Header.Set", () => {
    const out = genGo(
      req({
        url: "https://api.example.com",
        headers: [
          { id: "1", enabled: true, key: "Authorization", value: "Bearer x", description: "" },
        ],
      }),
    )
    expect(out).toContain('req.Header.Set("Authorization", "Bearer x")')
  })

  it("prints response body to stdout", () => {
    const out = genGo(req({ url: "https://api.example.com" }))
    expect(out).toContain("fmt.Println")
  })
})
