import { beforeEach, describe, expect, it } from "vitest"
import { useWorkspaceStore } from "./workspace"
import { isFolder, isRequest } from "@/types"
import type { Collection, FolderItem, RequestItem } from "@/types"

const EMPTY = {
  collections: [] as Collection[],
  environments: [] as import("@/types").Environment[],
  globalVariables: [] as import("@/types").EnvVariable[],
  expandedIds: new Set<string>(),
}

function makeCollection(id: string, name = "Col"): Collection {
  return {
    id,
    name,
    description: "",
    auth: { type: "none" },
    variables: [],
    preRequestScript: "",
    testScript: "",
    items: [],
  }
}

beforeEach(() => {
  useWorkspaceStore.setState(EMPTY)
})

// ── Environments ───────────────────────────────────────────────────────────

describe("addCollection", () => {
  it("adds a new collection and returns it", () => {
    const col = useWorkspaceStore.getState().addCollection("My API")
    const { collections } = useWorkspaceStore.getState()
    expect(collections).toHaveLength(1)
    expect(collections[0].id).toBe(col.id)
    expect(collections[0].name).toBe("My API")
    expect(collections[0].items).toEqual([])
  })

  it("does not affect existing collections", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addCollection("New")
    expect(useWorkspaceStore.getState().collections).toHaveLength(2)
  })
})

describe("addEnvironment", () => {
  it("adds a new environment and returns it", () => {
    const env = useWorkspaceStore.getState().addEnvironment("Production")
    const { environments } = useWorkspaceStore.getState()
    expect(environments).toHaveLength(1)
    expect(environments[0].id).toBe(env.id)
    expect(environments[0].name).toBe("Production")
    expect(environments[0].variables).toEqual([])
  })
})

describe("deleteEnvironment", () => {
  it("removes the environment by id", () => {
    const env = useWorkspaceStore.getState().addEnvironment("Dev")
    useWorkspaceStore.getState().deleteEnvironment(env.id)
    expect(useWorkspaceStore.getState().environments).toHaveLength(0)
  })

  it("does not affect other environments", () => {
    const a = useWorkspaceStore.getState().addEnvironment("A")
    const b = useWorkspaceStore.getState().addEnvironment("B")
    useWorkspaceStore.getState().deleteEnvironment(a.id)
    expect(useWorkspaceStore.getState().environments).toHaveLength(1)
    expect(useWorkspaceStore.getState().environments[0].id).toBe(b.id)
  })
})

describe("renameEnvironment", () => {
  it("renames the environment", () => {
    const env = useWorkspaceStore.getState().addEnvironment("Old")
    useWorkspaceStore.getState().renameEnvironment(env.id, "New")
    expect(useWorkspaceStore.getState().environments[0].name).toBe("New")
  })
})

describe("addEnvironmentVariable", () => {
  it("adds an empty variable to the environment", () => {
    const env = useWorkspaceStore.getState().addEnvironment("Dev")
    useWorkspaceStore.getState().addEnvironmentVariable(env.id)
    const { variables } = useWorkspaceStore.getState().environments[0]
    expect(variables).toHaveLength(1)
    expect(variables[0].key).toBe("")
    expect(variables[0].enabled).toBe(true)
  })
})

describe("deleteEnvironmentVariable", () => {
  it("removes the variable", () => {
    const env = useWorkspaceStore.getState().addEnvironment("Dev")
    useWorkspaceStore.getState().addEnvironmentVariable(env.id)
    const varId = useWorkspaceStore.getState().environments[0].variables[0].id
    useWorkspaceStore.getState().deleteEnvironmentVariable(env.id, varId)
    expect(useWorkspaceStore.getState().environments[0].variables).toHaveLength(0)
  })
})

describe("updateEnvironmentVariable", () => {
  it("patches key and value fields", () => {
    const env = useWorkspaceStore.getState().addEnvironment("Dev")
    useWorkspaceStore.getState().addEnvironmentVariable(env.id)
    const varId = useWorkspaceStore.getState().environments[0].variables[0].id
    useWorkspaceStore.getState().updateEnvironmentVariable(env.id, varId, {
      key: "BASE_URL",
      initialValue: "https://dev.example.com",
    })
    const v = useWorkspaceStore.getState().environments[0].variables[0]
    expect(v.key).toBe("BASE_URL")
    expect(v.initialValue).toBe("https://dev.example.com")
  })
})

// ── Global variables ───────────────────────────────────────────────────────

