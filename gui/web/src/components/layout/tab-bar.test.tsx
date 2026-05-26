import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useTabsStore } from "@/store/tabs"
import { TabBar } from "./tab-bar"

vi.mock("@/store/tabs", () => ({
  useTabsStore: vi.fn(),
}))

vi.mock("@/hooks/use-keyboard-shortcut", () => ({
  useKeyboardShortcut: vi.fn(),
}))

const makeTab = (overrides = {}) => ({
  id: "tab-1",
  method: "GET" as const,
  url: "https://example.com/users",
  dirty: false,
  response: null,
  activeSubTab: "Params" as const,
  params: [],
  headers: [],
  pathVars: [],
  bodyType: "none" as const,
  bodyRaw: "",
  bodyRawContentType: "JSON" as const,
  bodyFormData: [],
  bodyUrlencoded: [],
  preRequestScript: "",
  testScript: "",
  followRedirects: true,
  followOriginalMethod: false,
  followAuthorizationHeader: false,
  removeRefererOnRedirect: false,
  maxRedirects: 0,
  sslVerification: true,
  encodeUrl: true,
  disableCookieJar: false,
  httpVersion: "http1" as const,
  timeout: 0,
  ignoreProxy: false,
  ...overrides,
})

const makeStore = (overrides = {}) => ({
  tabs: [makeTab()],
  activeTabId: "tab-1",
  closedTabHistory: [],
  openTab: vi.fn(),
  closeTab: vi.fn(),
  activateTab: vi.fn(),
  updateTab: vi.fn(),
  duplicateTab: vi.fn(),
  closeOthers: vi.fn(),
  closeToRight: vi.fn(),
  reopenLastTab: vi.fn(),
  reorderTabs: vi.fn(),
  ...overrides,
})

