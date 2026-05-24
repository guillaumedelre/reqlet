import { beforeEach, describe, expect, it } from "vitest"
import { useTabsStore } from "./tabs"

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: null, closedTabHistory: [] })
  useTabsStore.getState().openTab()
})

describe("openTab", () => {
  it("adds a tab and activates it", () => {
    useTabsStore.getState().openTab()
    const { tabs, activeTabId } = useTabsStore.getState()
    expect(tabs).toHaveLength(2)
    expect(activeTabId).toBe(tabs[1].id)
  })

  it("new tab has default method GET, empty url, empty params, headers and pathVars", () => {
    const { tabs } = useTabsStore.getState()
    expect(tabs[0].method).toBe("GET")
    expect(tabs[0].url).toBe("")
    expect(tabs[0].params).toEqual([])
    expect(tabs[0].headers).toEqual([])
    expect(tabs[0].pathVars).toEqual([])
    expect(tabs[0].dirty).toBe(false)
  })
})

describe("closeTab", () => {
  it("removes the tab and keeps the active one when active is not closed", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().closeTab(tabs[0].id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.activeTabId).toBe(tabs[1].id)
  })

  it("activates adjacent tab when closing the active one", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().closeTab(tabs[1].id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.activeTabId).toBe(tabs[0].id)
  })

  it("opens a new blank tab when closing the last one", () => {
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().closeTab(tabs[0].id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).not.toBe(tabs[0].id)
  })

  it("pushes closed tab to history", () => {
    const { tabs } = useTabsStore.getState()
    const id = tabs[0].id
    useTabsStore.getState().closeTab(id)
    expect(useTabsStore.getState().closedTabHistory[0].id).toBe(id)
  })

  it("ignores unknown id", () => {
    const before = useTabsStore.getState().tabs.length
    useTabsStore.getState().closeTab("nonexistent")
    expect(useTabsStore.getState().tabs).toHaveLength(before)
  })
})

describe("closeOthers", () => {
  it("keeps only the target tab and pushes the rest to history", () => {
    useTabsStore.getState().openTab()
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().closeOthers(tabs[1].id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe(tabs[1].id)
    expect(state.activeTabId).toBe(tabs[1].id)
    expect(state.closedTabHistory).toHaveLength(2)
  })

  it("ignores unknown id", () => {
    const before = useTabsStore.getState().tabs.length
    useTabsStore.getState().closeOthers("nonexistent")
    expect(useTabsStore.getState().tabs).toHaveLength(before)
  })
})

describe("closeToRight", () => {
  it("closes all tabs to the right of the target", () => {
    useTabsStore.getState().openTab()
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().closeToRight(tabs[0].id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe(tabs[0].id)
    expect(state.closedTabHistory).toHaveLength(2)
  })

  it("does nothing when target is the last tab", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().closeToRight(tabs[1].id)
    expect(useTabsStore.getState().tabs).toHaveLength(2)
  })

  it("updates activeTabId when active tab is closed", () => {
    useTabsStore.getState().openTab()
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    // active is tabs[2]; close to the right of tabs[0] → tabs[1] and tabs[2] are closed
    useTabsStore.getState().closeToRight(tabs[0].id)
    expect(useTabsStore.getState().activeTabId).toBe(tabs[0].id)
  })
})

describe("duplicateTab", () => {
  it("inserts a copy right after the source and activates it", () => {
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().updateTab(tabs[0].id, { method: "POST", url: "https://example.com" })
    useTabsStore.getState().duplicateTab(tabs[0].id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2)
    expect(state.tabs[1].method).toBe("POST")
    expect(state.tabs[1].url).toBe("https://example.com")
    expect(state.tabs[1].id).not.toBe(tabs[0].id)
    expect(state.activeTabId).toBe(state.tabs[1].id)
  })

  it("ignores unknown id", () => {
    const before = useTabsStore.getState().tabs.length
    useTabsStore.getState().duplicateTab("nonexistent")
    expect(useTabsStore.getState().tabs).toHaveLength(before)
  })
})

describe("reopenLastTab", () => {
  it("restores the last closed tab and activates it", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    const closedId = tabs[0].id
    useTabsStore.getState().closeTab(closedId)
    useTabsStore.getState().reopenLastTab()
    const state = useTabsStore.getState()
    expect(state.tabs.some((t) => t.id === closedId)).toBe(true)
    expect(state.activeTabId).toBe(closedId)
    expect(state.closedTabHistory).toHaveLength(0)
  })

  it("does nothing when history is empty", () => {
    const { tabs, activeTabId } = useTabsStore.getState()
    useTabsStore.getState().reopenLastTab()
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(tabs.length)
    expect(state.activeTabId).toBe(activeTabId)
  })
})

describe("reorderTabs", () => {
  it("moves a tab to a new position", () => {
    useTabsStore.getState().openTab()
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    const [id0, id1, id2] = tabs.map((t) => t.id)
    useTabsStore.getState().reorderTabs(id2, id0)
    const state = useTabsStore.getState()
    expect(state.tabs[0].id).toBe(id2)
    expect(state.tabs[1].id).toBe(id0)
    expect(state.tabs[2].id).toBe(id1)
  })

  it("does nothing when source and target are the same tab", () => {
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().reorderTabs(tabs[0].id, tabs[0].id)
    expect(useTabsStore.getState().tabs).toHaveLength(1)
    expect(useTabsStore.getState().tabs[0].id).toBe(tabs[0].id)
  })

  it("ignores unknown ids", () => {
    const before = useTabsStore.getState().tabs.length
    useTabsStore.getState().reorderTabs("unknown", "alsoUnknown")
    expect(useTabsStore.getState().tabs).toHaveLength(before)
  })

  it("preserves activeTabId after reorder", () => {
    useTabsStore.getState().openTab()
    const { tabs, activeTabId } = useTabsStore.getState()
    useTabsStore.getState().reorderTabs(tabs[1].id, tabs[0].id)
    expect(useTabsStore.getState().activeTabId).toBe(activeTabId)
  })
})

describe("updateTab", () => {
  it("updates method, url, params and headers on the correct tab", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    const param = { id: "p1", key: "page", value: "1", enabled: true }
    const header = { id: "h1", key: "Authorization", value: "Bearer token", enabled: true }
    useTabsStore.getState().updateTab(tabs[0].id, {
      method: "POST",
      url: "https://api.example.com",
      params: [param],
      headers: [header],
    })
    const state = useTabsStore.getState()
    expect(state.tabs[0].method).toBe("POST")
    expect(state.tabs[0].url).toBe("https://api.example.com")
    expect(state.tabs[0].params).toEqual([param])
    expect(state.tabs[0].headers).toEqual([header])
    expect(state.tabs[1].method).toBe("GET")
  })

  it("updates activeSubTab", () => {
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().updateTab(tabs[0].id, { activeSubTab: "Body" })
    expect(useTabsStore.getState().tabs[0].activeSubTab).toBe("Body")
  })
})