describe("addGlobalVariable", () => {
  it("appends an empty global variable", () => {
    useWorkspaceStore.getState().addGlobalVariable()
    const { globalVariables } = useWorkspaceStore.getState()
    expect(globalVariables).toHaveLength(1)
    expect(globalVariables[0].key).toBe("")
    expect(globalVariables[0].enabled).toBe(true)
  })
})

describe("deleteGlobalVariable", () => {
  it("removes the variable by id", () => {
    useWorkspaceStore.getState().addGlobalVariable()
    useWorkspaceStore.getState().addGlobalVariable()
    const [a] = useWorkspaceStore.getState().globalVariables
    useWorkspaceStore.getState().deleteGlobalVariable(a.id)
    expect(useWorkspaceStore.getState().globalVariables).toHaveLength(1)
    expect(useWorkspaceStore.getState().globalVariables[0].id).not.toBe(a.id)
  })
})

describe("updateGlobalVariable", () => {
  it("patches the variable", () => {
    useWorkspaceStore.getState().addGlobalVariable()
    const { id } = useWorkspaceStore.getState().globalVariables[0]
    useWorkspaceStore.getState().updateGlobalVariable(id, { key: "TOKEN", currentValue: "abc" })
    const v = useWorkspaceStore.getState().globalVariables[0]
    expect(v.key).toBe("TOKEN")
    expect(v.currentValue).toBe("abc")
  })
})

// ── Collection CRUD ────────────────────────────────────────────────────────

describe("renameCollection", () => {
  it("renames the collection", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1", "Old")] })
    useWorkspaceStore.getState().renameCollection("c1", "New")
    expect(useWorkspaceStore.getState().collections[0].name).toBe("New")
  })
})

describe("deleteCollection", () => {
  it("removes the collection", () => {
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [makeCollection("c1"), makeCollection("c2")],
    })
    useWorkspaceStore.getState().deleteCollection("c1")
    expect(useWorkspaceStore.getState().collections).toHaveLength(1)
    expect(useWorkspaceStore.getState().collections[0].id).toBe("c2")
  })
})

describe("duplicateCollection", () => {
  it("inserts a copy right after the original", () => {
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [makeCollection("c1", "Alpha"), makeCollection("c2", "Beta")],
    })
    useWorkspaceStore.getState().duplicateCollection("c1")
    const cols = useWorkspaceStore.getState().collections
    expect(cols).toHaveLength(3)
    expect(cols[0].id).toBe("c1")
    expect(cols[1].name).toBe("Alpha Copy")
    expect(cols[2].id).toBe("c2")
  })

  it("gives the copy a new id", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().duplicateCollection("c1")
    const [orig, copy] = useWorkspaceStore.getState().collections
    expect(copy.id).not.toBe(orig.id)
  })
})

// ── addRequest / addFolder ─────────────────────────────────────────────────

describe("addRequest", () => {
  it("adds a request at collection root and returns it", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    expect(r.name).toBe("New Request")
    expect(r.method).toBe("GET")
    const items = useWorkspaceStore.getState().collections[0].items
    expect(items).toHaveLength(1)
    expect(items[0] as RequestItem).toMatchObject({ id: r.id })
  })

  it("adds a request inside a folder", () => {
    const folder: FolderItem = {
      id: "f1",
      name: "Folder",
      auth: { type: "none" },
      preRequestScript: "",
      testScript: "",
      items: [],
    }
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [{ ...makeCollection("c1"), items: [folder] }],
    })
    useWorkspaceStore.getState().addRequest("c1", "f1")
    const updated = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    expect(updated.items).toHaveLength(1)
  })
})

describe("addFolder", () => {
  it("adds a folder at collection root and returns it", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    expect(f.name).toBe("New Folder")
    expect(useWorkspaceStore.getState().collections[0].items).toHaveLength(1)
  })
})

// ── deleteItem / renameItem / duplicateItem ────────────────────────────────

describe("deleteItem", () => {
  it("removes a request from collection root", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().deleteItem("c1", r.id)
    expect(useWorkspaceStore.getState().collections[0].items).toHaveLength(0)
  })

  it("removes a request nested inside a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().deleteItem("c1", r.id)
    const folder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    expect(folder.items).toHaveLength(0)
  })

  it("removes a folder and all its children", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().deleteItem("c1", f.id)
    expect(useWorkspaceStore.getState().collections[0].items).toHaveLength(0)
  })
})

describe("renameItem", () => {
  it("renames a request at collection root", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().renameItem("c1", r.id, "Renamed")
    expect((useWorkspaceStore.getState().collections[0].items[0] as RequestItem).name).toBe(
      "Renamed",
    )
  })
})

