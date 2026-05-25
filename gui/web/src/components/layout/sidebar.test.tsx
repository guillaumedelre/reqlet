import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useUIStore } from "@/store/ui"
import { Sidebar } from "./sidebar"

vi.mock("@/store/ui", () => ({
  useUIStore: vi.fn(),
}))

const makeStore = (overrides = {}) => ({
  sidebarCollapsed: false,
  searchOpen: false,
  toggleSidebar: vi.fn(),
  setSearchOpen: vi.fn(),
  ...overrides,
})

describe("Sidebar", () => {
  it("shows Collections label when expanded", () => {
    vi.mocked(useUIStore).mockReturnValue(makeStore())
    render(<Sidebar />)
    expect(screen.getByText("Collections")).toBeInTheDocument()
  })

  it("shows collapse button when expanded", () => {
    vi.mocked(useUIStore).mockReturnValue(makeStore())
    render(<Sidebar />)
    expect(screen.getByTitle("Collapse sidebar")).toBeInTheDocument()
  })

  it("hides Collections label when collapsed", () => {
    vi.mocked(useUIStore).mockReturnValue(makeStore({ sidebarCollapsed: true }))
    render(<Sidebar />)
    expect(screen.queryByText("Collections")).not.toBeInTheDocument()
  })

  it("shows expand button when collapsed", () => {
    vi.mocked(useUIStore).mockReturnValue(makeStore({ sidebarCollapsed: true }))
    render(<Sidebar />)
    expect(screen.getByTitle("Expand sidebar")).toBeInTheDocument()
  })

  it("calls toggleSidebar when toggle button is clicked", () => {
    const toggleSidebar = vi.fn()
    vi.mocked(useUIStore).mockReturnValue(makeStore({ toggleSidebar }))
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle("Collapse sidebar"))
    expect(toggleSidebar).toHaveBeenCalledOnce()
  })

  it("shows placeholder text when expanded", () => {
    vi.mocked(useUIStore).mockReturnValue(makeStore())
    render(<Sidebar />)
    expect(screen.getByText("No collections yet.")).toBeInTheDocument()
  })

  it("hides placeholder text when collapsed", () => {
    vi.mocked(useUIStore).mockReturnValue(makeStore({ sidebarCollapsed: true }))
    render(<Sidebar />)
    expect(screen.queryByText("No collections yet.")).not.toBeInTheDocument()
  })
})
