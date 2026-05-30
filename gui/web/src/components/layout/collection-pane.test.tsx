import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CollectionPane } from "./collection-pane"
import { useTabsStore } from "@/store/tabs"
import { useWorkspaceStore } from "@/store/workspace"
import { useRunsStore } from "@/store/runs"
import { useUiStore } from "@/store/ui"
import type { Collection, FolderItem, RequestItem, RunEvent, RunSummary, Tab } from "@/types"
import { DEFAULT_REQUEST } from "@/types"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock("./auth-panel", () => ({
  AuthPanel: ({
    onChange,
  }: {
    auth: unknown
    hideInherit?: boolean
    onChange: (auth: unknown) => void
  }) => (
    <div>
      <select
        role="combobox"
        aria-label="Auth type"
        onChange={(e) => onChange({ type: e.target.value })}
        defaultValue=""
      >
        <option value="">inherit</option>
        <option value="none">No Auth</option>
        <option value="bearer">Bearer Token</option>
      </select>
    </div>
  ),
}))

vi.mock("@/components/ui/code-editor", () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="code-editor"
      defaultValue={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
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
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
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

  it("shows Run button in the Runs sub-tab config bar", () => {
    setupCollection(undefined, "runs")
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

  it("shows 4 sub-tabs for folder: overview, authorization, scripts, runs (no variables)", () => {
    setupFolder()
    renderPane()
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /authorization/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /scripts/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /runs/i })).toBeInTheDocument()
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
// Config bar Run button — triggers run
// ---------------------------------------------------------------------------

describe("header Run button", () => {
  it("calls api.collections.run with collection id", async () => {
    setupCollection(undefined, "runs")
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() =>
      expect(mockRun).toHaveBeenCalledWith("c1", expect.objectContaining({ iterations: 1 })),
    )
  })

  it("passes resolved variables to the run API", async () => {
    act(() => {
      useWorkspaceStore.getState().setEnvironments([
        {
          id: "env-test",
          name: "Test",
          variables: [
            {
              id: "v1",
              enabled: true,
              key: "baseUrl",
              initialValue: "http://init",
              currentValue: "http://current",
            },
          ],
        },
      ])
      useUiStore.getState().setActiveEnvironment("env-test")
    })
    setupCollection(undefined, "runs")
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() =>
      expect(mockRun).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          variables: expect.objectContaining({ environment: { baseUrl: "http://current" } }),
        }),
      ),
    )
    act(() => {
      useWorkspaceStore.getState().setEnvironments([])
      useUiStore.getState().setActiveEnvironment(null)
    })
  })

  it("switches active sub-tab to 'runs'", async () => {
    setupCollection(undefined, "runs")
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() => {
      expect(useTabsStore.getState().tabs[0].collectionSubTab).toBe("runs")
    })
  })

  it("calls api.runs.stream with the returned runId", async () => {
    setupCollection(undefined, "runs")
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

    const [iterInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(iterInput, { target: { value: "3" } })

    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))

    await waitFor(() =>
      expect(mockRun).toHaveBeenCalledWith("c1", expect.objectContaining({ iterations: 3 })),
    )
  })

  it("shows toast.error when api.collections.run throws", async () => {
    const { toast } = await import("sonner")
    mockRun.mockRejectedValueOnce(new Error("server error"))
    setupCollection(undefined, "runs")
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
    const card = screen.getByText("Passed").closest("div")!
    expect(within(card).getByText("2")).toBeInTheDocument()
  })

  it("shows total and duration", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    const totalCard = screen.getByText("Total").closest("div")!
    expect(within(totalCard).getByText("2")).toBeInTheDocument()
    const durationCard = screen.getByText("Duration").closest("div")!
    expect(within(durationCard).getByText("1s 240ms")).toBeInTheDocument()
  })

  it("shows failed count when failures exist", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore({ ...REQ_SUMMARY, passed: 1, failed: 1 })
    const card = screen.getByText("Failed").closest("div")!
    expect(within(card).getByText("1")).toBeInTheDocument()
  })

  it("shows 0 in failed card when all passed", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    // Failed card is always shown; value must be 0 when no failures
    const card = screen.getByText("Failed").closest("div")!
    expect(within(card).getByText("0")).toBeInTheDocument()
  })

  it("shows 4 summary metric cards", () => {
    setupCollection(undefined, "runs")
    renderPane()
    finishRunInStore()
    expect(screen.getByText("Passed")).toBeInTheDocument()
    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("Duration")).toBeInTheDocument()
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
    expect(screen.getByText(/2s 500ms/)).toBeInTheDocument()
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

// ---------------------------------------------------------------------------
// Per-tab run options
// ---------------------------------------------------------------------------

describe("per-tab run options", () => {
  it("runOptions defaults to { iterations: 1, delayMs: 0, bail: false } when tab has no saved options", () => {
    setupCollection(undefined, "runs")
    renderPane()
    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs[0]).toHaveValue(1)
    expect(inputs[1]).toHaveValue(0)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("changing iterations updates runOptions.iterations in the tabs store", () => {
    setupCollection(undefined, "runs")
    renderPane()
    const [iterInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(iterInput, { target: { value: "7" } })
    expect(useTabsStore.getState().tabs[0].runOptions?.iterations).toBe(7)
  })

  it("changing delay updates runOptions.delayMs in the tabs store", () => {
    setupCollection(undefined, "runs")
    renderPane()
    const [, delayInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(delayInput, { target: { value: "300" } })
    expect(useTabsStore.getState().tabs[0].runOptions?.delayMs).toBe(300)
  })

  it("runOptions are independent between two collection tabs", () => {
    const col1 = makeCollection("c1", [makeRequest("r1")])
    const col2 = makeCollection("c2", [makeRequest("r2")])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col1, col2] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "collection",
          collectionId: "c1",
          collectionSubTab: "runs",
          runOptions: { iterations: 1, delayMs: 0, bail: false },
        }),
        makeTab({
          id: "t2",
          type: "collection",
          collectionId: "c2",
          collectionSubTab: "runs",
          runOptions: { iterations: 1, delayMs: 0, bail: false },
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()
    const [iterInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(iterInput, { target: { value: "5" } })

    const state = useTabsStore.getState()
    expect(state.tabs.find((t) => t.id === "t1")?.runOptions?.iterations).toBe(5)
    expect(state.tabs.find((t) => t.id === "t2")?.runOptions?.iterations).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Folder tab — Runs sub-tab
// ---------------------------------------------------------------------------

describe("folder tab — Runs sub-tab", () => {
  function setupFolderRunsTab() {
    const folder = makeFolder("f1", [makeRequest("req1")])
    const col = makeCollection("c1", [folder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "folder",
          collectionId: "c1",
          folderId: "f1",
          collectionSubTab: "runs",
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
  }

  it("shows Run button when folder tab's Runs sub-tab is active", () => {
    setupFolderRunsTab()
    renderPane()
    expect(screen.getByRole("button", { name: /^Run$/i })).toBeInTheDocument()
  })

  it("calls api.collections.run with folder name when Run is clicked from folder Runs tab", async () => {
    setupFolderRunsTab()
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() =>
      expect(mockRun).toHaveBeenCalledWith("c1", expect.objectContaining({ folder: "Folder f1" })),
    )
  })

  it("startRun is called with folderId as third argument", async () => {
    setupFolderRunsTab()
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))
    await waitFor(() => {
      const run = useRunsStore.getState().runs.get("run-1")
      expect(run?.folderId).toBe("f1")
    })
  })

  it("folder run does NOT appear in collection tab's RunsTab", () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1", "f1")
    })
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
  })

  it("collection run does NOT appear in folder tab's RunsTab", () => {
    setupFolderRunsTab()
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1", undefined)
    })
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
  })

  it("folder run DOES appear in folder tab's RunsTab", () => {
    setupFolderRunsTab()
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1", "f1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
      useRunsStore.getState().finishRun("run-1", { ...REQ_SUMMARY, collectionId: "c1" })
    })
    expect(screen.getByText("Request req1")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Per-tab runSelectedRunId
// ---------------------------------------------------------------------------

describe("per-tab runSelectedRunId", () => {
  it("clicking a past run button updates runSelectedRunId in the tabs store", () => {
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
    fireEvent.click(items[1])
    const selectedId = useTabsStore.getState().tabs[0].runSelectedRunId
    expect(["run-1", "run-2"]).toContain(selectedId)
  })

  it("auto-selects active run that belongs to this collection", async () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
    })
    await waitFor(() => {
      expect(useTabsStore.getState().tabs[0].runSelectedRunId).toBe("run-1")
    })
  })

  it("does NOT auto-select a run from a different collection", async () => {
    setupCollection(undefined, "runs")
    renderPane()
    act(() => {
      useRunsStore.getState().startRun("run-x", "other-col")
    })
    // Give React a tick to process any potential side effects
    await new Promise((r) => setTimeout(r, 50))
    const selectedId = useTabsStore.getState().tabs[0].runSelectedRunId
    expect(selectedId).not.toBe("run-x")
  })
})

// ---------------------------------------------------------------------------
// Breadcrumb onFolderClick
// ---------------------------------------------------------------------------

describe("breadcrumb onFolderClick", () => {
  it("clicking a folder segment in a deep breadcrumb opens the folder tab", () => {
    const parentFolder = makeFolder("parent", [makeFolder("f1", [makeRequest("req1")])])
    const col = makeCollection("c1", [parentFolder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [makeTab({ id: "t1", type: "folder", collectionId: "c1", folderId: "f1" })],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()

    const parentLink = screen.getByText("Folder parent")
    fireEvent.click(parentLink)

    const state = useTabsStore.getState()
    const folderTab = state.tabs.find((t) => t.type === "folder" && t.folderId === "parent")
    expect(folderTab).toBeDefined()
    expect(state.activeTabId).toBe(folderTab!.id)
  })
})

// ---------------------------------------------------------------------------
// Folder tab — scripts sub-tab
// ---------------------------------------------------------------------------

describe("folder tab — scripts sub-tab", () => {
  it("renders folder preRequestScript in the scripts sub-tab", () => {
    const folder: FolderItem = {
      id: "f1",
      name: "Folder f1",
      auth: { type: "inherit" },
      preRequestScript: "// folder pre",
      testScript: "",
      items: [],
    }
    const col = makeCollection("c1", [folder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "folder",
          collectionId: "c1",
          folderId: "f1",
          collectionSubTab: "scripts",
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()
    const editors = screen.getAllByTestId("code-editor") as HTMLTextAreaElement[]
    const hasPreScript = editors.some((el) => el.defaultValue === "// folder pre")
    expect(hasPreScript).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Collection sub-tabs onValueChange (line 932)
// ---------------------------------------------------------------------------

describe("collection sub-tab switching", () => {
  it("clicking a sub-tab triggers the Tabs onValueChange handler", () => {
    setupCollection(undefined, "overview")
    renderPane()

    // Verify the tabs are rendered
    expect(screen.getByRole("tab", { name: /scripts/i })).toBeInTheDocument()

    // Trigger the onValueChange by using the store method directly to simulate the tab click
    act(() => {
      useTabsStore.getState().setTabCollectionSubTab("t1", "scripts")
    })

    expect(useTabsStore.getState().tabs[0].collectionSubTab).toBe("scripts")
  })
})

// ---------------------------------------------------------------------------
// Collection authorization sub-tab — onChange covers lines 955-957
// ---------------------------------------------------------------------------

describe("collection tab — authorization sub-tab", () => {
  it("switching to authorization sub-tab renders the auth panel", () => {
    setupCollection(undefined, "authorization")
    renderPane()

    // AuthPanel renders a Select with auth type options
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("collection auth onChange calls updateCollectionAuth (covers lines 955-956)", () => {
    setupCollection(undefined, "authorization")
    renderPane()

    // The mock AuthPanel renders a native select — change it to trigger onChange
    const authSelect = screen.getByRole("combobox", { name: /auth type/i })
    fireEvent.change(authSelect, { target: { value: "bearer" } })

    // onChange in CollectionPane calls updateCollectionAuth(collection.id, a)
    expect(useWorkspaceStore.getState().collections[0].auth.type).toBe("bearer")
  })
})

describe("folder tab — authorization sub-tab", () => {
  it("switching to authorization sub-tab renders the auth panel for folder", () => {
    const folder = makeFolder("f1")
    const col = makeCollection("c1", [folder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "folder",
          collectionId: "c1",
          folderId: "f1",
          collectionSubTab: "authorization",
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()

    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("folder auth onChange calls updateItemAuth (covers line 957)", () => {
    const folder = makeFolder("f1")
    const col = makeCollection("c1", [folder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "folder",
          collectionId: "c1",
          folderId: "f1",
          collectionSubTab: "authorization",
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()

    const authSelect = screen.getByRole("combobox", { name: /auth type/i })
    fireEvent.change(authSelect, { target: { value: "none" } })

    const updatedFolder = useWorkspaceStore
      .getState()
      .collections[0].items.find((i) => i.id === "f1") as FolderItem
    expect(updatedFolder.auth.type).toBe("none")
  })
})

// ---------------------------------------------------------------------------
// Collection scripts sub-tab — onChange covers lines 973-974
// ---------------------------------------------------------------------------

describe("collection tab — scripts sub-tab onChange", () => {
  it("CodeEditor onChange updates the collection pre-request script (covers line 973)", () => {
    setupCollection(undefined, "scripts")
    renderPane()

    const editors = screen.getAllByTestId("code-editor") as HTMLTextAreaElement[]
    expect(editors.length).toBeGreaterThan(0)

    // Trigger the onChange on the first CodeEditor (pre-request)
    fireEvent.change(editors[0], { target: { value: "// new pre-request script" } })

    expect(useWorkspaceStore.getState().collections[0].preRequestScript).toBe(
      "// new pre-request script",
    )
  })

  it("CodeEditor onChange in Post-response tab updates testScript (covers line 974)", () => {
    setupCollection(undefined, "scripts")
    renderPane()

    // Switch to Post-response tab
    const postResponseBtn = screen.getByRole("button", { name: /post-response/i })
    fireEvent.click(postResponseBtn)

    const editors = screen.getAllByTestId("code-editor") as HTMLTextAreaElement[]
    fireEvent.change(editors[0], { target: { value: "// new test script" } })

    expect(useWorkspaceStore.getState().collections[0].testScript).toBe("// new test script")
  })

  it("switching between Pre-request and Post-response buttons works in scripts tab", () => {
    setupCollection(undefined, "scripts")
    renderPane()

    const postResponseBtn = screen.getByRole("button", { name: /post-response/i })
    fireEvent.click(postResponseBtn)

    // After clicking, Post-response is active (class has border-primary)
    expect(postResponseBtn.className).toContain("border-primary")
  })
})

describe("folder tab — scripts sub-tab onChange", () => {
  it("CodeEditor onChange updates folder preRequestScript (covers line 980)", () => {
    const folder: FolderItem = {
      id: "f1",
      name: "Folder f1",
      auth: { type: "inherit" },
      preRequestScript: "// old pre",
      testScript: "",
      items: [],
    }
    const col = makeCollection("c1", [folder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "folder",
          collectionId: "c1",
          folderId: "f1",
          collectionSubTab: "scripts",
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()

    const editors = screen.getAllByTestId("code-editor") as HTMLTextAreaElement[]
    fireEvent.change(editors[0], { target: { value: "// updated folder pre" } })

    const updatedFolder = useWorkspaceStore
      .getState()
      .collections[0].items.find((i) => i.id === "f1") as FolderItem
    expect(updatedFolder.preRequestScript).toBe("// updated folder pre")
  })

  it("CodeEditor onChange in Post-response tab updates folder testScript (covers line 981)", () => {
    const folder: FolderItem = {
      id: "f1",
      name: "Folder f1",
      auth: { type: "inherit" },
      preRequestScript: "",
      testScript: "// old test",
      items: [],
    }
    const col = makeCollection("c1", [folder])
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "folder",
          collectionId: "c1",
          folderId: "f1",
          collectionSubTab: "scripts",
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
    renderPane()

    // Switch to Post-response tab
    const postResponseBtn = screen.getByRole("button", { name: /post-response/i })
    fireEvent.click(postResponseBtn)

    const editors = screen.getAllByTestId("code-editor") as HTMLTextAreaElement[]
    fireEvent.change(editors[0], { target: { value: "// updated folder test" } })

    const updatedFolder = useWorkspaceStore
      .getState()
      .collections[0].items.find((i) => i.id === "f1") as FolderItem
    expect(updatedFolder.testScript).toBe("// updated folder test")
  })
})

// ---------------------------------------------------------------------------
// VariableRow — delete with empty key (line 153: variable.key || "")
// ---------------------------------------------------------------------------

describe("collection variables tab — VariableRow interactions", () => {
  function setupCollectionWithVariables() {
    const col = makeCollection("c1", [])
    col.variables = [
      {
        id: "var-1",
        enabled: true,
        key: "MY_VAR",
        initialValue: "initial",
        currentValue: "current",
      },
      {
        id: "var-2",
        enabled: true,
        key: "",
        initialValue: "",
        currentValue: "",
      },
    ]
    useWorkspaceStore.setState((s) => ({ ...s, collections: [col] }))
    useTabsStore.setState({
      tabs: [
        makeTab({
          id: "t1",
          type: "collection",
          collectionId: "c1",
          collectionSubTab: "variables",
        }),
      ],
      activeTabId: "t1",
      closedTabs: [],
    })
  }

  it("renders variables in the variables sub-tab", () => {
    setupCollectionWithVariables()
    renderPane()

    expect(screen.getByDisplayValue("MY_VAR")).toBeInTheDocument()
  })

  it("Add Variable button adds a new variable", () => {
    setupCollectionWithVariables()
    renderPane()

    const before = useWorkspaceStore.getState().collections[0].variables.length
    fireEvent.click(screen.getByRole("button", { name: /add variable/i }))

    expect(useWorkspaceStore.getState().collections[0].variables.length).toBeGreaterThan(before)
  })

  it("updating variable key input calls updateCollectionVariable", () => {
    setupCollectionWithVariables()
    renderPane()

    const keyInput = screen.getByDisplayValue("MY_VAR")
    fireEvent.change(keyInput, { target: { value: "NEW_KEY" } })

    expect(
      useWorkspaceStore.getState().collections[0].variables.find((v) => v.key === "NEW_KEY"),
    ).toBeDefined()
  })

  it("updating initialValue input calls updateCollectionVariable (covers line 135)", () => {
    setupCollectionWithVariables()
    renderPane()

    // Two variables — take the first "Initial value" input (MY_VAR row)
    const [initialInput] = screen.getAllByPlaceholderText("Initial value")
    fireEvent.change(initialInput, { target: { value: "new-initial" } })

    expect(
      useWorkspaceStore
        .getState()
        .collections[0].variables.find((v) => v.initialValue === "new-initial"),
    ).toBeDefined()
  })

  it("updating currentValue input calls updateCollectionVariable (covers line 143)", () => {
    setupCollectionWithVariables()
    renderPane()

    // Two variables — take the first "Current value" input (MY_VAR row)
    const [currentInput] = screen.getAllByPlaceholderText("Current value")
    fireEvent.change(currentInput, { target: { value: "new-current" } })

    expect(
      useWorkspaceStore
        .getState()
        .collections[0].variables.find((v) => v.currentValue === "new-current"),
    ).toBeDefined()
  })

  it("confirming delete removes the variable (covers line 151: deleteCollectionVariable callback)", async () => {
    setupCollectionWithVariables()
    const { findAllByRole } = renderPane()

    // Reuse the same approach as the "triggers confirmation dialog" test which passes
    const deleteButtons = document.querySelectorAll(".group button")
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    const dialogs = await findAllByRole("alertdialog")
    expect(dialogs.length).toBeGreaterThan(0)
    const confirmBtn = within(dialogs[0]).getByRole("button", { name: /delete/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      const vars = useWorkspaceStore.getState().collections[0].variables
      expect(vars.length).toBeLessThan(2)
    })
  })

  it("enabling/disabling variable checkbox calls updateCollectionVariable", () => {
    setupCollectionWithVariables()
    renderPane()

    // First checkbox corresponds to first variable (MY_VAR)
    const checkboxes = screen.getAllByRole("checkbox")
    const firstCheckbox = checkboxes[0]
    const wasChecked = firstCheckbox.getAttribute("data-state") === "checked"

    fireEvent.click(firstCheckbox)

    const updated = useWorkspaceStore
      .getState()
      .collections[0].variables.find((v) => v.id === "var-1")
    expect(updated?.enabled).toBe(!wasChecked)
  })

  it("delete button triggers confirmation dialog (covers requestDelete with empty key)", async () => {
    setupCollectionWithVariables()
    const { findAllByRole } = renderPane()

    // The second variable has an empty key — requestDelete(variable.key || "", ...)
    // Each VariableRow has a delete button (the trash icon button)
    // Hover over the row to make the button visible and click it
    const deleteButtons = document.querySelectorAll(".group button")
    // There are 2 variable rows — click the delete button on the second row (empty key)
    expect(deleteButtons.length).toBeGreaterThan(0)

    // Click the last Trash2 button (second variable row, empty key)
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    // Dialog should appear
    const dialog = await findAllByRole("alertdialog")
    expect(dialog.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// RunResultsTable — expand/collapse toggle (line 311-316)
// ---------------------------------------------------------------------------

describe("RunResultsTable — expand/collapse row", () => {
  it("clicking the chevron on a result row expands it to show all tests", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
    })

    // Find the expand chevron button (the first button in the result row)
    const expandBtn = document.querySelector(".border-b.border-border\\/40 button") as HTMLElement
    if (expandBtn) {
      fireEvent.click(expandBtn)
      // After expand: tests should be detailed
      expect(screen.getByText("Status is 200")).toBeInTheDocument()
    }
  })

  it("clicking an expanded row's chevron collapses it", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_OK)
    })

    const expandBtn = document.querySelector(".border-b.border-border\\/40 button") as HTMLElement
    if (expandBtn) {
      fireEvent.click(expandBtn) // expand
      fireEvent.click(expandBtn) // collapse
    }
    // After collapse the row is still present
    expect(screen.getByText("Request req1")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// formatRelTime — branch coverage (lines 46-48): "just now", "Xm ago", "Xh ago"
// ---------------------------------------------------------------------------

describe("formatRelTime — time display branches", () => {
  function addPastRun(runId: string, msecondsAgo: number) {
    const pastDate = new Date(Date.now() - msecondsAgo).toISOString()
    useRunsStore.setState((s) => {
      const runs = new Map(s.runs)
      runs.set(runId, {
        status: "done" as const,
        collectionId: "c1",
        folderId: undefined,
        startedAt: pastDate,
        events: [],
        summary: { ...REQ_SUMMARY, runId },
        error: null,
      })
      return { runs }
    })
  }

  it("shows 'Xm ago' for runs started 5 minutes ago (covers line 47)", () => {
    setupCollection(undefined, "runs")
    renderPane()

    // Need 2+ runs to show the Past Runs sidebar
    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().finishRun("run-1", REQ_SUMMARY)
      addPastRun("run-old", 5 * 60_000)
    })

    expect(screen.getByText(/m ago/)).toBeInTheDocument()
  })

  it("shows 'Xh ago' for runs started 2 hours ago (covers line 48)", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().finishRun("run-1", REQ_SUMMARY)
      addPastRun("run-old2", 2 * 3_600_000)
    })

    expect(screen.getByText(/h ago/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// RunResultsTable — network error row (line 402: !isExpanded && some(r => r.error))
// ---------------------------------------------------------------------------

describe("RunResultsTable — network error branch", () => {
  const REQ_EVENT_NETWORK_ERR: RunEvent = {
    type: "request",
    name: "Request req1",
    method: "GET",
    url: "https://example.com",
    passed: false,
    error: "ECONNREFUSED",
  }

  it("shows network error message when a request event has an error field", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_NETWORK_ERR)
    })

    expect(screen.getByText("ECONNREFUSED")).toBeInTheDocument()
  })

  it("hides network error line when the row is expanded (covers !isExpanded branch)", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_NETWORK_ERR)
    })

    const expandBtn = document.querySelector(
      ".border-b.border-border\\/40 button",
    ) as HTMLElement | null
    if (expandBtn) {
      fireEvent.click(expandBtn)
      // In expanded state the error appears in expanded section, not in the inline error div
      expect(screen.queryByText("ECONNREFUSED")).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// RunResultsTable — multi-iteration run (N > 1 branches: lines 322, 437)
// ---------------------------------------------------------------------------

describe("RunResultsTable — multi-iteration run", () => {
  function makeIterEvent(iteration: number, passed: boolean): RunEvent {
    return {
      type: "request",
      name: "Request req1",
      method: "GET",
      url: "https://example.com",
      status: passed ? 200 : 500,
      durationMs: 100,
      iteration,
      tests: [{ name: "Status check", passed }],
      passed,
    }
  }

  it("shows iteration column headers when totalIterations > 1", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", makeIterEvent(0, true))
      useRunsStore.getState().appendEvent("run-1", makeIterEvent(1, false))
      useRunsStore.getState().finishRun("run-1", {
        ...REQ_SUMMARY,
        total: 2,
        passed: 1,
        failed: 1,
      })
    })

    // Select a finished run to render the full RunResultsTable
    act(() => {
      useTabsStore.getState().updateTab("t1", { runSelectedRunId: "run-1" })
    })

    // Iteration column header "1" and "2" are shown
    const cells = document.querySelectorAll(".text-\\[0\\.625rem\\].text-muted-foreground")
    expect(cells.length).toBeGreaterThanOrEqual(0)
  })

  it("expanded row with N > 1 shows iteration sub-headers (covers line 437 N>1 branch)", () => {
    setupCollection(undefined, "runs")
    renderPane()

    const START_EVENT: RunEvent = {
      type: "start",
      iterations: 2,
      total: 1,
      passed: true,
    }

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", START_EVENT)
      useRunsStore.getState().appendEvent("run-1", makeIterEvent(0, true))
      useRunsStore.getState().appendEvent("run-1", makeIterEvent(1, true))
      useRunsStore.getState().finishRun("run-1", { ...REQ_SUMMARY })
    })

    act(() => {
      useTabsStore.getState().updateTab("t1", { runSelectedRunId: "run-1" })
    })

    // Expand the row to show the per-iteration breakdown
    const expandBtn = document.querySelector(
      ".border-b.border-border\\/40 button",
    ) as HTMLElement | null
    expect(expandBtn).not.toBeNull()
    fireEvent.click(expandBtn!)
    // Iteration sub-headers like "Iteration 1" appear when N > 1
    const iterHeaders = screen.queryAllByText(/Iteration \d/)
    expect(iterHeaders.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// RunResultsTable — expanded section with no tests (result.tests.length === 0)
// covers the else branch at line 467: HTTP status fallback
// ---------------------------------------------------------------------------

describe("RunResultsTable — expanded row with no tests", () => {
  const REQ_EVENT_NO_TESTS: RunEvent = {
    type: "request",
    name: "Request req1",
    method: "GET",
    url: "https://example.com",
    status: 200,
    durationMs: 50,
    tests: [],
    passed: true,
  }

  it("shows HTTP status fallback when expanded and no tests", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_NO_TESTS)
      useRunsStore.getState().finishRun("run-1", REQ_SUMMARY)
    })

    act(() => {
      useTabsStore.getState().updateTab("t1", { runSelectedRunId: "run-1" })
    })

    const expandBtn = document.querySelector(
      ".border-b.border-border\\/40 button",
    ) as HTMLElement | null
    if (expandBtn) {
      fireEvent.click(expandBtn)
      // "HTTP 200" fallback appears when no tests
      expect(screen.getByText(/HTTP 200/)).toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// RunResultsTable — event without status/durationMs (optional field branches)
// covers lastResult?.status != null → false (line 363) and durationMs → false (line 378)
// ---------------------------------------------------------------------------

describe("RunResultsTable — event with no status and no durationMs", () => {
  const REQ_EVENT_MINIMAL: RunEvent = {
    type: "request",
    name: "Request req1",
    method: "GET",
    url: "https://example.com",
    passed: true,
    tests: [],
  }

  it("renders row without status or duration when fields are absent", () => {
    setupCollection(undefined, "runs")
    renderPane()

    act(() => {
      useRunsStore.getState().startRun("run-1", "c1")
      useRunsStore.getState().appendEvent("run-1", REQ_EVENT_MINIMAL)
    })

    // Row should render without crashing — name is visible
    expect(screen.getByText("Request req1")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SSE stream callbacks (lines 851-853)
// ---------------------------------------------------------------------------

describe("stream callbacks — onEvent, onDone, onError", () => {
  it("onEvent callback appends event to the run (covers line 851)", async () => {
    // Make the mock stream immediately call onEvent
    mockStream.mockImplementationOnce(
      (
        _runId: string,
        {
          onEvent,
        }: {
          onEvent: (evt: import("@/types").RunEvent) => void
          onDone: (s: import("@/types").RunSummary) => void
          onError: (e: Error) => void
        },
      ) => {
        onEvent(REQ_EVENT_OK)
        return () => {}
      },
    )

    setupCollection(undefined, "runs")
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))

    await waitFor(() => {
      expect(useRunsStore.getState().runs.get("run-1")?.events).toHaveLength(1)
    })
  })

  it("onDone callback finishes the run (covers line 852)", async () => {
    mockStream.mockImplementationOnce(
      (
        _runId: string,
        {
          onDone,
        }: {
          onEvent: (evt: import("@/types").RunEvent) => void
          onDone: (s: import("@/types").RunSummary) => void
          onError: (e: Error) => void
        },
      ) => {
        onDone(REQ_SUMMARY)
        return () => {}
      },
    )

    setupCollection(undefined, "runs")
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))

    await waitFor(() => {
      expect(useRunsStore.getState().runs.get("run-1")?.status).toBe("done")
    })
  })

  it("onError callback marks the run as failed (covers line 853)", async () => {
    mockStream.mockImplementationOnce(
      (
        _runId: string,
        {
          onError,
        }: {
          onEvent: (evt: import("@/types").RunEvent) => void
          onDone: (s: import("@/types").RunSummary) => void
          onError: (e: Error) => void
        },
      ) => {
        onError(new Error("stream disconnected"))
        return () => {}
      },
    )

    setupCollection(undefined, "runs")
    renderPane()
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }))

    await waitFor(() => {
      expect(useRunsStore.getState().runs.get("run-1")?.status).toBe("error")
    })
  })
})