describe("duplicateItem", () => {
  it("inserts a copy right after the original", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().duplicateItem("c1", r.id)
    const { items } = useWorkspaceStore.getState().collections[0]
    expect(items).toHaveLength(2)
    expect((items[1] as RequestItem).name).toBe("New Request Copy")
  })

  it("gives the copy a new id", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().duplicateItem("c1", r.id)
    const [orig, copy] = useWorkspaceStore.getState().collections[0].items
    expect((copy as RequestItem).id).not.toBe(orig.id)
  })
})

// ── Collection variables ───────────────────────────────────────────────────

describe("addCollectionVariable", () => {
  it("adds an empty variable to the collection", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addCollectionVariable("c1")
    expect(useWorkspaceStore.getState().collections[0].variables).toHaveLength(1)
  })
})

describe("deleteCollectionVariable", () => {
  it("removes the variable", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addCollectionVariable("c1")
    const varId = useWorkspaceStore.getState().collections[0].variables[0].id
    useWorkspaceStore.getState().deleteCollectionVariable("c1", varId)
    expect(useWorkspaceStore.getState().collections[0].variables).toHaveLength(0)
  })
})

describe("updateCollectionVariable", () => {
  it("patches the variable", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addCollectionVariable("c1")
    const varId = useWorkspaceStore.getState().collections[0].variables[0].id
    useWorkspaceStore.getState().updateCollectionVariable("c1", varId, {
      key: "BASE",
      initialValue: "https://api.example.com",
    })
    const v = useWorkspaceStore.getState().collections[0].variables[0]
    expect(v.key).toBe("BASE")
    expect(v.initialValue).toBe("https://api.example.com")
  })
})

// ── Collection auth ────────────────────────────────────────────────────────

describe("updateCollectionAuth", () => {
  it("updates auth on the target collection", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore
      .getState()
      .updateCollectionAuth("c1", { type: "bearer", bearer: { token: "tok" } })
    expect(useWorkspaceStore.getState().collections[0].auth).toEqual({
      type: "bearer",
      bearer: { token: "tok" },
    })
  })

  it("does not affect other collections", () => {
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [makeCollection("c1"), makeCollection("c2")],
    })
    useWorkspaceStore.getState().updateCollectionAuth("c1", { type: "none" })
    expect(useWorkspaceStore.getState().collections[1].auth).toEqual({ type: "none" })
  })
})

describe("updateItemAuth", () => {
  it("updates auth on a folder at collection root", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore
      .getState()
      .updateItemAuth("c1", f.id, { type: "basic", basic: { username: "u", password: "p" } })
    const folder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    expect(folder.auth).toEqual({ type: "basic", basic: { username: "u", password: "p" } })
  })

  it("updates auth on a folder nested inside another folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const outer = useWorkspaceStore.getState().addFolder("c1")
    const inner = useWorkspaceStore.getState().addFolder("c1", outer.id)
    useWorkspaceStore.getState().updateItemAuth("c1", inner.id, { type: "inherit" })
    const outerFolder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    const innerFolder = outerFolder.items[0] as FolderItem
    expect(innerFolder.auth).toEqual({ type: "inherit" })
  })

  it("does not affect other collections", () => {
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [makeCollection("c1"), makeCollection("c2")],
    })
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore.getState().updateItemAuth("c1", f.id, { type: "none" })
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })

  it("does not affect sibling request items (covers patch return item branch)", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r1 = useWorkspaceStore.getState().addRequest("c1")
    const r2 = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore
      .getState()
      .updateItemAuth("c1", r1.id, { type: "bearer", bearer: { token: "tok" } })
    const items = useWorkspaceStore.getState().collections[0].items as RequestItem[]
    // r2 is a sibling request — patch returns it unchanged (L774 return item)
    expect(items.find((i) => i.id === r2.id)?.auth).toEqual({ type: "inherit" })
  })
})

// ── Collection scripts ─────────────────────────────────────────────────────

describe("updateCollectionScript", () => {
  it("updates preRequestScript", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore
      .getState()
      .updateCollectionScript("c1", "preRequestScript", 'console.log("before")')
    expect(useWorkspaceStore.getState().collections[0].preRequestScript).toBe(
      'console.log("before")',
    )
  })

  it("updates testScript", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore
      .getState()
      .updateCollectionScript("c1", "testScript", 'pm.test("ok", () => {})')
    expect(useWorkspaceStore.getState().collections[0].testScript).toBe('pm.test("ok", () => {})')
  })
})

describe("updateItemScript", () => {
  it("updates script on a request", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore
      .getState()
      .updateItemScript("c1", r.id, "testScript", 'pm.test("pass", () => {})')
    const item = useWorkspaceStore.getState().collections[0].items[0] as RequestItem
    expect(item.testScript).toBe('pm.test("pass", () => {})')
  })
})

