import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TabBar } from "./tab-bar"
import { useTabsStore } from "@/store/tabs"
import { DEFAULT_REQUEST } from "@/types"
import type { Tab } from "@/types"

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: "tab-1",
    type: "request",
    title: "New Request",
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

function setup(tabs: Tab[], activeTabId = tabs[0]?.id ?? "") {
  useTabsStore.setState({ tabs, activeTabId, closedTabs: [] })
}

function renderBar() {
  return render(
    <TooltipProvider>
      <TabBar />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("rendering", () => {
  it("renders tab title", () => {
    setup([makeTab({ title: "My Request" })])
    renderBar()
    expect(screen.getByText("My Request")).toBeInTheDocument()
  })

  it("renders method badge text for request tab", () => {
    setup([makeTab({ request: { ...DEFAULT_REQUEST, method: "POST" } })])
    renderBar()
    expect(screen.getByText("POST")).toBeInTheDocument()
  })

  it("renders multiple tabs", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })])
    renderBar()
    expect(screen.getByText("First")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
  })

  it("renders a close button for each tab", () => {
    setup([makeTab({ id: "t1" }), makeTab({ id: "t2", title: "Other" })])
    renderBar()
    expect(screen.getAllByLabelText("Close tab")).toHaveLength(2)
  })

  it("renders new tab button", () => {
    setup([makeTab()])
    renderBar()
    expect(screen.getByLabelText("New tab")).toBeInTheDocument()
  })

  it("shows dirty indicator (orange dot) for dirty tab", () => {
    setup([makeTab({ dirty: true })])
    const { container } = renderBar()
    expect(container.querySelector(".bg-orange-400")).toBeInTheDocument()
  })

  it("does not show dirty indicator for clean tab", () => {
    setup([makeTab({ dirty: false })])
    const { container } = renderBar()
    expect(container.querySelector(".bg-orange-400")).not.toBeInTheDocument()
  })

  it("renders icon for collection tab type", () => {
    setup([makeTab({ type: "collection", title: "My Collection" })])
    const { container } = renderBar()
    expect(screen.getByText("My Collection")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("renders icon for folder tab type", () => {
    setup([makeTab({ type: "folder", title: "My Folder" })])
    const { container } = renderBar()
    expect(screen.getByText("My Folder")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("renders icon for environment tab type", () => {
    setup([makeTab({ type: "environment", title: "Prod", environmentId: "env-1" })])
    const { container } = renderBar()
    expect(screen.getByText("Prod")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("renders icon for globals tab type", () => {
    setup([makeTab({ type: "globals", title: "Globals" })])
    const { container } = renderBar()
    expect(screen.getByText("Globals")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tab selection
// ---------------------------------------------------------------------------

describe("tab selection", () => {
  it("changes activeTabId when a tab is clicked", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })], "t1")
    renderBar()

    fireEvent.click(screen.getByText("Second"))

    expect(useTabsStore.getState().activeTabId).toBe("t2")
  })
})

// ---------------------------------------------------------------------------
// New tab button
// ---------------------------------------------------------------------------

describe("new tab button", () => {
  it("adds a tab when clicked", () => {
    setup([makeTab()])
    renderBar()

    const before = useTabsStore.getState().tabs.length
    fireEvent.click(screen.getByLabelText("New tab"))

    expect(useTabsStore.getState().tabs.length).toBeGreaterThan(before)
  })
})

// ---------------------------------------------------------------------------
// Close — clean tab
// ---------------------------------------------------------------------------

describe("close — clean tab", () => {
  it("closes immediately without showing a dialog", () => {
    setup([makeTab({ id: "t1", dirty: false })])
    renderBar()

    fireEvent.click(screen.getByLabelText("Close tab"))

    expect(useTabsStore.getState().tabs.find((t) => t.id === "t1")).toBeUndefined()
    expect(screen.queryByText("Close without saving?")).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Close — dirty tab (unsaved changes dialog)
// ---------------------------------------------------------------------------

describe("close — dirty tab (unsaved changes dialog)", () => {
  it("shows 'Close without saving?' dialog when tab is dirty", () => {
    setup([makeTab({ dirty: true })])
    renderBar()

    fireEvent.click(screen.getByLabelText("Close tab"))

    expect(screen.getByText("Close without saving?")).toBeInTheDocument()
  })

  it("dialog shows 'Close anyway' and 'Keep editing' buttons", () => {
    setup([makeTab({ dirty: true })])
    renderBar()

    fireEvent.click(screen.getByLabelText("Close tab"))

    expect(screen.getByRole("button", { name: /close anyway/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /keep editing/i })).toBeInTheDocument()
  })

  it("dialog message includes the tab title for a single dirty tab", () => {
    setup([makeTab({ title: "My API", dirty: true })])
    renderBar()

    fireEvent.click(screen.getByLabelText("Close tab"))

    expect(screen.getByText(/"My API" has unsaved changes/)).toBeInTheDocument()
  })

  it("'Close anyway' closes the tab", () => {
    setup([makeTab({ id: "t1", dirty: true })])
    renderBar()

    fireEvent.click(screen.getByLabelText("Close tab"))
    fireEvent.click(screen.getByRole("button", { name: /close anyway/i }))

    expect(useTabsStore.getState().tabs.find((t) => t.id === "t1")).toBeUndefined()
  })

  it("'Keep editing' leaves the tab open", () => {
    setup([makeTab({ id: "t1", dirty: true })])
    renderBar()

    fireEvent.click(screen.getByLabelText("Close tab"))
    fireEvent.click(screen.getByRole("button", { name: /keep editing/i }))

    expect(useTabsStore.getState().tabs.find((t) => t.id === "t1")).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

describe("context menu", () => {
  it("opens on right-click and shows expected actions", () => {
    setup([makeTab({ title: "My Request" })])
    renderBar()

    fireEvent.contextMenu(screen.getByText("My Request"))

    expect(screen.getByText("Duplicate Tab")).toBeInTheDocument()
    expect(screen.getByText("Close Other Tabs")).toBeInTheDocument()
    expect(screen.getByText("Close Tabs to the Right")).toBeInTheDocument()
    expect(screen.getByText("Close Tab")).toBeInTheDocument()
  })

  it("duplicates the tab", () => {
    setup([makeTab({ id: "t1", title: "My Request" })])
    renderBar()

    fireEvent.contextMenu(screen.getByText("My Request"))
    fireEvent.click(screen.getByText("Duplicate Tab"))

    expect(useTabsStore.getState().tabs).toHaveLength(2)
  })

  it("closes tab via context menu (clean tab, no dialog)", () => {
    setup([makeTab({ id: "t1", title: "My Request", dirty: false })])
    renderBar()

    fireEvent.contextMenu(screen.getByText("My Request"))
    fireEvent.click(screen.getByText("Close Tab"))

    expect(useTabsStore.getState().tabs.find((t) => t.id === "t1")).toBeUndefined()
  })

  it("closes other tabs (all clean)", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })], "t1")
    renderBar()

    fireEvent.contextMenu(screen.getByText("First"))
    fireEvent.click(screen.getByText("Close Other Tabs"))

    const tabs = useTabsStore.getState().tabs
    expect(tabs.find((t) => t.id === "t1")).toBeDefined()
    expect(tabs.find((t) => t.id === "t2")).toBeUndefined()
  })

  it("closes tabs to the right (all clean)", () => {
    setup(
      [
        makeTab({ id: "t1", title: "First" }),
        makeTab({ id: "t2", title: "Second" }),
        makeTab({ id: "t3", title: "Third" }),
      ],
      "t1",
    )
    renderBar()

    fireEvent.contextMenu(screen.getByText("First"))
    fireEvent.click(screen.getByText("Close Tabs to the Right"))

    const tabs = useTabsStore.getState().tabs
    expect(tabs.find((t) => t.id === "t1")).toBeDefined()
    expect(tabs.find((t) => t.id === "t2")).toBeUndefined()
    expect(tabs.find((t) => t.id === "t3")).toBeUndefined()
  })

  it("shows dirty-tab dialog when closing other tabs that have unsaved changes", () => {
    setup(
      [
        makeTab({ id: "t1", title: "First" }),
        makeTab({ id: "t2", title: "Second", dirty: true }),
        makeTab({ id: "t3", title: "Third", dirty: true }),
      ],
      "t1",
    )
    renderBar()

    fireEvent.contextMenu(screen.getByText("First"))
    fireEvent.click(screen.getByText("Close Other Tabs"))

    expect(screen.getByText(/2 tabs have unsaved changes/)).toBeInTheDocument()
  })

  it("shows dirty-tab dialog when closing tabs to the right that have unsaved changes", () => {
    setup(
      [makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second", dirty: true })],
      "t1",
    )
    renderBar()

    fireEvent.contextMenu(screen.getByText("First"))
    fireEvent.click(screen.getByText("Close Tabs to the Right"))

    expect(screen.getByText("Close without saving?")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Drag and drop
// ---------------------------------------------------------------------------

const mockDataTransfer = {
  effectAllowed: "none" as DataTransfer["effectAllowed"],
  dropEffect: "none" as DataTransfer["dropEffect"],
  setData: () => {},
  getData: () => "",
}

describe("drag and drop", () => {
  it("reorders tabs when dragging and dropping", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })], "t1")
    renderBar()

    const tab1 = screen.getByText("First").closest("[draggable]") as HTMLElement
    const tab2 = screen.getByText("Second").closest("[draggable]") as HTMLElement

    fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer })
    fireEvent.dragOver(tab2, { dataTransfer: mockDataTransfer })
    fireEvent.drop(tab2, { dataTransfer: mockDataTransfer })

    const tabs = useTabsStore.getState().tabs
    expect(tabs[0].id).toBe("t2")
    expect(tabs[1].id).toBe("t1")
  })

  it("does not reorder when dropping on same tab", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })], "t1")
    renderBar()

    const tab1 = screen.getByText("First").closest("[draggable]") as HTMLElement

    fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer })
    fireEvent.drop(tab1, { dataTransfer: mockDataTransfer })

    const tabs = useTabsStore.getState().tabs
    expect(tabs[0].id).toBe("t1")
  })

  it("clears drag state on drag end", () => {
    setup([makeTab({ id: "t1", title: "First" })], "t1")
    renderBar()

    const tab1 = screen.getByText("First").closest("[draggable]") as HTMLElement

    fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer })
    fireEvent.dragEnd(tab1)

    expect(useTabsStore.getState().activeTabId).toBe("t1")
  })

  it("drag leave does not reset dragOver when hovering a different tab", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })], "t1")
    renderBar()

    const tab1 = screen.getByText("First").closest("[draggable]") as HTMLElement
    const tab2 = screen.getByText("Second").closest("[draggable]") as HTMLElement

    fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer })
    fireEvent.dragOver(tab2, { dataTransfer: mockDataTransfer })
    // Leave tab1 while dragging over tab2 — should not clear tab2 hover state
    fireEvent.dragLeave(tab1)
    fireEvent.drop(tab2, { dataTransfer: mockDataTransfer })

    const tabs = useTabsStore.getState().tabs
    expect(tabs[0].id).toBe("t2")
  })

  it("dragOver on source tab does not set dragOverId", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })], "t1")
    renderBar()

    const tab1 = screen.getByText("First").closest("[draggable]") as HTMLElement

    fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer })
    // Dragging over itself: dragSrcIdRef.current === tab.id, so no state update
    fireEvent.dragOver(tab1, { dataTransfer: mockDataTransfer })

    // Tab order unchanged (no reorder triggered)
    const tabs = useTabsStore.getState().tabs
    expect(tabs[0].id).toBe("t1")
  })

  it("dragLeave on the hovered tab clears dragOver state", () => {
    setup([makeTab({ id: "t1", title: "First" }), makeTab({ id: "t2", title: "Second" })], "t1")
    renderBar()

    const tab1 = screen.getByText("First").closest("[draggable]") as HTMLElement
    const tab2 = screen.getByText("Second").closest("[draggable]") as HTMLElement

    fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer })
    fireEvent.dragOver(tab2, { dataTransfer: mockDataTransfer })
    // Leave tab2 while it is the current hover target — clears dragOver
    fireEvent.dragLeave(tab2)

    // Drop should still work (dragSrcIdRef not cleared by dragLeave)
    fireEvent.drop(tab2, { dataTransfer: mockDataTransfer })
    const tabs = useTabsStore.getState().tabs
    expect(tabs[0].id).toBe("t2")
  })
})
