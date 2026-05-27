import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useOrphanTabCleanup } from "./app-layout"
import { useTabsStore } from "@/store/tabs"
import { useWorkspaceStore } from "@/store/workspace"
import type { Collection, FolderItem, RequestItem, Tab } from "@/types"

const BODY = {
  type: "none" as const,
  raw: "",
  rawContentType: "application/json" as const,
  formData: [],
  urlencoded: [],
  graphqlQuery: "",
  graphqlVariables: "",
}

function makeTab(overrides: Partial<Tab> & Pick<Tab, "id" | "type">): Tab {
  return {
    title: "Tab",
    dirty: false,
    request: {
      method: "GET",
      url: "",
      params: [],
      headers: [],
      body: BODY,
      auth: { type: "inherit" },
      preRequestScript: "",
      testScript: "",
    },
    isSending: false,
    response: null,
    requestSubTab: "params",
    responseSubTab: "body",
    collectionSubTab: "overview",
    ...overrides,
  }
}

function makeRequest(id: string): RequestItem {
  return {
    id,
    name: "Request",
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: BODY,
    auth: { type: "inherit" },
    preRequestScript: "",
    testScript: "",
  }
}

function makeFolder(id: string, items: Collection["items"] = []): FolderItem {
  return {
    id,
    name: "Folder",
    auth: { type: "inherit" },
    preRequestScript: "",
    testScript: "",
    items,
  }
}

function makeCollection(id: string, items: Collection["items"] = []): Collection {
  return {
    id,
    name: "Col",
    description: "",
    auth: { type: "none" },
    variables: [],
    preRequestScript: "",
    testScript: "",
    items,
  }
}

function setCollections(cols: Collection[]) {
  useWorkspaceStore.setState((s) => ({ ...s, collections: cols }))
}

function setTabs(tabs: Tab[]) {
  useTabsStore.setState({ tabs, activeTabId: tabs[0]?.id ?? "", closedTabs: [] })
}

function tabIds() {
  return useTabsStore.getState().tabs.map((t) => t.id)
}

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
  setCollections([])
  localStorage.clear()
})

describe("orphan tab cleanup — collection deleted", () => {
  it("closes the collection tab", async () => {
    setCollections([makeCollection("c1")])
    setTabs([makeTab({ id: "t-col", type: "collection", collectionId: "c1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([]))

    await waitFor(() => expect(tabIds()).not.toContain("t-col"))
  })

  it("closes a request tab whose collection is deleted", async () => {
    setCollections([makeCollection("c1", [makeRequest("req1")])])
    setTabs([makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([]))

    await waitFor(() => expect(tabIds()).not.toContain("t-req"))
  })

  it("closes all tabs belonging to the deleted collection", async () => {
    const req = makeRequest("req1")
    const folder = makeFolder("f1", [req])
    setCollections([makeCollection("c1", [folder])])
    setTabs([
      makeTab({ id: "t-col", type: "collection", collectionId: "c1" }),
      makeTab({ id: "t-folder", type: "folder", collectionId: "c1", folderId: "f1" }),
      makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-col")
      expect(ids).not.toContain("t-folder")
      expect(ids).not.toContain("t-req")
    })
  })

  it("does not close tabs from a sibling collection", async () => {
    setCollections([makeCollection("c1"), makeCollection("c2")])
    setTabs([
      makeTab({ id: "t1", type: "collection", collectionId: "c1" }),
      makeTab({ id: "t2", type: "collection", collectionId: "c2" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c2")]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t1")
      expect(ids).toContain("t2")
    })
  })
})

describe("orphan tab cleanup — folder deleted", () => {
  it("closes the folder tab when the folder is deleted", async () => {
    setCollections([makeCollection("c1", [makeFolder("f1")])])
    setTabs([makeTab({ id: "t-folder", type: "folder", collectionId: "c1", folderId: "f1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => expect(tabIds()).not.toContain("t-folder"))
  })

  it("closes folder tab and request tabs inside the deleted folder", async () => {
    const req = makeRequest("req1")
    setCollections([makeCollection("c1", [makeFolder("f1", [req])])])
    setTabs([
      makeTab({ id: "t-folder", type: "folder", collectionId: "c1", folderId: "f1" }),
      makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-folder")
      expect(ids).not.toContain("t-req")
    })
  })

  it("closes tabs for requests in a deeply nested folder", async () => {
    const req = makeRequest("req1")
    const inner = makeFolder("f-inner", [req])
    const outer = makeFolder("f-outer", [inner])
    setCollections([makeCollection("c1", [outer])])
    setTabs([
      makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" }),
      makeTab({ id: "t-inner", type: "folder", collectionId: "c1", folderId: "f-inner" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-req")
      expect(ids).not.toContain("t-inner")
    })
  })

  it("does not close tabs for requests that remain in the collection", async () => {
    const req1 = makeRequest("req1")
    const req2 = makeRequest("req2")
    setCollections([makeCollection("c1", [makeFolder("f1", [req1]), req2])])
    setTabs([
      makeTab({ id: "t-req1", type: "request", collectionId: "c1", requestId: "req1" }),
      makeTab({ id: "t-req2", type: "request", collectionId: "c1", requestId: "req2" }),
    ])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [req2])]))

    await waitFor(() => {
      const ids = tabIds()
      expect(ids).not.toContain("t-req1")
      expect(ids).toContain("t-req2")
    })
  })
})

describe("orphan tab cleanup — request deleted", () => {
  it("closes the request tab when the request is removed from the collection", async () => {
    const req = makeRequest("req1")
    setCollections([makeCollection("c1", [req])])
    setTabs([makeTab({ id: "t-req", type: "request", collectionId: "c1", requestId: "req1" })])
    renderHook(() => useOrphanTabCleanup())

    act(() => setCollections([makeCollection("c1", [])]))

    await waitFor(() => expect(tabIds()).not.toContain("t-req"))
  })
})
