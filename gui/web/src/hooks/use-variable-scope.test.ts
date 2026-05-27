import { describe, it, expect, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { resolveRecursive, useVariableScope } from "./use-variable-scope"
import { useWorkspaceStore } from "@/store/workspace"
import { useUiStore } from "@/store/ui"

function makeVar(key: string, currentValue: string, enabled = true) {
  return { id: `v-${key}`, enabled, key, initialValue: `init-${key}`, currentValue }
}

function raw(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries))
}

// ---------------------------------------------------------------------------
// resolveRecursive — pure unit tests
// ---------------------------------------------------------------------------

describe("resolveRecursive", () => {
  it("returns plain values unchanged when no {{}} references", () => {
    const result = resolveRecursive(raw({ a: "hello", b: "world" }))
    expect(result.get("a")).toBe("hello")
    expect(result.get("b")).toBe("world")
  })

  it("resolves one level of indirection", () => {
    const result = resolveRecursive(raw({ proto: "https://", host: "api.example.com" }))
    expect(result.get("proto")).toBe("https://")
    expect(result.get("host")).toBe("api.example.com")
  })

  it("resolves a value that references another variable", () => {
    const result = resolveRecursive(
      raw({ baseUrl: "api.example.com", url: "https://{{baseUrl}}/v1" }),
    )
    expect(result.get("url")).toBe("https://api.example.com/v1")
    expect(result.get("baseUrl")).toBe("api.example.com")
  })

  it("resolves two levels deep", () => {
    const result = resolveRecursive(
      raw({ proto: "https://", host: "example.com", baseUrl: "{{proto}}{{host}}" }),
    )
    expect(result.get("baseUrl")).toBe("https://example.com")
  })

  it("resolves the user case: composite URL from multiple parts", () => {
    const result = resolveRecursive(
      raw({
        proto: "https://",
        baseUrl: "api.example.com",
        urlAuth: "{{proto}}authentication.{{baseUrl}}",
      }),
    )
    expect(result.get("urlAuth")).toBe("https://authentication.api.example.com")
  })

  it("resolves multiple {{}} tokens in one value", () => {
    const result = resolveRecursive(
      raw({ first: "Hello", second: "World", greeting: "{{first}} {{second}}!" }),
    )
    expect(result.get("greeting")).toBe("Hello World!")
  })

  it("resolves transitively: a → b → c", () => {
    const result = resolveRecursive(raw({ c: "deep", b: "{{c}}", a: "{{b}}" }))
    expect(result.get("a")).toBe("deep")
    expect(result.get("b")).toBe("deep")
    expect(result.get("c")).toBe("deep")
  })

  it("leaves undefined references as-is", () => {
    const result = resolveRecursive(raw({ url: "https://{{unknown}}/path" }))
    expect(result.get("url")).toBe("https://{{unknown}}/path")
  })

  it("resolves defined refs and preserves undefined refs in the same value", () => {
    const result = resolveRecursive(raw({ proto: "https://", url: "{{proto}}{{host}}/path" }))
    expect(result.get("url")).toBe("https://{{host}}/path")
  })

  it("detects a direct self-reference cycle and preserves the token", () => {
    const result = resolveRecursive(raw({ a: "prefix-{{a}}-suffix" }))
    expect(result.get("a")).toBe("prefix-{{a}}-suffix")
  })

  it("detects a two-variable cycle (a → b → a)", () => {
    const result = resolveRecursive(raw({ a: "{{b}}", b: "{{a}}" }))
    // b resolves to {{a}} (cycle guard kicks in), a therefore resolves to {{a}}
    expect(result.get("a")).toBe("{{a}}")
    expect(result.get("b")).toBe("{{a}}")
  })

  it("detects a three-variable cycle (a → b → c → a)", () => {
    const result = resolveRecursive(raw({ a: "{{b}}", b: "{{c}}", c: "{{a}}" }))
    // Cycle is preserved as-is somewhere in the chain
    const cyclePreserved = [result.get("a"), result.get("b"), result.get("c")].some((v) =>
      /\{\{[^{}]+\}\}/.test(v ?? ""),
    )
    expect(cyclePreserved).toBe(true)
  })

  it("memoizes: a key resolved as a side-effect is not re-resolved", () => {
    // If b is resolved while resolving a, the main loop must reuse that result
    const result = resolveRecursive(raw({ b: "hello", a: "{{b}} world", c: "{{b}} again" }))
    expect(result.get("a")).toBe("hello world")
    expect(result.get("b")).toBe("hello")
    expect(result.get("c")).toBe("hello again")
  })

  it("returns an entry for every key in the input map", () => {
    const input = raw({ x: "1", y: "{{x}}", z: "plain" })
    const result = resolveRecursive(input)
    expect(result.size).toBe(input.size)
    for (const key of input.keys()) {
      expect(result.has(key)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// useVariableScope — hook integration tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useWorkspaceStore.setState({ collections: [], environments: [], globalVariables: [] })
  useUiStore.setState({ activeEnvironmentId: null })
})

describe("useVariableScope", () => {
  it("returns empty maps when no variables are defined", () => {
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.size).toBe(0)
    expect(result.current.allKeys).toEqual([])
  })

  it("includes enabled global variables", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("host", "api.example.com"), makeVar("token", "abc123")],
    })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.get("host")).toBe("api.example.com")
    expect(result.current.resolvedMap.get("token")).toBe("abc123")
    expect(result.current.allKeys).toContain("host")
    expect(result.current.allKeys).toContain("token")
  })

  it("ignores disabled global variables", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("disabled", "value", false)],
    })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.has("disabled")).toBe(false)
  })

  it("ignores variables with empty keys", () => {
    useWorkspaceStore.setState({
      globalVariables: [{ id: "v1", enabled: true, key: "", initialValue: "x", currentValue: "x" }],
    })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.allKeys).toEqual([])
  })

  it("includes active environment variables", () => {
    useWorkspaceStore.setState({
      environments: [
        { id: "env-1", name: "Dev", variables: [makeVar("baseUrl", "http://localhost")] },
      ],
    })
    useUiStore.setState({ activeEnvironmentId: "env-1" })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.get("baseUrl")).toBe("http://localhost")
  })

  it("ignores variables from inactive environments", () => {
    useWorkspaceStore.setState({
      environments: [
        { id: "env-2", name: "Prod", variables: [makeVar("baseUrl", "https://prod")] },
      ],
    })
    useUiStore.setState({ activeEnvironmentId: "env-1" })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.has("baseUrl")).toBe(false)
  })

  it("includes collection variables when collectionId is provided", () => {
    useWorkspaceStore.setState({
      collections: [
        {
          id: "col-1",
          name: "My API",
          description: "",
          auth: { type: "none" },
          items: [],
          preRequestScript: "",
          testScript: "",
          variables: [makeVar("version", "v2")],
        },
      ],
    })
    const { result } = renderHook(() => useVariableScope("col-1"))
    expect(result.current.resolvedMap.get("version")).toBe("v2")
  })

  it("environment overrides collection which overrides global (priority order)", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("key", "from-global")],
      collections: [
        {
          id: "col-1",
          name: "API",
          description: "",
          auth: { type: "none" },
          items: [],
          preRequestScript: "",
          testScript: "",
          variables: [makeVar("key", "from-collection")],
        },
      ],
      environments: [{ id: "env-1", name: "Dev", variables: [makeVar("key", "from-env")] }],
    })
    useUiStore.setState({ activeEnvironmentId: "env-1" })
    const { result } = renderHook(() => useVariableScope("col-1"))
    expect(result.current.resolvedMap.get("key")).toBe("from-env")
  })

  it("collection overrides global when no environment is active", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("key", "from-global")],
      collections: [
        {
          id: "col-1",
          name: "API",
          description: "",
          auth: { type: "none" },
          items: [],
          preRequestScript: "",
          testScript: "",
          variables: [makeVar("key", "from-collection")],
        },
      ],
    })
    const { result } = renderHook(() => useVariableScope("col-1"))
    expect(result.current.resolvedMap.get("key")).toBe("from-collection")
  })

  it("falls back to initialValue when currentValue is empty", () => {
    useWorkspaceStore.setState({
      globalVariables: [
        { id: "v1", enabled: true, key: "fallback", initialValue: "init-val", currentValue: "" },
      ],
    })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.get("fallback")).toBe("init-val")
  })

  it("deduplicates keys from multiple scopes", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("shared", "global")],
      collections: [
        {
          id: "col-1",
          name: "API",
          description: "",
          auth: { type: "none" },
          items: [],
          preRequestScript: "",
          testScript: "",
          variables: [makeVar("shared", "collection")],
        },
      ],
    })
    const { result } = renderHook(() => useVariableScope("col-1"))
    expect(result.current.allKeys.filter((k) => k === "shared")).toHaveLength(1)
  })

  it("resolves variables recursively across scopes", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("proto", "https://"), makeVar("baseUrl", "api.example.com")],
      environments: [
        {
          id: "env-1",
          name: "Dev",
          variables: [makeVar("urlAuth", "{{proto}}authentication.{{baseUrl}}")],
        },
      ],
    })
    useUiStore.setState({ activeEnvironmentId: "env-1" })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.get("urlAuth")).toBe("https://authentication.api.example.com")
  })

  it("cross-scope recursive: env var references collection var references global var", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("host", "example.com")],
      collections: [
        {
          id: "col-1",
          name: "API",
          description: "",
          auth: { type: "none" },
          items: [],
          preRequestScript: "",
          testScript: "",
          variables: [makeVar("base", "api.{{host}}")],
        },
      ],
      environments: [
        {
          id: "env-1",
          name: "Dev",
          variables: [makeVar("fullUrl", "https://{{base}}/v2")],
        },
      ],
    })
    useUiStore.setState({ activeEnvironmentId: "env-1" })
    const { result } = renderHook(() => useVariableScope("col-1"))
    expect(result.current.resolvedMap.get("fullUrl")).toBe("https://api.example.com/v2")
  })

  it("preserves unresolved {{}} tokens when variable is not defined in any scope", () => {
    useWorkspaceStore.setState({
      globalVariables: [makeVar("url", "https://{{unknown}}/path")],
    })
    const { result } = renderHook(() => useVariableScope())
    expect(result.current.resolvedMap.get("url")).toBe("https://{{unknown}}/path")
  })
})