describe("TabBar", () => {
  it("renders a new tab button", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore())
    render(<TabBar />)
    expect(screen.getByTitle("New tab (Ctrl+T)")).toBeInTheDocument()
  })

  it("calls openTab when + button is clicked", () => {
    const openTab = vi.fn()
    vi.mocked(useTabsStore).mockReturnValue(makeStore({ openTab }))
    render(<TabBar />)
    fireEvent.click(screen.getByTitle("New tab (Ctrl+T)"))
    expect(openTab).toHaveBeenCalledOnce()
  })

  it("renders tab with method badge", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore())
    render(<TabBar />)
    expect(screen.getByText("GET")).toBeInTheDocument()
  })

  it("renders tab title derived from URL", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore())
    render(<TabBar />)
    expect(screen.getByText("users")).toBeInTheDocument()
  })

  it("calls activateTab when tab is clicked", () => {
    const activateTab = vi.fn()
    vi.mocked(useTabsStore).mockReturnValue(makeStore({ activateTab }))
    render(<TabBar />)
    fireEvent.click(screen.getByRole("tab"))
    expect(activateTab).toHaveBeenCalledWith("tab-1")
  })

  it("calls closeTab when × button is clicked", () => {
    const closeTab = vi.fn()
    vi.mocked(useTabsStore).mockReturnValue(makeStore({ closeTab }))
    render(<TabBar />)
    fireEvent.click(screen.getByTitle("Close tab"))
    expect(closeTab).toHaveBeenCalledWith("tab-1")
  })

  it("shows dirty indicator when tab is dirty", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore({ tabs: [makeTab({ dirty: true })] }))
    const { container } = render(<TabBar />)
    // Dirty dot is a span with borderRadius 50%
    const dot = container.querySelector('[style*="border-radius: 50%"]')
    expect(dot).toBeInTheDocument()
  })

  it("renders multiple tabs", () => {
    vi.mocked(useTabsStore).mockReturnValue(
      makeStore({
        tabs: [makeTab({ id: "t1", url: "/a" }), makeTab({ id: "t2", url: "/b" })],
      }),
    )
    render(<TabBar />)
    expect(screen.getAllByRole("tab")).toHaveLength(2)
  })

  it("shows New Request title for tabs with empty URL", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore({ tabs: [makeTab({ url: "" })] }))
    render(<TabBar />)
    expect(screen.getByText("New Request")).toBeInTheDocument()
  })

  it("opens context menu on right-click", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore())
    render(<TabBar />)
    fireEvent.contextMenu(screen.getByRole("tab"))
    expect(screen.getByText("Duplicate")).toBeInTheDocument()
  })

  it("context menu calls duplicateTab", () => {
    const duplicateTab = vi.fn()
    vi.mocked(useTabsStore).mockReturnValue(makeStore({ duplicateTab }))
    render(<TabBar />)
    fireEvent.contextMenu(screen.getByRole("tab"))
    fireEvent.click(screen.getByText("Duplicate"))
    expect(duplicateTab).toHaveBeenCalledWith("tab-1")
  })

  it("context menu calls closeTab on Close", () => {
    const closeTab = vi.fn()
    vi.mocked(useTabsStore).mockReturnValue(makeStore({ closeTab }))
    render(<TabBar />)
    fireEvent.contextMenu(screen.getByRole("tab"))
    fireEvent.click(screen.getByText("Close"))
    expect(closeTab).toHaveBeenCalledWith("tab-1")
  })

  it("context menu Close others is disabled with single tab", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore())
    render(<TabBar />)
    fireEvent.contextMenu(screen.getByRole("tab"))
    expect(screen.getByText("Close others")).toHaveStyle("opacity: 0.5")
  })

  it("context menu Close others calls closeOthers with multiple tabs", () => {
    const closeOthers = vi.fn()
    vi.mocked(useTabsStore).mockReturnValue(
      makeStore({
        tabs: [makeTab({ id: "t1" }), makeTab({ id: "t2" })],
        closeOthers,
      }),
    )
    render(<TabBar />)
    fireEvent.contextMenu(screen.getAllByRole("tab")[0])
    fireEvent.click(screen.getByText("Close others"))
    expect(closeOthers).toHaveBeenCalledWith("t1")
  })

  it("context menu Close to the right is disabled for last tab", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore())
    render(<TabBar />)
    fireEvent.contextMenu(screen.getByRole("tab"))
    expect(screen.getByText("Close to the right")).toHaveStyle("opacity: 0.5")
  })

  it("context menu calls closeToRight when not last tab", () => {
    const closeToRight = vi.fn()
    vi.mocked(useTabsStore).mockReturnValue(
      makeStore({
        tabs: [makeTab({ id: "t1" }), makeTab({ id: "t2" })],
        closeToRight,
      }),
    )
    render(<TabBar />)
    fireEvent.contextMenu(screen.getAllByRole("tab")[0])
    fireEvent.click(screen.getByText("Close to the right"))
    expect(closeToRight).toHaveBeenCalledWith("t1")
  })

  it("context menu closes when clicking outside", () => {
    vi.mocked(useTabsStore).mockReturnValue(makeStore())
    render(<TabBar />)
    fireEvent.contextMenu(screen.getByRole("tab"))
    expect(screen.getByText("Duplicate")).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText("Duplicate")).not.toBeInTheDocument()
  })

  it("renders env tab with globe badge instead of method badge", () => {
    vi.mocked(useTabsStore).mockReturnValue(
      makeStore({
        tabs: [makeTab({ id: "e1", type: "environment", envId: "env-1" })],
      }),
    )
    render(<TabBar />)
    expect(screen.queryByText("GET")).not.toBeInTheDocument()
  })

  it("renders globals tab with Globals label", () => {
    vi.mocked(useTabsStore).mockReturnValue(
      makeStore({
        tabs: [makeTab({ id: "g1", type: "globals" })],
      }),
    )
    render(<TabBar />)
    expect(screen.getByText("Globals")).toBeInTheDocument()
  })
})
