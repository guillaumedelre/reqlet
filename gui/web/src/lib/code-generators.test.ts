import { describe, expect, it } from "vitest"
import type { Tab } from "@/store/tabs"
import { generateCurl, generateGo, generateJavaScript, generatePython } from "./code-generators"

function makeTab(patch: Partial<Tab> = {}): Tab {
  return {
    id: "test",
    type: "request",
    method: "GET",
    url: "https://api.example.com/users",
    params: [],
    headers: [],
    pathVars: [],
    bodyType: "none",
    bodyRaw: "",
    bodyRawContentType: "JSON",
    bodyFormData: [],
    bodyUrlencoded: [],
    response: null,
    dirty: false,
    activeSubTab: "Params",
    followRedirects: true,
    followOriginalMethod: false,
    followAuthorizationHeader: false,
    removeRefererOnRedirect: false,
    maxRedirects: 0,
    sslVerification: true,
    encodeUrl: true,
    disableCookieJar: false,
    httpVersion: "http1",
    timeout: 0,
    ignoreProxy: false,
    preRequestScript: "",
    testScript: "",
    ...patch,
  }
}

function kv(key: string, value: string, enabled = true) {
  return { id: "x", key, value, enabled }
}

describe("generateCurl", () => {
  it("generates a simple GET", () => {
    const code = generateCurl(makeTab())
    expect(code).toBe("curl -X GET 'https://api.example.com/users'")
  })

  it("appends query params to the URL", () => {
    const tab = makeTab({ params: [kv("page", "2"), kv("limit", "10")] })
    expect(generateCurl(tab)).toContain("?page=2&limit=10")
  })

  it("skips disabled params", () => {
    const tab = makeTab({ params: [kv("page", "2", false)] })
    expect(generateCurl(tab)).not.toContain("page")
  })

  it("adds headers", () => {
    const tab = makeTab({ headers: [kv("Authorization", "Bearer tok")] })
    const code = generateCurl(tab)
    expect(code).toContain("-H 'Authorization: Bearer tok'")
  })

  it("adds raw body", () => {
    const tab = makeTab({
      method: "POST",
      bodyType: "raw",
      bodyRaw: '{"name":"Alice"}',
    })
    expect(generateCurl(tab)).toContain('--data \'{"name":"Alice"}\'')
  })

  it("adds urlencoded body", () => {
    const tab = makeTab({
      method: "POST",
      bodyType: "urlencoded",
      bodyUrlencoded: [kv("name", "Alice"), kv("age", "30")],
    })
    const code = generateCurl(tab)
    expect(code).toContain("--data 'name=Alice&age=30'")
  })

  it("adds form-data fields with -F", () => {
    const tab = makeTab({
      method: "POST",
      bodyType: "form-data",
      bodyFormData: [kv("field", "value")],
    })
    expect(generateCurl(tab)).toContain("-F 'field=value'")
  })

  it("escapes single quotes in URL", () => {
    const tab = makeTab({ url: "https://api.example.com/it's" })
    expect(generateCurl(tab)).toContain("'https://api.example.com/it'\\''s'")
  })

  it("skips disabled headers", () => {
    const tab = makeTab({ headers: [kv("X-Skip", "yes", false)] })
    expect(generateCurl(tab)).not.toContain("X-Skip")
  })
})

describe("generatePython", () => {
  it("generates a simple GET", () => {
    const code = generatePython(makeTab())
    expect(code).toContain("import requests")
    expect(code).toContain('url = "https://api.example.com/users"')
    expect(code).toContain("response = requests.get(url)")
  })

  it("passes params dict when query params are present", () => {
    const tab = makeTab({ params: [kv("page", "2")] })
    const code = generatePython(tab)
    expect(code).toContain('"page": "2"')
    expect(code).toContain("params=params")
  })

  it("passes headers dict when headers are present", () => {
    const tab = makeTab({ headers: [kv("Authorization", "Bearer tok")] })
    const code = generatePython(tab)
    expect(code).toContain('"Authorization": "Bearer tok"')
    expect(code).toContain("headers=headers")
  })

  it("passes data for raw body", () => {
    const tab = makeTab({ method: "POST", bodyType: "raw", bodyRaw: '{"x":1}' })
    const code = generatePython(tab)
    expect(code).toContain('data = "{\\"x\\":1}"')
    expect(code).toContain("data=data")
  })

  it("passes files dict for form-data", () => {
    const tab = makeTab({
      method: "POST",
      bodyType: "form-data",
      bodyFormData: [kv("file", "hello")],
    })
    const code = generatePython(tab)
    expect(code).toContain("files=files")
    expect(code).toContain('"file": (None, "hello")')
  })
})

describe("generateJavaScript", () => {
  it("generates a simple GET", () => {
    const code = generateJavaScript(makeTab())
    expect(code).toContain('await fetch("https://api.example.com/users"')
    expect(code).toContain('method: "GET"')
  })

  it("includes headers", () => {
    const tab = makeTab({ headers: [kv("X-Token", "abc")] })
    const code = generateJavaScript(tab)
    expect(code).toContain('"X-Token": "abc"')
  })

  it("includes body for POST raw", () => {
    const tab = makeTab({ method: "POST", bodyType: "raw", bodyRaw: "hello" })
    const code = generateJavaScript(tab)
    expect(code).toContain('body: "hello"')
  })

  it("uses FormData for form-data body", () => {
    const tab = makeTab({
      method: "POST",
      bodyType: "form-data",
      bodyFormData: [kv("k", "v")],
    })
    const code = generateJavaScript(tab)
    expect(code).toContain("new FormData()")
    expect(code).toContain('formData.append("k", "v")')
    expect(code).toContain("body: formData")
  })
})

describe("generateGo", () => {
  it("generates a simple GET", () => {
    const code = generateGo(makeTab())
    expect(code).toContain("package main")
    expect(code).toContain('http.NewRequest("GET", "https://api.example.com/users", nil)')
    expect(code).toContain("client.Do(req)")
  })

  it("includes headers", () => {
    const tab = makeTab({ headers: [kv("Authorization", "Bearer tok")] })
    expect(generateGo(tab)).toContain('req.Header.Set("Authorization", "Bearer tok")')
  })

  it("uses strings.NewReader for raw body", () => {
    const tab = makeTab({ method: "POST", bodyType: "raw", bodyRaw: "data" })
    const code = generateGo(tab)
    expect(code).toContain('strings.NewReader("data")')
    expect(code).toContain('"strings"')
  })

  it("uses multipart writer for form-data", () => {
    const tab = makeTab({
      method: "POST",
      bodyType: "form-data",
      bodyFormData: [kv("field", "val")],
    })
    const code = generateGo(tab)
    expect(code).toContain("multipart.NewWriter")
    expect(code).toContain('w.WriteField("field", "val")')
  })
})