// ── moveItem (DnD) ─────────────────────────────────────────────────────────

describe("moveItem", () => {
  it("moves a request from root to a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore.getState().moveItem("c1", r.id, "c1", f.id)
    const col = useWorkspaceStore.getState().collections[0]
    expect(col.items).toHaveLength(1)
    const folder = col.items[0] as FolderItem
    expect(folder.items).toHaveLength(1)
  })

  it("moves a request from a folder back to root", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().moveItem("c1", r.id, "c1", null)
    const col = useWorkspaceStore.getState().collections[0]
    const folder = col.items.find((i) => !("method" in i)) as FolderItem
    expect(folder.items).toHaveLength(0)
    expect(col.items).toHaveLength(2)
  })

  it("does not move a folder into itself", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const before = JSON.stringify(useWorkspaceStore.getState().collections)
    useWorkspaceStore.getState().moveItem("c1", f.id, "c1", f.id)
    expect(JSON.stringify(useWorkspaceStore.getState().collections)).toBe(before)
  })
})

// ── findRequest / findFolderPath ───────────────────────────────────────────

describe("findRequest", () => {
  it("finds a request at root level", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    const result = useWorkspaceStore.getState().findRequest(r.id)
    expect(result).not.toBeNull()
    expect(result?.request.id).toBe(r.id)
    expect(result?.collectionId).toBe("c1")
  })

  it("finds a request nested in a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1", f.id)
    const result = useWorkspaceStore.getState().findRequest(r.id)
    expect(result?.request.id).toBe(r.id)
  })

  it("returns null for unknown id", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    expect(useWorkspaceStore.getState().findRequest("unknown")).toBeNull()
  })

  it("finds second of two root-level requests (covers L373 false branch)", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addRequest("c1")
    const r2 = useWorkspaceStore.getState().addRequest("c1")
    const result = useWorkspaceStore.getState().findRequest(r2.id)
    expect(result?.request.id).toBe(r2.id)
  })

  it("finds request after an empty folder (covers L376 false branch)", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1")
    const result = useWorkspaceStore.getState().findRequest(r.id)
    expect(result?.request.id).toBe(r.id)
  })
})

describe("findFolderPath", () => {
  it("returns a path containing the collection and folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1", "Root Col")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const path = useWorkspaceStore.getState().findFolderPath(f.id)
    expect(path).not.toBeNull()
    expect(path?.[0]).toMatchObject({ type: "collection", name: "Root Col" })
    expect(path?.[1]).toMatchObject({ type: "folder", id: f.id })
  })

  it("returns null for unknown folder id", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    expect(useWorkspaceStore.getState().findFolderPath("nope")).toBeNull()
  })

  it("finds second of two sibling folders (covers L392 false branch)", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addFolder("c1")
    const f2 = useWorkspaceStore.getState().addFolder("c1")
    const path = useWorkspaceStore.getState().findFolderPath(f2.id)
    expect(path).not.toBeNull()
    expect(path![path!.length - 1].id).toBe(f2.id)
  })
})

// ── toggleExpand / isExpanded ──────────────────────────────────────────────

describe("toggleExpand / isExpanded", () => {
  it("starts unexpanded", () => {
    expect(useWorkspaceStore.getState().isExpanded("x")).toBe(false)
  })

  it("expands on first toggle", () => {
    useWorkspaceStore.getState().toggleExpand("x")
    expect(useWorkspaceStore.getState().isExpanded("x")).toBe(true)
  })

  it("collapses on second toggle", () => {
    useWorkspaceStore.getState().toggleExpand("x")
    useWorkspaceStore.getState().toggleExpand("x")
    expect(useWorkspaceStore.getState().isExpanded("x")).toBe(false)
  })

  it("tracks multiple ids independently", () => {
    useWorkspaceStore.getState().toggleExpand("a")
    expect(useWorkspaceStore.getState().isExpanded("a")).toBe(true)
    expect(useWorkspaceStore.getState().isExpanded("b")).toBe(false)
  })
})

// ── isFolder / isRequest type guards ──────────────────────────────────────

describe("isFolder / isRequest", () => {
  it("isFolder returns true for a folder item", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    expect(isFolder(f)).toBe(true)
    expect(isRequest(f)).toBe(false)
  })

  it("isRequest returns true for a request item", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    expect(isRequest(r)).toBe(true)
    expect(isFolder(r)).toBe(false)
  })
})

