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

  it("new tab has default method GET and empty url", () => {
    const { tabs } = useTabsStore.getState()
    expect(tabs[0].method).toBe("GET")
    expect(tabs[0].url).toBe("")
    expect(tabs[0].dirty).toBe(false)
  })
})

describe("closeTab", () => {
  it("removes the tab and keeps the active one when active is not closed", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    // activeTabId is tabs[1] (last opened)
    useTabsStore.getState().closeTab(tabs[0].id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.activeTabId).toBe(tabs[1].id)
  })

  it("activates adjacent tab when closing the active one", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    // active is tabs[1], close it → should activate tabs[0]
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
    const state = useTabsStore.getState()
    expect(state.closedTabHistory[0].id).toBe(id)
  })

  it("ignores unknown id", () => {
    const before = useTabsStore.getState().tabs.length
    useTabsStore.getState().closeTab("nonexistent")
    expect(useTabsStore.getState().tabs).toHaveLength(before)
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

describe("updateTab", () => {
  it("updates method and url on the correct tab", () => {
    useTabsStore.getState().openTab()
    const { tabs } = useTabsStore.getState()
    useTabsStore
      .getState()
      .updateTab(tabs[0].id, { method: "POST", url: "https://api.example.com" })
    const state = useTabsStore.getState()
    expect(state.tabs[0].method).toBe("POST")
    expect(state.tabs[0].url).toBe("https://api.example.com")
    // other tab untouched
    expect(state.tabs[1].method).toBe("GET")
  })

  it("updates activeSubTab", () => {
    const { tabs } = useTabsStore.getState()
    useTabsStore.getState().updateTab(tabs[0].id, { activeSubTab: "Body" })
    expect(useTabsStore.getState().tabs[0].activeSubTab).toBe("Body")
  })
})
