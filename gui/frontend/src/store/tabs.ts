import { create } from "zustand"
import { persist } from "zustand/middleware"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
export type RequestSubTab = "Params" | "Auth" | "Headers" | "Body" | "Scripts" | "Settings"
export type BodyType = "none" | "raw" | "form-data" | "urlencoded" | "binary" | "GraphQL"
export type RawContentType = "JSON" | "XML" | "Text" | "HTML" | "JavaScript"

export interface KeyValueItem {
  id: string
  key: string
  value: string
  enabled: boolean
  type?: "text" | "file"
}

export interface ResponseData {
  status: number
  statusText: string
  time: number
  size: number
  headers: Record<string, string>
  body: string
  contentType: string
}

export interface Tab {
  id: string
  method: HttpMethod
  url: string
  params: KeyValueItem[]
  headers: KeyValueItem[]
  pathVars: KeyValueItem[]
  bodyType: BodyType
  bodyRaw: string
  bodyRawContentType: RawContentType
  bodyFormData: KeyValueItem[]
  bodyUrlencoded: KeyValueItem[]
  response: ResponseData | null
  dirty: boolean
  activeSubTab: RequestSubTab
  followRedirects: boolean
  sslVerification: boolean
  timeout: number
}

function newTab(patch?: Partial<Tab>): Tab {
  return {
    id: crypto.randomUUID(),
    method: "GET",
    url: "",
    params: [],
    headers: [],
    pathVars: [],
    bodyType: "none",
    bodyRaw: "",
    bodyRawContentType: "JSON",
    bodyFormData: [],
    bodyUrlencoded: [],
    response: null,
    dirty: false,
    activeSubTab: "Params",
    followRedirects: true,
    sslVerification: true,
    timeout: 0,
    ...patch,
  }
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  closedTabHistory: Tab[]
  openTab: () => void
  closeTab: (id: string) => void
  closeOthers: (id: string) => void
  closeToRight: (id: string) => void
  activateTab: (id: string) => void
  duplicateTab: (id: string) => void
  reopenLastTab: () => void
  reorderTabs: (fromId: string, toId: string) => void
  updateTab: (id: string, patch: Partial<Omit<Tab, "id">>) => void
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

      closeOthers: (id) =>
        set((s) => {
          const tab = s.tabs.find((t) => t.id === id)
          if (!tab) return s
          const closing = s.tabs.filter((t) => t.id !== id)
          const history = [...closing, ...s.closedTabHistory].slice(0, 20)
          return { tabs: [tab], activeTabId: id, closedTabHistory: history }
        }),

      closeToRight: (id) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id)
          if (idx === -1 || idx === s.tabs.length - 1) return s
          const closing = s.tabs.slice(idx + 1)
          const remaining = s.tabs.slice(0, idx + 1)
          const history = [...closing, ...s.closedTabHistory].slice(0, 20)
          const activeTabId = remaining.find((t) => t.id === s.activeTabId)
            ? s.activeTabId
            : remaining[remaining.length - 1].id
          return { tabs: remaining, activeTabId, closedTabHistory: history }
        }),

      activateTab: (id) => set({ activeTabId: id }),

      duplicateTab: (id) =>
        set((s) => {
          const source = s.tabs.find((t) => t.id === id)
          if (!source) return s
          const dup = { ...source, id: crypto.randomUUID(), response: null }
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

      reorderTabs: (fromId, toId) =>
        set((s) => {
          const fromIdx = s.tabs.findIndex((t) => t.id === fromId)
          const toIdx = s.tabs.findIndex((t) => t.id === toId)
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return s
          const tabs = [...s.tabs]
          const [moved] = tabs.splice(fromIdx, 1)
          tabs.splice(toIdx, 0, moved)
          return { tabs }
        }),

      updateTab: (id, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
    }),
    {
      name: "reqlet-tabs",
      version: 5,
      migrate(persisted: unknown) {
        const s = persisted as { tabs?: unknown[]; [k: string]: unknown }
        return {
          ...s,
          tabs: (s.tabs ?? []).map((t: unknown) => ({
            params: [],
            headers: [],
            pathVars: [],
            bodyType: "none",
            bodyRaw: "",
            bodyRawContentType: "JSON",
            bodyFormData: [],
            bodyUrlencoded: [],
            response: null,
            followRedirects: true,
            sslVerification: true,
            timeout: 0,
            ...(t as object),
          })),
        }
      },
    },
  ),
)