// ── Passthrough branches: operations must not affect sibling collections ───

describe("collection operations leave sibling collections unchanged", () => {
  function setup2Cols() {
    const c1 = makeCollection("c1", "Alpha")
    const c2 = makeCollection("c2", "Beta")
    useWorkspaceStore.setState({ ...EMPTY, collections: [c1, c2] })
  }

  it("renameCollection does not rename the other collection", () => {
    setup2Cols()
    useWorkspaceStore.getState().renameCollection("c1", "Renamed")
    expect(useWorkspaceStore.getState().collections[1].name).toBe("Beta")
  })

  it("deleteItem does not touch the other collection", () => {
    setup2Cols()
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().deleteItem("c1", r.id)
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })

  it("renameItem does not touch the other collection", () => {
    setup2Cols()
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().renameItem("c1", r.id, "New Name")
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })

  it("duplicateItem does not touch the other collection", () => {
    setup2Cols()
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().duplicateItem("c1", r.id)
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })

  it("addRequest does not add to the other collection", () => {
    setup2Cols()
    useWorkspaceStore.getState().addRequest("c1")
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })

  it("addFolder does not add to the other collection", () => {
    setup2Cols()
    useWorkspaceStore.getState().addFolder("c1")
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })

  it("updateCollectionScript does not touch the other collection", () => {
    setup2Cols()
    useWorkspaceStore.getState().updateCollectionScript("c1", "preRequestScript", "console.log()")
    expect(useWorkspaceStore.getState().collections[1].preRequestScript).toBe("")
  })

  it("updateItemScript does not touch the other collection", () => {
    setup2Cols()
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore
      .getState()
      .updateItemScript("c1", r.id, "testScript", 'pm.test("x", () => {})')
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })

  it("addCollectionVariable does not touch the other collection", () => {
    setup2Cols()
    useWorkspaceStore.getState().addCollectionVariable("c1")
    expect(useWorkspaceStore.getState().collections[1].variables).toHaveLength(0)
  })

  it("deleteCollectionVariable does not touch the other collection", () => {
    setup2Cols()
    useWorkspaceStore.getState().addCollectionVariable("c1")
    const varId = useWorkspaceStore.getState().collections[0].variables[0].id
    useWorkspaceStore.getState().deleteCollectionVariable("c1", varId)
    expect(useWorkspaceStore.getState().collections[1].variables).toHaveLength(0)
  })

  it("updateCollectionVariable does not touch the other collection", () => {
    setup2Cols()
    useWorkspaceStore.getState().addCollectionVariable("c1")
    const varId = useWorkspaceStore.getState().collections[0].variables[0].id
    useWorkspaceStore.getState().updateCollectionVariable("c1", varId, { key: "X" })
    expect(useWorkspaceStore.getState().collections[1].variables).toHaveLength(0)
  })

  it("updateCollectionAuth does not touch the other collection", () => {
    setup2Cols()
    useWorkspaceStore
      .getState()
      .updateCollectionAuth("c1", { type: "bearer", bearer: { token: "t" } })
    expect(useWorkspaceStore.getState().collections[1].auth).toEqual({ type: "none" })
  })

  it("updateItemAuth does not touch the other collection", () => {
    setup2Cols()
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore.getState().updateItemAuth("c1", f.id, { type: "none" })
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(0)
  })
})

// ── Passthrough branches: env variable operations must not affect siblings ─

