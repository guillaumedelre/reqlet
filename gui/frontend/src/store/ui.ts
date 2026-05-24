import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UIState {
  sidebarCollapsed: boolean
  searchOpen: boolean
  toggleSidebar: () => void
  setSearchOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      searchOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSearchOpen: (open) => set({ searchOpen: open }),
    }),
    { name: "reqlet-ui" },
  ),
)
