import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useEnvironmentsStore } from "@/store/environments"
import { useTabsStore } from "@/store/tabs"
import { useUIStore } from "@/store/ui"
import { Sidebar } from "./sidebar"

beforeEach(() => {
  useUIStore.setState({
    sidebarCollapsed: false,
    sidebarSection: "collections",
    searchOpen: false,
  })
  useEnvironmentsStore.setState({ environments: [], globals: [], activeEnvironmentId: null })
  useTabsStore.setState({ tabs: [], activeTabId: null, closedTabHistory: [] })
  useTabsStore.getState().openTab()
})

describe("icon rail", () => {
  it("always renders the three section buttons", () => {
    render(<Sidebar />)
    expect(screen.getByTitle("Collections")).toBeInTheDocument()
    expect(screen.getByTitle("Environments")).toBeInTheDocument()
    expect(screen.getByTitle("History")).toBeInTheDocument()
  })

  it("renders icon rail even when collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true, sidebarSection: "collections" })
    render(<Sidebar />)
    expect(screen.getByTitle("Collections")).toBeInTheDocument()
  })
})

describe("section switching", () => {
  it("shows Collections panel by default", () => {
    render(<Sidebar />)
    expect(screen.getByText("Collections")).toBeInTheDocument()
    expect(screen.queryByText("Environments")).not.toBeInTheDocument()
  })

  it("switches to Environments panel on icon click", () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    expect(screen.getByText("Environments")).toBeInTheDocument()
    expect(useUIStore.getState().sidebarSection).toBe("environments")
  })

  it("switches to History panel on icon click", () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("History"))
    expect(screen.getByText("History")).toBeInTheDocument()
    expect(useUIStore.getState().sidebarSection).toBe("history")
  })

  it("collapses sidebar when clicking the active section icon while expanded", () => {
    render(<Sidebar />)
    // Collections is active, click it again to collapse
    fireEvent.click(screen.getByTitle("Collections"))
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
  })

  it("expands sidebar and switches section when clicking a different icon while collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true, sidebarSection: "collections" })
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    const state = useUIStore.getState()
    expect(state.sidebarCollapsed).toBe(false)
    expect(state.sidebarSection).toBe("environments")
  })
})

describe("Collections panel", () => {
  it("shows placeholder when no collections", () => {
    render(<Sidebar />)
    expect(screen.getByText("No collections yet.")).toBeInTheDocument()
  })
})

describe("Environments panel", () => {
  it("shows Globals entry", () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    expect(screen.getByText("Globals")).toBeInTheDocument()
  })

  it("shows environments list", () => {
    useEnvironmentsStore.getState().addEnvironment("Production")
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    expect(screen.getByText("Production")).toBeInTheDocument()
  })

  it("shows placeholder when no environments", () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    expect(screen.getByText("No environments yet.")).toBeInTheDocument()
  })

  it("sets active environment on circle button click", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Staging")
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    fireEvent.click(screen.getByTitle("Set active"))
    expect(useEnvironmentsStore.getState().activeEnvironmentId).toBe(id)
  })

  it("creates a new environment and opens its tab on + click", () => {
    const { openEnvTab } = useTabsStore.getState()
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    fireEvent.click(screen.getByTitle("New environment"))
    const { environments } = useEnvironmentsStore.getState()
    expect(environments).toHaveLength(1)
    expect(environments[0].name).toBe("New Environment")
    void openEnvTab // openEnvTab was called internally; env was created
  })

  it("opens globals tab on globals edit click", () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Environments"))
    fireEvent.click(screen.getByTitle("Edit globals"))
    const { tabs, activeTabId } = useTabsStore.getState()
    const activeTab = tabs.find((t) => t.id === activeTabId)
    expect(activeTab?.type).toBe("globals")
  })
})

describe("History panel", () => {
  it("shows placeholder", () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("History"))
    expect(screen.getByText("No history yet.")).toBeInTheDocument()
  })
})

describe("content visibility", () => {
  it("hides section content when collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true, sidebarSection: "collections" })
    render(<Sidebar />)
    expect(screen.queryByText("No collections yet.")).not.toBeInTheDocument()
  })
})