describe("environment variable operations leave sibling environments unchanged", () => {
  it("addEnvironmentVariable does not touch sibling env", () => {
    const e1 = useWorkspaceStore.getState().addEnvironment("Dev")
    const e2 = useWorkspaceStore.getState().addEnvironment("Prod")
    useWorkspaceStore.getState().addEnvironmentVariable(e1.id)
    expect(
      useWorkspaceStore.getState().environments.find((e) => e.id === e2.id)!.variables,
    ).toHaveLength(0)
  })

  it("deleteEnvironmentVariable does not touch sibling env", () => {
    const e1 = useWorkspaceStore.getState().addEnvironment("Dev")
    const e2 = useWorkspaceStore.getState().addEnvironment("Prod")
    useWorkspaceStore.getState().addEnvironmentVariable(e1.id)
    const varId = useWorkspaceStore.getState().environments.find((e) => e.id === e1.id)!
      .variables[0].id
    useWorkspaceStore.getState().deleteEnvironmentVariable(e1.id, varId)
    expect(
      useWorkspaceStore.getState().environments.find((e) => e.id === e2.id)!.variables,
    ).toHaveLength(0)
  })

  it("updateEnvironmentVariable does not touch sibling env", () => {
    const e1 = useWorkspaceStore.getState().addEnvironment("Dev")
    const e2 = useWorkspaceStore.getState().addEnvironment("Prod")
    useWorkspaceStore.getState().addEnvironmentVariable(e1.id)
    const varId = useWorkspaceStore.getState().environments.find((e) => e.id === e1.id)!
      .variables[0].id
    useWorkspaceStore.getState().updateEnvironmentVariable(e1.id, varId, { key: "BASE_URL" })
    expect(
      useWorkspaceStore.getState().environments.find((e) => e.id === e2.id)!.variables,
    ).toHaveLength(0)
  })

  it("renameEnvironment does not touch sibling env", () => {
    const e1 = useWorkspaceStore.getState().addEnvironment("Dev")
    const e2 = useWorkspaceStore.getState().addEnvironment("Prod")
    useWorkspaceStore.getState().renameEnvironment(e1.id, "Development")
    expect(useWorkspaceStore.getState().environments.find((e) => e.id === e2.id)!.name).toBe("Prod")
  })

  it("updateEnvironmentVariable patches only the targeted variable", () => {
    const e1 = useWorkspaceStore.getState().addEnvironment("Dev")
    useWorkspaceStore.getState().addEnvironmentVariable(e1.id)
    useWorkspaceStore.getState().addEnvironmentVariable(e1.id)
    const vars = useWorkspaceStore.getState().environments[0].variables
    useWorkspaceStore.getState().updateEnvironmentVariable(e1.id, vars[0].id, { key: "FIRST" })
    const updated = useWorkspaceStore.getState().environments[0].variables
    expect(updated[0].key).toBe("FIRST")
    expect(updated[1].key).toBe("")
  })
})

// ── Deep nesting (recursive helpers) ──────────────────────────────────────

describe("operations on items nested in a folder", () => {
  it("renameItem renames a request inside a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().renameItem("c1", r.id, "Deep Name")
    const folder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    expect((folder.items[0] as RequestItem).name).toBe("Deep Name")
  })

  it("updateItemScript updates a request inside a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore
      .getState()
      .updateItemScript("c1", r.id, "testScript", 'pm.test("nested", () => {})')
    const folder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    expect((folder.items[0] as RequestItem).testScript).toBe('pm.test("nested", () => {})')
  })

  it("duplicateItem duplicates a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().duplicateItem("c1", f.id)
    const { items } = useWorkspaceStore.getState().collections[0]
    expect(items).toHaveLength(2)
    const copy = items[1] as FolderItem
    expect(copy.name).toBe("New Folder Copy")
    expect(copy.id).not.toBe(f.id)
    expect(copy.items).toHaveLength(1)
  })

  it("duplicateItem inside a folder duplicates the nested item", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().duplicateItem("c1", r.id)
    const folder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    expect(folder.items).toHaveLength(2)
    expect((folder.items[1] as RequestItem).name).toBe("New Request Copy")
  })

  it("addRequest inside a subfolder exercises insertIntoList recursion", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const outer = useWorkspaceStore.getState().addFolder("c1")
    const inner = useWorkspaceStore.getState().addFolder("c1", outer.id)
    useWorkspaceStore.getState().addRequest("c1", inner.id)
    const outerFolder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    const innerFolder = outerFolder.items[0] as FolderItem
    expect(innerFolder.items).toHaveLength(1)
  })

  it("addFolder inside a subfolder exercises insertIntoList recursion", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const outer = useWorkspaceStore.getState().addFolder("c1")
    const inner = useWorkspaceStore.getState().addFolder("c1", outer.id)
    useWorkspaceStore.getState().addFolder("c1", inner.id)
    const outerFolder = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    const innerFolder = outerFolder.items[0] as FolderItem
    expect(innerFolder.items).toHaveLength(1)
  })

  it("findFolderPath finds a deeply nested folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1", "Root")] })
    const outer = useWorkspaceStore.getState().addFolder("c1")
    const inner = useWorkspaceStore.getState().addFolder("c1", outer.id)
    const path = useWorkspaceStore.getState().findFolderPath(inner.id)
    expect(path).toHaveLength(3)
    expect(path![0].type).toBe("collection")
    expect(path![1].id).toBe(outer.id)
    expect(path![2].id).toBe(inner.id)
  })
})

// ── moveItem edge cases ────────────────────────────────────────────────────

