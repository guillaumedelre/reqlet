import { afterEach, describe, expect, it } from "vitest"
import { useUIStore } from "./ui"

afterEach(() => {
  useUIStore.setState({ sidebarCollapsed: false, sidebarSection: "collections", searchOpen: false })
})

describe("useUIStore", () => {
  describe("toggleSidebar", () => {
    it("collapses when expanded", () => {
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    it("expands when collapsed", () => {
      useUIStore.setState({ sidebarCollapsed: true })
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })
  })

  describe("setSidebarSection", () => {
    it("updates the sidebar section", () => {
      useUIStore.getState().setSidebarSection("environments")
      expect(useUIStore.getState().sidebarSection).toBe("environments")
    })

    it("switches back to collections", () => {
      useUIStore.setState({ sidebarSection: "history" })
      useUIStore.getState().setSidebarSection("collections")
      expect(useUIStore.getState().sidebarSection).toBe("collections")
    })
  })

  describe("setSearchOpen", () => {
    it("opens the search modal", () => {
      useUIStore.getState().setSearchOpen(true)
      expect(useUIStore.getState().searchOpen).toBe(true)
    })

    it("closes the search modal", () => {
      useUIStore.setState({ searchOpen: true })
      useUIStore.getState().setSearchOpen(false)
      expect(useUIStore.getState().searchOpen).toBe(false)
    })
  })
})
