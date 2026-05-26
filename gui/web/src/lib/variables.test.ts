import { describe, expect, it } from "vitest"
import type { Variable } from "@/store/environments"
import { resolveVariables } from "./variables"

function makeVar(key: string, currentValue: string, enabled = true): Variable {
  return { id: crypto.randomUUID(), key, initialValue: "", currentValue, enabled }
}

describe("resolveVariables", () => {
  it("replaces a known variable", () => {
    const result = resolveVariables("Hello {{name}}", [], [makeVar("name", "world")])
    expect(result).toBe("Hello world")
  })

  it("leaves unknown variables untouched", () => {
    const result = resolveVariables("{{unknown}}", [], [])
    expect(result).toBe("{{unknown}}")
  })

  it("replaces multiple occurrences", () => {
    const result = resolveVariables("{{a}}/{{a}}", [], [makeVar("a", "x")])
    expect(result).toBe("x/x")
  })

  it("env variables shadow globals", () => {
    const globals = [makeVar("token", "global-token")]
    const env = [makeVar("token", "env-token")]
    expect(resolveVariables("{{token}}", globals, env)).toBe("env-token")
  })

  it("falls back to global when env does not define the variable", () => {
    const globals = [makeVar("base_url", "https://prod.example.com")]
    expect(resolveVariables("{{base_url}}/path", globals, [])).toBe("https://prod.example.com/path")
  })

  it("skips disabled variables", () => {
    const env = [makeVar("host", "example.com", false)]
    expect(resolveVariables("{{host}}", [], env)).toBe("{{host}}")
  })

  it("skips variables with empty key", () => {
    const env = [makeVar("", "value")]
    expect(resolveVariables("{{host}}", [], env)).toBe("{{host}}")
  })

  it("trims whitespace inside braces", () => {
    const env = [makeVar("api_key", "secret")]
    expect(resolveVariables("{{ api_key }}", [], env)).toBe("secret")
  })

  it("returns empty string unchanged", () => {
    expect(resolveVariables("", [], [])).toBe("")
  })

  it("trims whitespace from variable keys when building scope", () => {
    const env = [makeVar(" api_key ", "secret")]
    expect(resolveVariables("{{api_key}}", [], env)).toBe("secret")
  })
})