describe("moveItem edge cases", () => {
  it("is a no-op when source collection does not exist", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addRequest("c1")
    const before = JSON.stringify(useWorkspaceStore.getState().collections)
    useWorkspaceStore.getState().moveItem("unknown", "req-x", "c1", null)
    expect(JSON.stringify(useWorkspaceStore.getState().collections)).toBe(before)
  })

  it("is a no-op when item does not exist in source collection", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const before = JSON.stringify(useWorkspaceStore.getState().collections)
    useWorkspaceStore.getState().moveItem("c1", "nonexistent", "c1", null)
    expect(JSON.stringify(useWorkspaceStore.getState().collections)).toBe(before)
  })

  it("moves an item from one collection to another (cross-collection)", () => {
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [makeCollection("c1"), makeCollection("c2")],
    })
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().moveItem("c1", r.id, "c2", null)
    expect(useWorkspaceStore.getState().collections[0].items).toHaveLength(0)
    expect(useWorkspaceStore.getState().collections[1].items).toHaveLength(1)
    expect((useWorkspaceStore.getState().collections[1].items[0] as RequestItem).id).toBe(r.id)
  })

  it("cross-collection move leaves unrelated collection unchanged", () => {
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [makeCollection("c1"), makeCollection("c2"), makeCollection("c3")],
    })
    const r = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().moveItem("c1", r.id, "c2", null)
    expect(useWorkspaceStore.getState().collections[2].items).toHaveLength(0)
  })

  it("moves an item from one collection into a folder in another collection", () => {
    useWorkspaceStore.setState({
      ...EMPTY,
      collections: [makeCollection("c1"), makeCollection("c2")],
    })
    const r = useWorkspaceStore.getState().addRequest("c1")
    const f = useWorkspaceStore.getState().addFolder("c2")
    useWorkspaceStore.getState().moveItem("c1", r.id, "c2", f.id)
    expect(useWorkspaceStore.getState().collections[0].items).toHaveLength(0)
    const targetFolder = useWorkspaceStore.getState().collections[1].items[0] as FolderItem
    expect(targetFolder.items).toHaveLength(1)
  })

  it("moveItem from folder to root exercises extractFromList recursion", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const r = useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().moveItem("c1", r.id, "c1", null)
    const col = useWorkspaceStore.getState().collections[0]
    const folder = col.items.find((i) => isFolder(i)) as FolderItem
    expect(folder.items).toHaveLength(0)
    expect(col.items.find((i) => isRequest(i) && i.id === r.id)).toBeDefined()
  })
})

// ── duplicateCollection guard ──────────────────────────────────────────────

describe("duplicateCollection guard", () => {
  it("is a no-op when collection does not exist", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().duplicateCollection("nonexistent")
    expect(useWorkspaceStore.getState().collections).toHaveLength(1)
  })
})

// ── Passthrough request branches in recursive helpers ─────────────────────
//
// Each helper (renameInList, updateScriptInList, insertIntoList, cloneItems)
// has a `return item` fallback for request items that are not the target.
// These branches need a collection where a request coexists with the target
// folder at the same level so the request is mapped-over but unchanged.

