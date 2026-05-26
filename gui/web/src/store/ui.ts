import { create } from "zustand"
import { persist } from "zustand/middleware"

export type SidebarSection = "collections" | "environments" | "history"

interface UIState {
  sidebarCollapsed: boolean
  sidebarSection: SidebarSection
  searchOpen: boolean
  toggleSidebar: () => void
  setSidebarSection: (s: SidebarSection) => void
  setSearchOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarSection: "collections",
      searchOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarSection: (sidebarSection) => set({ sidebarSection }),
      setSearchOpen: (open) => set({ searchOpen: open }),
    }),
    { name: "reqlet-ui" },
  ),
)
