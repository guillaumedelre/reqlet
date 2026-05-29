import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CollectionPane } from "./collection-pane"
import { useTabsStore } from "@/store/tabs"
import { useWorkspaceStore } from "@/store/workspace"
import { useRunsStore } from "@/store/runs"
import type { Collection, FolderItem, RequestItem, RunEvent, RunSummary, Tab } from "@/types"
import { DEFAULT_REQUEST } from "@/types"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock("@/components/ui/code-editor", () => ({
  CodeEditor: ({ value }: { value: string }) => (
    <textarea data-testid="code-editor" defaultValue={value} readOnly />
  ),
}))

const mockStream = vi.fn().mockReturnValue(() => {})
const mockRun = vi.fn().mockResolvedValue({ runId: "run-1" })

vi.mock("@/lib/api", () => ({
  api: {
    collections: { run: (...args: unknown[]) => mockRun(...args) },
    runs: { stream: (...args: unknown[]) => mockStream(...args) },
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BODY = {
  type: "none" as const,
  raw: "",
  rawContentType: "application/json" as const,
  formData: [],
  urlencoded: [],
  graphqlQuery: "",
  graphqlVariables: "",
}

function makeRequest(id: string): RequestItem {
  return {
    id,
    name: `Request ${id}`,
    method: "GET",
    url: "https://example.com",
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
    name: `Folder ${id}`,
    auth: { type: "inherit" },
    preRequestScript: "",
    testScript: "",
    items,
  }
}

function makeCollection(id = "c1", items: Collection["items"] = []): Collection {
  return {
    id,
    name: "My Collection",
    description: "A test collection",
    auth: { type: "none" },
    variables: [],
    preRequestScript: "",
    testScript: "",
    items,
  }
}

function makeTab(overrides: Partial<Tab> & Pick<Tab, "id" | "type">): Tab {
  return {
    title: "Tab",
    dirty: false,
    request: DEFAULT_REQUEST,
    isSending: false,
    response: null,
    requestSubTab: "params",
    responseSubTab: "body",
    collectionSubTab: "overview",
    ...overrides,
  }
}

function setupCollection(
  items: Collection["items"] = [makeRequest("req1"), makeRequest("req2")],
  subTab: Tab["collectionSubTab"] = "overview",
) {
  const col = makeCollection("c1", items)
  useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
  useTabsStore.setState({
    tabs: [makeTab({ id: "t1", type: "collection", collectionId: "c1", collectionSubTab: subTab })],
    activeTabId: "t1",
    closedTabs: [],
  })
}

function setupFolder() {
  const folder = makeFolder("f1", [makeRequest("req1")])
  const col = makeCollection("c1", [folder])
  useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
  useTabsStore.setState({
    tabs: [makeTab({ id: "t1", type: "folder", collectionId: "c1", folderId: "f1" })],
    activeTabId: "t1",
    closedTabs: [],
  })
}

function renderPane() {
  return render(
    <TooltipProvider>
      <CollectionPane />
    </TooltipProvider>,
  )
}

const REQ_SUMMARY: RunSummary = {
  runId: "run-1",
  collectionId: "c1",
  startedAt: new Date().toISOString(),
  durationMs: 1240,
  total: 2,
  passed: 2,
  failed: 0,
}

const REQ_EVENT_OK: RunEvent = {
  type: "request",
  name: "Request req1",
  method: "GET",
  url: "https://example.com",
  status: 200,
  durationMs: 120,
  tests: [{ name: "Status is 200", passed: true }],
  passed: true,
}

const REQ_EVENT_FAIL: RunEvent = {
  type: "request",
  name: "Request req2",
  method: "POST",
  url: "https://example.com/create",
  status: 404,
  durationMs: 80,
  tests: [{ name: "Status is 201", passed: false, error: "expected 404 to equal 201" }],
  passed: false,
}

// ---------------------------------------------------------------------------
// Reset state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
  useWorkspaceStore.setState((s) => ({ ...s, collections: [] }))
  useRunsStore.getState().resetRuns()
  mockRun.mockResolvedValue({ runId: "run-1" })
  mockStream.mockReturnValue(() => {})
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Rendering guards
// ---------------------------------------------------------------------------

describe("rendering guards", () => {
  it("returns nothing when no active tab", () => {
    const { container } = renderPane()
    expect(container.firstChild).toBeNull()
  })

  it("returns nothing when active tab is a request tab", () => {
    useTabsStore.setState({
      tabs: [makeTab({ id: "t1", type: "request" })],
      activeTabId: "t1",
      closedTabs: [],
    })
    const { container } = renderPane()
    expect(container.firstChild).toBeNull()
  })

  it("returns nothing when collection not found in store", () => {
    useWorkspaceStore.setState((s) => ({ ...s, collections: [] }))
    useTabsStore.setState({
      tabs: [makeTab({ id: "t1", type: "collection", collectionId: "missing" })],
      activeTabId: "t1",
      closedTabs: [],
    })
    const { container } = renderPane()
    expect(container.firstChild).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Collection tab — structure
// ---------------------------------------------------------------------------

describe("collection tab — structure", () => {
  it("renders collection name in breadcrumb", () => {
    setupCollection()
    renderPane()
    expect(screen.getByText("My Collection")).toBeInTheDocument()
  })

  it("shows Run button for collection tabs", () => {
    setupCollection()
    renderPane()
    expect(screen.getByRole("button", { name: /^Run$/i })).toBeInTheDocument()
  })

  it("shows 5 sub-tabs for collection: overview, authorization, variables, scripts, runs", () => {
    setupCollection()
    renderPane()
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /authorization/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /variables/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /scripts/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /runs/i })).toBeInTheDocument()
  })

  it("shows request count in overview", () => {
    setupCollection([makeRequest("r1"), makeRequest("r2")])
    renderPane()
    expect(screen.getByText("2 requests")).toBeInTheDocument()
  })

  it("shows collection description in overview", () => {
    setupCollection()
    renderPane()
    expect(screen.getByText("A test collection")).toBeInTheDocument()
  })

  it("shows singular 'request' for single item", () => {
    setupCollection([makeRequest("r1")])
    renderPane()
    expect(screen.getByText("1 request")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Folder tab — structure
// ---------------------------------------------------------------------------

describe("folder tab — structure", () => {
  it("renders folder name in breadcrumb", () => {
    setupFolder()
    renderPane()
    expect(screen.getByText("Folder f1")).toBeInTheDocument()
  })

  it("does NOT show Run button for folder tabs", () => {
    setupFolder()
    renderPane()
    expect(screen.queryByRole("button", { name: /^Run$/i })).not.toBeInTheDocument()
  })

  it("shows 3 sub-tabs for folder: overview, authorization, scripts (no runs, no variables)", () => {
    setupFolder()
    renderPane()
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /authorization/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /scripts/i })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /runs/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /variables/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// RunsTab — idle state (open runs tab directly via store)
// ---------------------------------------------------------------------------

describe("RunsTab — idle state", () => {
  it("shows 'No runs yet' when no run has been started", () => {
    setupCollection(undefined, "runs")
    renderPane()
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
  })

  it("shows config form with default values", () => {
    setupCollection(undefined, "runs")
    renderPane()
    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs[0]).toHaveValue(1) // iterations
    expect(inputs[1]).toHaveValue(0) // delay
  })

  it("shows 'Stop on failure' checkbox unchecked by default", () => {
    setupCollection(undefined, "runs")
    renderPane()
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).not.toBeChecked()
  })

  it("Run button in config bar is enabled", () => {
    setupCollection(undefined, "runs")
    renderPane()
    // The last Run button is the one in the config bar
    const buttons = screen.getAllByRole("button", { name: /^Run$/i })
    expect(buttons[buttons.length - 1]).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// RunsTab — config form interactions
// ---------------------------------------------------------------------------

describe("RunsTab — config form", () => {
  beforeEach(() => {
    setupCollection(undefined, "runs")
    renderPane()
  })

  it("updates iterations when changed", () => {
    const [iterInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(iterInput, { target: { value: "5" } })
    expect(iterInput).toHaveValue(5)
  })

  it("updates delay when changed", () => {
    const [, delayInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(delayInput, { target: { value: "200" } })
    expect(delayInput).toHaveValue(200)
  })

  it("toggles Stop on failure checkbox", () => {
    const checkbox = screen.getByRole("checkbox")
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Header Run button — triggers run
// ---------------------------------------------------------------------------

describe("header Run button", () => {
  it("calls api.collections.run with collection id", async () => {
    setupCollection()
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() => expect(mockRun).toHaveBeenCalledWith("c1", expect.objectContaining({})))
  })

  it("switches active sub-tab to 'runs'", async () => {
    setupCollection()
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() => {
      expect(useTabsStore.getState().tabs[0].collectionSubTab).toBe("runs")
    })
  })

  it("calls api.runs.stream with the returned runId", async () => {
    setupCollection()
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() =>
      expect(mockStream).toHaveBeenCalledWith(
        "run-1",
        expect.objectContaining({ onEvent: expect.any(Function) }),
      ),
    )
  })

  it("passes run options to the API", async () => {
    setupCollection(undefined, "runs")
    renderPane()

    // Set iterations to 3
    const [iterInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(iterInput, { target: { value: "3" } })

    const runBtns = screen.getAllByRole("button", { name: /^Run$/i })
    fireEvent.click(runBtns[runBtns.length - 1])

    await waitFor(() =>
      expect(mockRun).toHaveBeenCalledWith("c1", expect.objectContaining({ iterations: 3 })),
    )
  })

  it("shows toast.error when api.collections.run throws", async () => {
    const { toast } = await import("sonner")
    mockRun.mockRejectedValueOnce(new Error("server error"))
    setupCollection()
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("server error"))
  })

  it("is disabled while a run is in progress for this collection", async () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
    })
    const runBtns = screen.getAllByRole("button", { name: /Running…/i })
    expect(runBtns[0]).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// RunsTab — running state
// ---------------------------------------------------------------------------

describe("RunsTab — running state", () => {
  function startRunInStore() {
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
    })
  }

  it("shows 'Running…' in config bar while running", () => {
    setupCollection(undefined, "runs")
    renderPane()
    startRunInStore()
    expect(screen.getByText("Running…")).toBeInTheDocument()
  })

  it("config inputs are disabled while running", () => {
    setupCollection(undefined, "runs")
    renderPane()
    startRunInStore()
    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs[0]).toBeDisabled()
    expect(inputs[1]).toBeDisabled()
  })

  it("shows 'Waiting for first request…' before any events arrive", () => {
    setupCollection(undefined, "runs")
    renderPane()
    startRunInStore()
    expect(screen.getByText("Waiting for first request…")).toBeInTheDocument()
  })

  it("shows progress counter when start + request events arrive", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", {
        type: "start",
        total: 2,
        iterations: 1,
        passed: false,
      })
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
    })
    expect(screen.getByText(/1 \/ 2 requests/)).toBeInTheDocument()
  })

  it("shows request name and method badge", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
    })
    expect(screen.getByText("Request req1")).toBeInTheDocument()
    expect(screen.getByText("GET")).toBeInTheDocument()
  })

  it("shows status code green for 2xx", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
    })
    const statusEl = screen.getByText("200")
    expect(statusEl.className).toContain("emerald")
  })

  it("shows status code red for 4xx", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_FAIL)
    })
    const statusEl = screen.getByText("404")
    expect(statusEl.className).toContain("red")
  })

  it("shows test pass count", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
    })
    expect(screen.getByText("1/1")).toBeInTheDocument()
  })

  it("shows failed test name and error below failed event row", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_FAIL)
    })
    expect(screen.getByText(/Status is 201/)).toBeInTheDocument()
    expect(screen.getByText(/expected 404 to equal 201/)).toBeInTheDocument()
  })

  it("shows duration in event row", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
    })
    expect(screen.getByText("120ms")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// RunsTab — done state
// ---------------------------------------------------------------------------

describe("RunsTab — done state", () => {
  function finishRunInStore(summary = REQ_SUMMARY) {
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
      useRunsStore.getState().finishRun("run-1", summary)
    })
  }

  it("shows passed count", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    expect(screen.getByText(/2 passed/)).toBeInTheDocument()
  })

  it("shows total and duration", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    expect(screen.getByText(/2 total/)).toBeInTheDocument()
    expect(screen.getByText(/1\.24s/)).toBeInTheDocument()
  })

  it("shows failed count when failures exist", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore({ ...REQ_SUMMARY, passed: 1, failed: 1 })
    expect(screen.getByText(/1 failed/)).toBeInTheDocument()
  })

  it("does not show failed count when all passed", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument()
  })

  it("shows Run Again button", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument()
  })

  it("Run Again calls api.collections.run again", async () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    mockRun.mockResolvedValueOnce({ runId: "run-2" })
    fireEvent.click(screen.getByRole("button", { name: /run again/i }))
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1))
  })
})

