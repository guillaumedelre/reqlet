import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Tab,
  RequestState,
  RequestSubTab,
  ResponseSubTab,
  RequestItem,
  Collection,
  FolderItem,
  Environment,
  CollectionSubTab,
  FolderSubTab,
} from "@/types"
import { DEFAULT_REQUEST } from "@/types"

function nextId(): string {
  return `t-${crypto.randomUUID().slice(0, 8)}`
}

const TAB_DEFAULTS = {
  request: { ...DEFAULT_REQUEST },
  isSending: false,
  response: null,
  requestSubTab: "params" as RequestSubTab,
  responseSubTab: "body" as ResponseSubTab,
  collectionSubTab: "overview" as CollectionSubTab | FolderSubTab,
  runOptions: { iterations: 1, delayMs: 0, bail: false },
  runSelectedRunId: null,
}

function newRequestTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: nextId(),
    type: "request",
    title: "New Request",
    dirty: false,
    ...TAB_DEFAULTS,
    ...overrides,
  }
}

const INITIAL_TAB = newRequestTab({ id: "tab-init" })

interface TabsState {
  tabs: Tab[]
  activeTabId: string
  closedTabs: Tab[]
  setActiveTab: (id: string) => void
  reopenLastClosedTab: () => void
  openRequestTab: (request: RequestItem) => void
  openEnvironmentTab: (env: Environment) => void
  openGlobalsTab: () => void
  openCollectionTab: (collection: Collection) => void
  openFolderTab: (folder: FolderItem, collectionId: string) => void
  openNewTab: () => void
  closeTab: (id: string) => void
  duplicateTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeTabsToRight: (id: string) => void
  reorderTabs: (fromIdx: number, toIdx: number) => void
  updateTab: (id: string, patch: Partial<Tab>) => void
  updateTabRequest: (id: string, updater: (r: RequestState) => RequestState) => void
  setTabSubTab: (id: string, tab: RequestSubTab) => void
  setTabResponseSubTab: (id: string, tab: ResponseSubTab) => void
  setTabCollectionSubTab: (id: string, sub: CollectionSubTab | FolderSubTab) => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [INITIAL_TAB],
      activeTabId: INITIAL_TAB.id,
      closedTabs: [],

      setActiveTab: (id) => set({ activeTabId: id }),

      reopenLastClosedTab: () => {
        const { closedTabs, tabs } = get()
        if (closedTabs.length === 0) return
        const last = closedTabs[closedTabs.length - 1]
        const restored = { ...last, id: nextId() }
        set({
          tabs: [...tabs, restored],
          activeTabId: restored.id,
          closedTabs: closedTabs.slice(0, -1),
        })
      },

      openCollectionTab: (collection: Collection) => {
        const { tabs } = get()
        const existing = tabs.find(
          (t) => t.type === "collection" && t.collectionId === collection.id,
        )
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const tab: Tab = {
          id: nextId(),
          type: "collection",
          title: collection.name,
          dirty: false,
          collectionId: collection.id,
          ...TAB_DEFAULTS,
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
      },

      openFolderTab: (folder: FolderItem, collectionId: string) => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.type === "folder" && t.folderId === folder.id)
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const tab: Tab = {
          id: nextId(),
          type: "folder",
          title: folder.name,
          dirty: false,
          folderId: folder.id,
          collectionId,
          ...TAB_DEFAULTS,
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
      },

      openGlobalsTab: () => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.type === "globals")
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const tab: Tab = {
          id: nextId(),
          type: "globals",
          title: "Globals",
          dirty: false,
          ...TAB_DEFAULTS,
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
      },

      openEnvironmentTab: (env: Environment) => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.type === "environment" && t.environmentId === env.id)
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const tab: Tab = {
          id: nextId(),
          type: "environment",
          title: env.name,
          dirty: false,
          environmentId: env.id,
          ...TAB_DEFAULTS,
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
      },

      openRequestTab: (item: RequestItem) => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.requestId === item.id)
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const tab = newRequestTab({
          title: item.name,
          requestId: item.id,
          request: {
            method: item.method,
            url: item.url,
            params: item.params,
            headers: item.headers,
            body: item.body,
            auth: item.auth,
            preRequestScript: item.preRequestScript,
            testScript: item.testScript,
          },
        })
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
      },

      openNewTab: () => {
        const tab = newRequestTab()
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
      },

      duplicateTab: (id) => {
        const { tabs } = get()
        const idx = tabs.findIndex((t) => t.id === id)
        if (idx === -1) return
        const copy = { ...tabs[idx], id: nextId(), dirty: false }
        const next = [...tabs.slice(0, idx + 1), copy, ...tabs.slice(idx + 1)]
        set({ tabs: next, activeTabId: copy.id })
      },

      closeOtherTabs: (id) => {
        const { tabs, closedTabs } = get()
        const kept = tabs.find((t) => t.id === id)
        if (!kept) return
        const closed = tabs.filter((t) => t.id !== id)
        const nextClosed = [...closedTabs, ...closed].slice(-10)
        set({ tabs: [kept], activeTabId: kept.id, closedTabs: nextClosed })
      },

      closeTabsToRight: (id) => {
        const { tabs, activeTabId, closedTabs } = get()
        const idx = tabs.findIndex((t) => t.id === id)
        if (idx === -1) return
        const kept = tabs.slice(0, idx + 1)
        const closed = tabs.slice(idx + 1)
        if (closed.length === 0) return
        const nextClosed = [...closedTabs, ...closed].slice(-10)
        const nextActive = kept.some((t) => t.id === activeTabId)
          ? activeTabId
          : kept[kept.length - 1].id
        set({ tabs: kept, activeTabId: nextActive, closedTabs: nextClosed })
      },

      reorderTabs: (fromIdx, toIdx) => {
        const { tabs } = get()
        if (fromIdx === toIdx) return
        const next = [...tabs]
        const [moved] = next.splice(fromIdx, 1)
        next.splice(toIdx, 0, moved)
        set({ tabs: next })
      },

      closeTab: (id) => {
        const { tabs, activeTabId, closedTabs } = get()
        const tab = tabs.find((t) => t.id === id)
        const idx = tabs.findIndex((t) => t.id === id)
        const remaining = tabs.filter((t) => t.id !== id)
        const nextClosed = tab ? [...closedTabs.slice(-9), tab] : closedTabs
        if (remaining.length === 0) {
          set({ tabs: [], activeTabId: "", closedTabs: nextClosed })
          return
        }
        const nextActive =
          activeTabId === id ? remaining[Math.min(idx, remaining.length - 1)].id : activeTabId
        set({ tabs: remaining, activeTabId: nextActive, closedTabs: nextClosed })
      },

      updateTab: (id, patch) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      updateTabRequest: (id, updater) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, request: updater(t.request), dirty: true } : t,
          ),
        })),

      setTabSubTab: (id, tab) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, requestSubTab: tab } : t)) })),

      setTabResponseSubTab: (id, tab) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, responseSubTab: tab } : t)),
        })),

      setTabCollectionSubTab: (id, sub) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, collectionSubTab: sub } : t)),
        })),
    }),
    {
      name: "reqlet-tabs",
      partialize: (state) => ({
        tabs: state.tabs.map((t) => ({ ...t, isSending: false })),
        activeTabId: state.activeTabId,
        // closedTabs is session-only, not persisted
      }),
    },
  ),
)
