import { create } from "zustand"
import { persist } from "zustand/middleware"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
export type RequestSubTab = "Params" | "Auth" | "Headers" | "Body" | "Scripts"

export interface Tab {
  id: string
  method: HttpMethod
  url: string
  dirty: boolean
  activeSubTab: RequestSubTab
}

function newTab(patch?: Partial<Tab>): Tab {
  return {
    id: crypto.randomUUID(),
    method: "GET",
    url: "",
    dirty: false,
    activeSubTab: "Params",
    ...patch,
  }
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  closedTabHistory: Tab[]
  openTab: () => void
  closeTab: (id: string) => void
  activateTab: (id: string) => void
  duplicateTab: (id: string) => void
  reopenLastTab: () => void
  updateTab: (
    id: string,
    patch: Partial<Pick<Tab, "method" | "url" | "dirty" | "activeSubTab">>,
  ) => void
}

const initial = newTab()

export const useTabsStore = create<TabsState>()(
  persist(
    (set) => ({
      tabs: [initial],
      activeTabId: initial.id,
      closedTabHistory: [],

      openTab: () =>
        set((s) => {
          const tab = newTab()
          return { tabs: [...s.tabs, tab], activeTabId: tab.id }
        }),

      closeTab: (id) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id)
          if (idx === -1) return s
          const closed = s.tabs[idx]
          const remaining = s.tabs.filter((t) => t.id !== id)
          const history = [closed, ...s.closedTabHistory].slice(0, 20)
          if (remaining.length === 0) {
            const tab = newTab()
            return { tabs: [tab], activeTabId: tab.id, closedTabHistory: history }
          }
          let activeTabId = s.activeTabId
          if (activeTabId === id) {
            activeTabId = (remaining[idx] ?? remaining[idx - 1]).id
          }
          return { tabs: remaining, activeTabId, closedTabHistory: history }
        }),

      activateTab: (id) => set({ activeTabId: id }),

      duplicateTab: (id) =>
        set((s) => {
          const source = s.tabs.find((t) => t.id === id)
          if (!source) return s
          const dup = { ...source, id: crypto.randomUUID() }
          const idx = s.tabs.findIndex((t) => t.id === id)
          const tabs = [...s.tabs.slice(0, idx + 1), dup, ...s.tabs.slice(idx + 1)]
          return { tabs, activeTabId: dup.id }
        }),

      reopenLastTab: () =>
        set((s) => {
          const [tab, ...rest] = s.closedTabHistory
          if (!tab) return s
          return { tabs: [...s.tabs, tab], activeTabId: tab.id, closedTabHistory: rest }
        }),

      updateTab: (id, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
    }),
    { name: "reqlet-tabs" },
  ),
)
