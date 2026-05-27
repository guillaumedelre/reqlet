import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useWorkspaceSync, syncCollectionDiff, syncEnvironmentDiff } from "./use-workspace-sync"
import { useWorkspaceStore } from "@/store/workspace"
import { api } from "@/lib/api"
import type { Collection, Environment } from "@/types"

vi.mock("@/lib/api", () => ({
  api: {
    collections: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    environments: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

const emptyCol = (): Collection => ({
  id: "col-1",
  name: "Test Collection",
  description: "",
  items: [],
  variables: [],
  preRequestScript: "",
  testScript: "",
  auth: { type: "none" },
})

const emptyEnv = (): Environment => ({ id: "env-1", name: "Dev", variables: [] })

beforeEach(() => {
  useWorkspaceStore.setState({ collections: [], environments: [] })
  vi.clearAllMocks()
  vi.mocked(api.collections.create).mockResolvedValue(emptyCol())
  vi.mocked(api.collections.update).mockResolvedValue(emptyCol())
  vi.mocked(api.collections.delete).mockResolvedValue(undefined)
  vi.mocked(api.environments.create).mockResolvedValue(emptyEnv())
  vi.mocked(api.environments.update).mockResolvedValue(emptyEnv())
  vi.mocked(api.environments.delete).mockResolvedValue(undefined)
})

// --- syncCollectionDiff ---

describe("syncCollectionDiff", () => {
  it("does nothing when same reference", () => {
    const cols = [emptyCol()]
    syncCollectionDiff(cols, cols)
    expect(api.collections.create).not.toHaveBeenCalled()
    expect(api.collections.update).not.toHaveBeenCalled()
    expect(api.collections.delete).not.toHaveBeenCalled()
  })

  it("calls create for new collection", () => {
    const col = emptyCol()
    syncCollectionDiff([col], [])
    expect(api.collections.create).toHaveBeenCalledWith(col)
  })

  it("calls delete for removed collection", () => {
    const col = emptyCol()
    syncCollectionDiff([], [col])
    expect(api.collections.delete).toHaveBeenCalledWith("col-1")
  })

  it("calls update when collection reference changes", () => {
    const prev = emptyCol()
    const curr = { ...prev, name: "Updated" }
    syncCollectionDiff([curr], [prev])
    expect(api.collections.update).toHaveBeenCalledWith("col-1", curr)
  })

  it("does not call update when reference is identical", () => {
    const col = emptyCol()
    syncCollectionDiff([col], [col])
    expect(api.collections.update).not.toHaveBeenCalled()
  })
})

// --- syncEnvironmentDiff ---

describe("syncEnvironmentDiff", () => {
  it("does nothing when same reference", () => {
    const envs = [emptyEnv()]
    syncEnvironmentDiff(envs, envs)
    expect(api.environments.create).not.toHaveBeenCalled()
    expect(api.environments.update).not.toHaveBeenCalled()
    expect(api.environments.delete).not.toHaveBeenCalled()
  })

  it("calls create for new environment", () => {
    const env = emptyEnv()
    syncEnvironmentDiff([env], [])
    expect(api.environments.create).toHaveBeenCalledWith(env)
  })

  it("calls delete for removed environment", () => {
    const env = emptyEnv()
    syncEnvironmentDiff([], [env])
    expect(api.environments.delete).toHaveBeenCalledWith("env-1")
  })

  it("calls update when environment reference changes", () => {
    const prev = emptyEnv()
    const curr = { ...prev, name: "Updated" }
    syncEnvironmentDiff([curr], [prev])
    expect(api.environments.update).toHaveBeenCalledWith("env-1", curr)
  })

  it("does not call update when reference is identical", () => {
    const env = emptyEnv()
    syncEnvironmentDiff([env], [env])
    expect(api.environments.update).not.toHaveBeenCalled()
  })
})

// --- .catch(() => {}) coverage: verify rejected promises are swallowed ---

describe("syncCollectionDiff — error swallowing", () => {
  it("swallows delete rejection", async () => {
    vi.mocked(api.collections.delete).mockRejectedValue(new Error("network"))
    syncCollectionDiff([], [emptyCol()])
    await Promise.resolve() // flush microtasks so catch handler runs
  })

  it("swallows create rejection", async () => {
    vi.mocked(api.collections.create).mockRejectedValue(new Error("network"))
    syncCollectionDiff([emptyCol()], [])
    await Promise.resolve()
  })

  it("swallows update rejection", async () => {
    vi.mocked(api.collections.update).mockRejectedValue(new Error("network"))
    const prev = emptyCol()
    const curr = { ...prev, name: "Changed" }
    syncCollectionDiff([curr], [prev])
    await Promise.resolve()
  })
})

describe("syncEnvironmentDiff — error swallowing", () => {
  it("swallows delete rejection", async () => {
    vi.mocked(api.environments.delete).mockRejectedValue(new Error("network"))
    syncEnvironmentDiff([], [emptyEnv()])
    await Promise.resolve()
  })

  it("swallows create rejection", async () => {
    vi.mocked(api.environments.create).mockRejectedValue(new Error("network"))
    syncEnvironmentDiff([emptyEnv()], [])
    await Promise.resolve()
  })

  it("swallows update rejection", async () => {
    vi.mocked(api.environments.update).mockRejectedValue(new Error("network"))
    const prev = emptyEnv()
    const curr = { ...prev, name: "Changed" }
    syncEnvironmentDiff([curr], [prev])
    await Promise.resolve()
  })
})

// --- useWorkspaceSync hook ---

describe("useWorkspaceSync", () => {
  it("populates store when both queries succeed", async () => {
    const col = emptyCol()
    const env = emptyEnv()
    vi.mocked(api.collections.list).mockResolvedValue([col])
    vi.mocked(api.environments.list).mockResolvedValue([env])

    renderHook(() => useWorkspaceSync(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(useWorkspaceStore.getState().collections).toEqual([col])
      expect(useWorkspaceStore.getState().environments).toEqual([env])
    })
  })

  it("does not sync init load to API", async () => {
    const col = emptyCol()
    vi.mocked(api.collections.list).mockResolvedValue([col])
    vi.mocked(api.environments.list).mockResolvedValue([])

    renderHook(() => useWorkspaceSync(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(useWorkspaceStore.getState().collections).toEqual([col])
    })

    // create/update should not be called for the initial population
    expect(api.collections.create).not.toHaveBeenCalled()
    expect(api.collections.update).not.toHaveBeenCalled()
  })

  it("syncs new collection to API after init", async () => {
    vi.mocked(api.collections.list).mockResolvedValue([emptyCol()])
    vi.mocked(api.environments.list).mockResolvedValue([])

    renderHook(() => useWorkspaceSync(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(useWorkspaceStore.getState().collections).toHaveLength(1)
    })

    act(() => {
      useWorkspaceStore.getState().addCollection("New Collection")
    })

    expect(api.collections.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Collection" }),
    )
  })

  it("syncs deleted collection to API after init", async () => {
    vi.mocked(api.collections.list).mockResolvedValue([emptyCol()])
    vi.mocked(api.environments.list).mockResolvedValue([])

    renderHook(() => useWorkspaceSync(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(useWorkspaceStore.getState().collections).toHaveLength(1)
    })

    act(() => {
      useWorkspaceStore.getState().deleteCollection("col-1")
    })

    expect(api.collections.delete).toHaveBeenCalledWith("col-1")
  })

  it("does not sync when queries have not loaded yet", () => {
    vi.mocked(api.collections.list).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.environments.list).mockReturnValue(new Promise(() => {}))

    renderHook(() => useWorkspaceSync(), { wrapper: makeWrapper() })

    act(() => {
      useWorkspaceStore.getState().addCollection("Should not sync")
    })

    expect(api.collections.create).not.toHaveBeenCalled()
  })
})
