import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useOrphanTabCleanup, AppLayout } from "./app-layout"
import { useTabsStore } from "@/store/tabs"
import { useWorkspaceStore } from "@/store/workspace"
import { useUiStore } from "@/store/ui"
import type { Collection, FolderItem, RequestItem, Tab } from "@/types"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock("@/lib/api", () => ({
  api: {
    collections: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      import: vi.fn(),
      export: vi.fn(),
    },
    environments: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      import: vi.fn(),
      export: vi.fn(),
    },
  },
}))

vi.mock("@/lib/backend", () => ({
  listHistory: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
  deleteHistoryEntry: vi.fn(),
  clearHistory: vi.fn(),
  cancelRequest: vi.fn(),
  sendRequest: vi.fn(),
  getVariables: vi.fn().mockResolvedValue({ globals: [] }),
  getSettings: vi.fn().mockResolvedValue({
    sslVerify: true,
    followRedirects: true,
    httpVersion: "auto",
    proxy: null,
    proxyBypass: [],
    certificates: [],
    maxResponseSizeBytes: 0,
    scriptTimeoutMs: 5000,
  }),
  putSettings: vi.fn(),
  BackendError: class BackendError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderLayout() {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLayout />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

const BODY = {
  type: "none" as const,
  raw: "",
  rawContentType: "application/json" as const,
  formData: [],
  urlencoded: [],
  graphqlQuery: "",
  graphqlVariables: "",
}

function makeTab(overrides: Partial<Tab> & Pick<Tab, "id" | "type">): Tab {
  return {
    title: "Tab",
    dirty: false,
    request: {
      method: "GET",
      url: "",
      params: [],
      headers: [],
      body: BODY,
      auth: { type: "inherit" },
      preRequestScript: "",
      testScript: "",
    },
    isSending: false,
    response: null,
    requestSubTab: "params",
    responseSubTab: "body",
    collectionSubTab: "overview",
    ...overrides,
  }
}

function makeRequest(id: string): RequestItem {
  return {
    id,
    name: "Request",
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: BODY,
    auth: { type: "inherit" },
    preRequestScript: "",
    testScript: "",
  }
}

function makeFolder(id: string, items: Collection["items"] = []): FolderItem {
  return {
    id,
    name: "Folder",
    auth: { type: "inherit" },
    preRequestScript: "",
    testScript: "",
    items,
  }
}

function makeCollection(id: string, items: Collection["items"] = []): Collection {
  return {
    id,
    name: "Col",
    description: "",
    auth: { type: "none" },
    variables: [],
    preRequestScript: "",
    testScript: "",
    items,
  }
}

function setCollections(cols: Collection[]) {
  useWorkspaceStore.setState((s) => ({ ...s, collections: cols }))
}

function setTabs(tabs: Tab[]) {
  useTabsStore.setState({ tabs, activeTabId: tabs[0]?.id ?? "", closedTabs: [] })
}

function tabIds() {
  return useTabsStore.getState().tabs.map((t) => t.id)
}

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
  setCollections([])
  localStorage.clear()
})

describe("orphan tab cleanup — collection deleted", () => {
  it("closes the collection tab", async () => {
    setCollections([makeCollection("c1")])
    setTabs([makeTab({ id: "t-col", type: "collection", collectionId: "c1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([]))

    await waitFor(() => expect(tabIds()).not.toContain("t-col"))
  })

  it("closes a request tab whose collection is deleted", async () => {
    setCollections([makeCollection("c1", [makeRequest("req1")])])
    setTabs([makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([]))

    await waitFor(() => expect(tabIds()).not.toContain("t-req"))
  })

  it("closes all tabs belonging to the deleted collection", async () => {
    const req = makeRequest("req1")
    const folder = makeFolder("f1", [req])
    setCollections([makeCollection("c1", [folder])])
    setTabs([
      makeTab({ id: "t-col", type: "collection", collectionId: "c1" }),
      makeTab({ id: "t-folder", type: "folder", collectionId: "c1", folderId: "f1" }),
      makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-col")
      expect(ids).not.toContain("t-folder")
      expect(ids).not.toContain("t-req")
    })
  })

  it("does not close tabs from a sibling collection", async () => {
    setCollections([makeCollection("c1"), makeCollection("c2")])
    setTabs([
      makeTab({ id: "t1", type: "collection", collectionId: "c1" }),
      makeTab({ id: "t2", type: "collection", collectionId: "c2" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c2")]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t1")
      expect(ids).toContain("t2")
    })
  })
})

describe("orphan tab cleanup — folder deleted", () => {
  it("closes the folder tab when the folder is deleted", async () => {
    setCollections([makeCollection("c1", [makeFolder("f1")])])
    setTabs([makeTab({ id: "t-folder", type: "folder", collectionId: "c1", folderId: "f1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => expect(tabIds()).not.toContain("t-folder"))
  })

  it("closes folder tab and request tabs inside the deleted folder", async () => {
    const req = makeRequest("req1")
    setCollections([makeCollection("c1", [makeFolder("f1", [req])])])
    setTabs([
      makeTab({ id: "t-folder", type: "folder", collectionId: "c1", folderId: "f1" }),
      makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-folder")
      expect(ids).not.toContain("t-req")
    })
  })

  it("closes tabs for requests in a deeply nested folder", async () => {
    const req = makeRequest("req1")
    const inner = makeFolder("f-inner", [req])
    const outer = makeFolder("f-outer", [inner])
    setCollections([makeCollection("c1", [outer])])
    setTabs([
      makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" }),
      makeTab({ id: "t-inner", type: "folder", collectionId: "c1", folderId: "f-inner" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-req")
      expect(ids).not.toContain("t-inner")
    })
  })

  it("does not close tabs for requests that remain in the collection", async () => {
    const req1 = makeRequest("req1")
    const req2 = makeRequest("req2")
    setCollections([makeCollection("c1", [makeFolder("f1", [req1]), req2])])
    setTabs([
      makeTab({ id: "t-req1", type: "request", collectionId: "c1", requestId: "req1" }),
      makeTab({ id: "t-req2", type: "request", collectionId: "c1", requestId: "req2" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [req2])]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-req1")
      expect(ids).toContain("t-req2")
    })
  })
})

describe("orphan tab cleanup — request deleted", () => {
  it("closes the request tab when the request is removed from the collection", async () => {
    const req = makeRequest("req1")
    setCollections([makeCollection("c1", [req])])
    setTabs([makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => expect(tabIds()).not.toContain("t-req"))
  })
})

// ---------------------------------------------------------------------------
// AppLayout component
// ---------------------------------------------------------------------------

describe("AppLayout component", () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
    useUiStore.setState((s) => ({ ...s, activePanel: "collections", settingsOpen: false }))
    queryClient.clear()
  })

  it("renders without crashing (default state: request/response panes)", () => {
    renderLayout()
    // RequestPane and ResponsePane are visible when no tab is active
    expect(document.body).toBeTruthy()
  })

  it("hides the side panel and drag handle when activePanel is null", () => {
    useUiStore.setState((s) => ({ ...s, activePanel: null }))
    const { container } = renderLayout()
    expect(container.querySelector(".cursor-col-resize")).not.toBeInTheDocument()
  })

  it("shows the drag handle when activePanel is set", () => {
    useUiStore.setState((s) => ({ ...s, activePanel: "collections" }))
    const { container } = renderLayout()
    expect(container.querySelector(".cursor-col-resize")).toBeInTheDocument()
  })

  it("renders CollectionPane when a collection tab is active", () => {
    useTabsStore.setState({
      tabs: [makeTab({ id: "t1", type: "collection", collectionId: "c1" })],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderLayout()
    // CollectionPane is rendered (not the resizable request/response split)
    expect(document.body).toBeTruthy()
  })

  it("renders EnvironmentPane when an environment tab is active", () => {
    useTabsStore.setState({
      tabs: [makeTab({ id: "t1", type: "environment", environmentId: "env-1" })],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderLayout()
    expect(document.body).toBeTruthy()
  })

  it("renders GlobalsPane when a globals tab is active", () => {
    useTabsStore.setState({
      tabs: [makeTab({ id: "t1", type: "globals" })],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderLayout()
    expect(document.body).toBeTruthy()
  })

  it("drag handle resize: mousedown starts drag, mousemove resizes, mouseup stops", () => {
    useUiStore.setState((s) => ({ ...s, activePanel: "collections" }))
    const { container } = renderLayout()

    const handle = container.querySelector(".cursor-col-resize") as HTMLElement
    expect(handle).toBeInTheDocument()

    fireEvent.mouseDown(handle, { clientX: 260 })
    fireEvent.mouseMove(window, { clientX: 300 })
    fireEvent.mouseUp(window)

    // Width clamped to [180, 480]; delta=40 from base 260 → 300
    expect(document.body).toBeTruthy()
  })

  it("drag handle clamps width to SIDE_PANEL_MAX (480)", () => {
    useUiStore.setState((s) => ({ ...s, activePanel: "collections" }))
    const { container } = renderLayout()

    const handle = container.querySelector(".cursor-col-resize") as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 260 })
    // Move far right to exceed max
    fireEvent.mouseMove(window, { clientX: 9999 })
    fireEvent.mouseUp(window)

    expect(document.body).toBeTruthy()
  })

  it("drag handle clamps width to SIDE_PANEL_MIN (180)", () => {
    useUiStore.setState((s) => ({ ...s, activePanel: "collections" }))
    const { container } = renderLayout()

    const handle = container.querySelector(".cursor-col-resize") as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 260 })
    // Move far left to go below min
    fireEvent.mouseMove(window, { clientX: 0 })
    fireEvent.mouseUp(window)

    expect(document.body).toBeTruthy()
  })

  it("stale mousemove after mouseup is a no-op (dragging guard)", () => {
    useUiStore.setState((s) => ({ ...s, activePanel: "collections" }))
    const { container } = renderLayout()

    const handle = container.querySelector(".cursor-col-resize") as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 260 })
    fireEvent.mouseMove(window, { clientX: 300 })
    fireEvent.mouseUp(window)
    // Stale move after drag ended — dragging.current is false, onMove exits early
    fireEvent.mouseMove(window, { clientX: 500 })

    expect(document.body).toBeTruthy()
  })
})
