import { create } from "zustand"
import { persist } from "zustand/middleware"

export type SidePanel = "collections" | "environments" | "history"

interface UiState {
  activePanel: SidePanel | null
  setActivePanel: (panel: SidePanel | null) => void
  togglePanel: (panel: SidePanel) => void

  activeEnvironmentId: string | null
  setActiveEnvironment: (id: string | null) => void

  searchOpen: boolean
  setSearchOpen: (open: boolean) => void

  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activePanel: "collections",
      setActivePanel: (panel) => set({ activePanel: panel }),
      togglePanel: (panel) => set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),

      activeEnvironmentId: "env-dev",
      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),

      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
    }),
    {
      name: "reqlet-ui",
      partialize: (s) => ({
        activePanel: s.activePanel,
        activeEnvironmentId: s.activeEnvironmentId,
      }),
    },
  ),
)
