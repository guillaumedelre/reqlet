import { describe, it, expect, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useVariableScope } from "./use-variable-scope"
import { useWorkspaceStore } from "@/store/workspace"
import { useUiStore } from "@/store/ui"

function makeVar(key: string, currentValue: string, enabled = true) {
  return { id: `v-${key}`, enabled, key, initialValue: `init-${key}`, currentValue }
}

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
})