describe("recursive helper: request passthrough branches", () => {
  it("renameItem skips sibling request while renaming a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore.getState().renameItem("c1", f.id, "Renamed Folder")
    // request is unchanged, folder is renamed
    expect((useWorkspaceStore.getState().collections[0].items[0] as RequestItem).id).toBe(r.id)
    expect(useWorkspaceStore.getState().collections[0].items[1].name).toBe("Renamed Folder")
  })

  it("updateItemScript skips sibling request while updating a folder script", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const r = useWorkspaceStore.getState().addRequest("c1")
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore
      .getState()
      .updateItemScript("c1", f.id, "preRequestScript", 'console.log("f")')
    // request is unchanged
    expect((useWorkspaceStore.getState().collections[0].items[0] as RequestItem).id).toBe(r.id)
    expect(
      (useWorkspaceStore.getState().collections[0].items[1] as FolderItem).preRequestScript,
    ).toBe('console.log("f")')
  })

  it("insertIntoList skips sibling request when inserting into a nested folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const outerFolder = useWorkspaceStore.getState().addFolder("c1")
    const innerFolder = useWorkspaceStore.getState().addFolder("c1", outerFolder.id)
    // add a sibling request inside outerFolder alongside innerFolder
    useWorkspaceStore.getState().addRequest("c1", outerFolder.id)
    // now insert another request into innerFolder (skips the sibling request at outer level)
    useWorkspaceStore.getState().addRequest("c1", innerFolder.id)
    const outer = useWorkspaceStore.getState().collections[0].items[0] as FolderItem
    const inner = outer.items.find((i) => !("method" in i)) as FolderItem
    expect(inner.items).toHaveLength(1)
  })

  it("cloneItems clones a folder within a collection (covers folder branch in cloneItems)", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().duplicateCollection("c1")
    const [, copy] = useWorkspaceStore.getState().collections
    const clonedFolder = copy.items[0] as FolderItem
    expect(clonedFolder.id).not.toBe(f.id)
    expect(clonedFolder.items).toHaveLength(1)
  })

  it("duplicateItem skips sibling request when iterating past non-matching requests", () => {
    // [requestA, requestB]: duplicating A — B hits the `else if` false branch (is a method item)
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const a = useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().duplicateItem("c1", a.id)
    const { items } = useWorkspaceStore.getState().collections[0]
    expect(items).toHaveLength(3)
    expect((items[0] as RequestItem).id).toBe(a.id)
    expect((items[1] as RequestItem).name).toContain("Copy")
  })

  it("extractFromList skips sibling requests when moving an item from a folder with siblings", () => {
    // folder [requestA, requestB]: move requestA out → requestB remains, hits line 395 false branch
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const f = useWorkspaceStore.getState().addFolder("c1")
    const a = useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().addRequest("c1", f.id)
    useWorkspaceStore.getState().moveItem("c1", a.id, "c1", null)
    const col = useWorkspaceStore.getState().collections[0]
    const folder = col.items.find((i) => isFolder(i)) as FolderItem
    expect(folder.items).toHaveLength(1)
    expect(col.items.find((i) => isRequest(i) && i.id === a.id)).toBeDefined()
  })

  it("updateCollectionVariable patches only the targeted variable (covers false branch of inner ternary)", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addCollectionVariable("c1")
    useWorkspaceStore.getState().addCollectionVariable("c1")
    const [v1, v2] = useWorkspaceStore.getState().collections[0].variables
    useWorkspaceStore.getState().updateCollectionVariable("c1", v1.id, { key: "FIRST" })
    const vars = useWorkspaceStore.getState().collections[0].variables
    expect(vars[0].key).toBe("FIRST")
    expect(vars[1].id).toBe(v2.id)
    expect(vars[1].key).toBe("")
  })

  it("updateGlobalVariable patches only the targeted global variable", () => {
    useWorkspaceStore.getState().addGlobalVariable()
    useWorkspaceStore.getState().addGlobalVariable()
    const [g1] = useWorkspaceStore.getState().globalVariables
    useWorkspaceStore.getState().updateGlobalVariable(g1.id, { key: "GLOBAL_ONE" })
    const globals = useWorkspaceStore.getState().globalVariables
    expect(globals[0].key).toBe("GLOBAL_ONE")
    expect(globals[1].key).toBe("")
  })
})

// ── findFolderPath — request sibling branch (line 106) ────────────────────

describe("findFolderPath — items containing both requests and folders", () => {
  it("finds a folder when request items precede it in the list", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    // Add a request at root BEFORE the folder — exercises the false branch of
    // `if (!("method" in item))` in findFolderInItems (line 106).
    useWorkspaceStore.getState().addRequest("c1")
    const folder = useWorkspaceStore.getState().addFolder("c1")

    const path = useWorkspaceStore.getState().findFolderPath(folder.id)
    expect(path).not.toBeNull()
    expect(path![path!.length - 1].id).toBe(folder.id)
  })

  it("returns null when folderId does not exist in a mixed list", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    useWorkspaceStore.getState().addRequest("c1")
    useWorkspaceStore.getState().addFolder("c1")

    const path = useWorkspaceStore.getState().findFolderPath("nonexistent")
    expect(path).toBeNull()
  })
})

// ── deleteItem — request sibling kept during folder recursion (line 119) ──

describe("deleteItem — request sibling preserved during folder recursion", () => {
  it("keeps a root-level sibling request when deleting from inside a folder", () => {
    useWorkspaceStore.setState({ ...EMPTY, collections: [makeCollection("c1")] })
    const folder = useWorkspaceStore.getState().addFolder("c1")
    const siblingReq = useWorkspaceStore.getState().addRequest("c1")
    const innerReq = useWorkspaceStore.getState().addRequest("c1", folder.id)

    // deleteFromList([folder, siblingReq], innerReq.id):
    //   filter: keeps both (neither id matches innerReq)
    //   map: folder → recurse (false branch); siblingReq → keep as-is (TRUE branch, line 119)
    useWorkspaceStore.getState().deleteItem("c1", innerReq.id)

    const items = useWorkspaceStore.getState().collections[0].items
    expect(items.find((i) => i.id === siblingReq.id)).toBeDefined()
    expect((items.find((i) => i.id === folder.id) as FolderItem).items).toHaveLength(0)
  })
})