// ---------------------------------------------------------------------------
// RunsTab — error state
// ---------------------------------------------------------------------------

describe("RunsTab — error state", () => {
  function failRunInStore() {
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().failRun("run-1", "SSE connection lost")
    })
  }

  it("shows error message", () => {
    setupCollection(undefined, "runs")
    renderPane()
    failRunInStore()
    expect(screen.getByText("SSE connection lost")).toBeInTheDocument()
  })

  it("shows Retry button", () => {
    setupCollection(undefined, "runs")
    renderPane()
    failRunInStore()
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  it("Retry button triggers a new run", async () => {
    setupCollection(undefined, "runs")
    renderPane()
    failRunInStore()
    fireEvent.click(screen.getByRole("button", { name: /retry/i }))
    await waitFor(() => expect(mockRun).toHaveBeenCalled())
  })

  it("shows fallback message when error is empty string", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().failRun("run-1", "")
    })
    // Empty error string falls back to the error span text being empty but Retry still shows
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// RunsTab — past runs sidebar
// ---------------------------------------------------------------------------

describe("RunsTab — past runs sidebar", () => {
  it("does not show sidebar when only one run exists", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().finishRun("run-1", REQ_SUMMARY)
    })
    expect(screen.queryByText("Past Runs")).not.toBeInTheDocument()
  })

  it("shows sidebar when two or more runs exist", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().finishRun("run-1", REQ_SUMMARY)
      useRunsStore.getState().startRun("run-2", "c1")
      useRunsStore.getState().finishRun("run-2", { ...REQ_SUMMARY, runId: "run-2" })
    })
    expect(screen.getByText("Past Runs")).toBeInTheDocument()
  })

  it("clicking a past run item is interactive", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().finishRun("run-1", REQ_SUMMARY)
      useRunsStore.getState().startRun("run-2", "c1")
      useRunsStore.getState().finishRun("run-2", { ...REQ_SUMMARY, runId: "run-2" })
    })
    const sidebar = screen.getByText("Past Runs").closest("div")!.parentElement!
    const items = within(sidebar).getAllByRole("button")
    expect(items.length).toBeGreaterThanOrEqual(2)
    // Should not throw on click
    fireEvent.click(items[1])
    expect(screen.getByText("Past Runs")).toBeInTheDocument()
  })

  it("shows pass ratio for completed runs in the sidebar", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().finishRun("run-1", REQ_SUMMARY)
      useRunsStore.getState().startRun("run-2", "c1")
      useRunsStore.getState().finishRun("run-2", { ...REQ_SUMMARY, runId: "run-2" })
    })
    expect(screen.getAllByText(/2\/2/)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// RunsTab — isolation between collections
// ---------------------------------------------------------------------------

describe("RunsTab — isolation between collections", () => {
  it("does not show runs from a different collection", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-x", "other-col")
      useRunsStore.getState().finishRun("run-x", {
        ...REQ_SUMMARY,
        runId: "run-x",
        collectionId: "other-col",
      })
    })
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// RunsTab — multi-iteration display
// ---------------------------------------------------------------------------

describe("RunsTab — multi-iteration", () => {
  it("shows iteration number column when iterations > 1", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", {
        type: "start",
        total: 1,
        iterations: 3,
        passed: false,
      })
      useRunsStore.getState().appendEvent("run-1", {
        ...REQ_EVENT_OK,
        iteration: 2,
      })
    })
    // Iteration number "2" rendered in the iteration column
    expect(screen.getByText("2")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// formatDuration helper (via rendered output)
// ---------------------------------------------------------------------------

describe("duration formatting", () => {
  it("formats durations under 1s as ms", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", { ...REQ_EVENT_OK, durationMs: 450 })
    })
    expect(screen.getByText("450ms")).toBeInTheDocument()
  })

  it("formats summary duration >= 1s as seconds", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().finishRun("run-1", { ...REQ_SUMMARY, durationMs: 2500 })
    })
    expect(screen.getByText(/2\.50s/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Breadcrumb navigation
// ---------------------------------------------------------------------------

describe("breadcrumb navigation", () => {
  it("clicking collection segment in breadcrumb switches to the collection tab", () => {
    const folder = makeFolder("f1", [makeRequest("req1")])
    const col = makeCollection("c1", [folder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({ id: "t1", type: "folder", collectionId: "c1", folderId: "f1" }),
        makeTab({ id: "t-col", type: "collection", collectionId: "c1" }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()

    const colLink = screen.getByText("My Collection")
    fireEvent.click(colLink)

    expect(useTabsStore.getState().activeTabId).toBe("t-col")
  })
})
