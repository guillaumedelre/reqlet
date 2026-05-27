import { create } from "zustand"
import type {
  Collection,
  Environment,
  EnvVariable,
  CollectionItem,
  RequestItem,
  FolderItem,
  AuthConfig,
} from "@/types"

function newId(): string {
  return `id-${crypto.randomUUID().slice(0, 8)}`
}

export interface PathSegment {
  id: string
  name: string
  type: "collection" | "folder"
}

interface WorkspaceState {
  collections: Collection[]
  environments: Environment[]
  globalVariables: EnvVariable[]
  expandedIds: Set<string>
  setCollections: (collections: Collection[]) => void
  setEnvironments: (environments: Environment[]) => void
  toggleExpand: (id: string) => void
  isExpanded: (id: string) => boolean
  findRequest: (id: string) => RequestWithCollection | null
  findFolderPath: (folderId: string) => PathSegment[] | null
  addCollection: (name: string) => Collection
  deleteCollection: (id: string) => void
  deleteItem: (collectionId: string, itemId: string) => void
  renameCollection: (id: string, name: string) => void
  renameItem: (collectionId: string, itemId: string, name: string) => void
  duplicateCollection: (id: string) => void
  duplicateItem: (collectionId: string, itemId: string) => void
  addRequest: (collectionId: string, parentFolderId?: string) => RequestItem
  addFolder: (collectionId: string, parentFolderId?: string) => FolderItem
  updateCollectionScript: (
    id: string,
    field: "preRequestScript" | "testScript",
    value: string,
  ) => void
  updateItemScript: (
    collectionId: string,
    itemId: string,
    field: "preRequestScript" | "testScript",
    value: string,
  ) => void
  addEnvironment: (name: string) => Environment
  deleteEnvironment: (id: string) => void
  renameEnvironment: (id: string, name: string) => void
  addEnvironmentVariable: (envId: string) => void
  deleteEnvironmentVariable: (envId: string, varId: string) => void
  updateEnvironmentVariable: (envId: string, varId: string, patch: Partial<EnvVariable>) => void
  addCollectionVariable: (collectionId: string) => void
  deleteCollectionVariable: (collectionId: string, varId: string) => void
  updateCollectionVariable: (
    collectionId: string,
    varId: string,
    patch: Partial<EnvVariable>,
  ) => void
  addGlobalVariable: () => void
  deleteGlobalVariable: (varId: string) => void
  updateGlobalVariable: (varId: string, patch: Partial<EnvVariable>) => void
  moveItem: (
    sourceCollectionId: string,
    itemId: string,
    targetCollectionId: string,
    targetFolderId: string | null,
  ) => void
  updateCollectionAuth: (collectionId: string, auth: AuthConfig) => void
  updateItemAuth: (collectionId: string, itemId: string, auth: AuthConfig) => void
}

interface RequestWithCollection {
  request: RequestItem
  collectionId: string
}

function findRequestInItems(
  items: CollectionItem[],
  id: string,
  collectionId: string,
): RequestWithCollection | null {
  for (const item of items) {
    if ("method" in item) {
      if (item.id === id) return { request: item, collectionId }
    } else {
      const found = findRequestInItems(item.items, id, collectionId)
      if (found) return found
    }
  }
  return null
}

function findFolderInItems(
  items: CollectionItem[],
  folderId: string,
  currentPath: PathSegment[],
): PathSegment[] | null {
  for (const item of items) {
    if (!("method" in item)) {
      const path = [...currentPath, { id: item.id, name: item.name, type: "folder" as const }]
      if (item.id === folderId) return path
      const found = findFolderInItems(item.items, folderId, path)
      if (found) return found
    }
  }
  return null
}

function deleteFromList(items: CollectionItem[], id: string): CollectionItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ("method" in item ? item : { ...item, items: deleteFromList(item.items, id) }))
}

function renameInList(items: CollectionItem[], id: string, name: string): CollectionItem[] {
  return items.map((item) => {
    if (item.id === id) return { ...item, name }
    if (!("method" in item)) return { ...item, items: renameInList(item.items, id, name) }
    return item
  })
}

function updateScriptInList(
  items: CollectionItem[],
  id: string,
  field: "preRequestScript" | "testScript",
  value: string,
): CollectionItem[] {
  return items.map((item) => {
    if (item.id === id) return { ...item, [field]: value }
    if (!("method" in item))
      return { ...item, items: updateScriptInList(item.items, id, field, value) }
    return item
  })
}

function cloneItems(items: CollectionItem[]): CollectionItem[] {
  return items.map((item) => {
    if ("method" in item) return { ...item, id: newId() }
    return { ...item, id: newId(), items: cloneItems(item.items) }
  })
}

function duplicateInList(items: CollectionItem[], id: string): CollectionItem[] {
  const result: CollectionItem[] = []
  for (const item of items) {
    result.push(item)
    if (item.id === id) {
      if ("method" in item) {
        result.push({ ...item, id: newId(), name: `${item.name} Copy` })
      } else {
        result.push({
          ...item,
          id: newId(),
          name: `${item.name} Copy`,
          items: cloneItems(item.items),
        })
      }
    } else if (!("method" in item)) {
      result[result.length - 1] = { ...item, items: duplicateInList(item.items, id) }
    }
  }
  return result
}

function extractFromList(
  items: CollectionItem[],
  id: string,
): { item: CollectionItem | null; remaining: CollectionItem[] } {
  let extracted: CollectionItem | null = null
  const remaining = items
    .filter((item) => {
      if (item.id === id) {
        extracted = item
        return false
      }
      return true
    })
    .map((item) => {
      if (!("method" in item)) {
        const r = extractFromList(item.items, id)
        if (r.item) {
          extracted = r.item
          return { ...item, items: r.remaining }
        }
      }
      return item
    })
  return { item: extracted, remaining }
}

function insertIntoList(
  items: CollectionItem[],
  targetFolderId: string | null,
  newItem: CollectionItem,
): CollectionItem[] {
  if (targetFolderId === null) return [...items, newItem]
  return items.map((item) => {
    if (!("method" in item)) {
      if (item.id === targetFolderId) return { ...item, items: [...item.items, newItem] }
      return { ...item, items: insertIntoList(item.items, targetFolderId, newItem) }
    }
    return item
  })
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  collections: [],
  environments: [],
  globalVariables: [],
  expandedIds: new Set<string>(),

  setCollections: (collections) => set({ collections }),
  setEnvironments: (environments) => set({ environments }),

  toggleExpand: (id) =>
    set((state) => {
      const next = new Set(state.expandedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedIds: next }
    }),

  isExpanded: (id) => get().expandedIds.has(id),

  findRequest: (id) => {
    for (const col of get().collections) {
      const found = findRequestInItems(col.items, id, col.id)
      if (found) return found
    }
    return null
  },

  findFolderPath: (folderId) => {
    for (const col of get().collections) {
      const root: PathSegment = { id: col.id, name: col.name, type: "collection" }
      const path = findFolderInItems(col.items, folderId, [root])
      if (path) return path
    }
    return null
  },

  addCollection: (name) => {
    const col: Collection = {
      id: newId(),
      name,
      description: "",
      items: [],
      variables: [],
      preRequestScript: "",
      testScript: "",
      auth: { type: "none" },
    }
    set((s) => ({ collections: [...s.collections, col] }))
    return col
  },

  deleteCollection: (id) => set((s) => ({ collections: s.collections.filter((c) => c.id !== id) })),

  deleteItem: (collectionId, itemId) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, items: deleteFromList(c.items, itemId) } : c,
      ),
    })),

  renameCollection: (id, name) =>
    set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, name } : c)) })),

  renameItem: (collectionId, itemId, name) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, items: renameInList(c.items, itemId, name) } : c,
      ),
    })),

  duplicateCollection: (id) =>
    set((s) => {
      const col = s.collections.find((c) => c.id === id)
      if (!col) return s
      const clone = { ...col, id: newId(), name: `${col.name} Copy`, items: cloneItems(col.items) }
      const idx = s.collections.findIndex((c) => c.id === id)
      const next = [...s.collections]
      next.splice(idx + 1, 0, clone)
      return { collections: next }
    }),

  duplicateItem: (collectionId, itemId) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, items: duplicateInList(c.items, itemId) } : c,
      ),
    })),

  addRequest: (collectionId, parentFolderId) => {
    const req: RequestItem = {
      id: newId(),
      name: "New Request",
      method: "GET",
      url: "",
      params: [],
      headers: [],
      body: {
        type: "none",
        raw: "",
        rawContentType: "application/json",
        formData: [],
        urlencoded: [],
        graphqlQuery: "",
        graphqlVariables: "",
      },
      auth: { type: "inherit" },
      preRequestScript: "",
      testScript: "",
    }
    set((s) => ({
      collections: s.collections.map((c) => {
        if (c.id !== collectionId) return c
        return { ...c, items: insertIntoList(c.items, parentFolderId ?? null, req) }
      }),
    }))
    return req
  },

  addFolder: (collectionId, parentFolderId) => {
    const folder: FolderItem = {
      id: newId(),
      name: "New Folder",
      auth: { type: "inherit" },
      preRequestScript: "",
      testScript: "",
      items: [],
    }
    set((s) => ({
      collections: s.collections.map((c) => {
        if (c.id !== collectionId) return c
        return { ...c, items: insertIntoList(c.items, parentFolderId ?? null, folder) }
      }),
    }))
    return folder
  },

  updateCollectionScript: (id, field, value) =>
    set((s) => ({
      collections: s.collections.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    })),

  updateItemScript: (collectionId, itemId, field, value) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? { ...c, items: updateScriptInList(c.items, itemId, field, value) }
          : c,
      ),
    })),

  addEnvironment: (name) => {
    const env: Environment = { id: newId(), name, variables: [] }
    set((s) => ({ environments: [...s.environments, env] }))
    return env
  },

  deleteEnvironment: (id) =>
    set((s) => ({ environments: s.environments.filter((e) => e.id !== id) })),

  renameEnvironment: (id, name) =>
    set((s) => ({ environments: s.environments.map((e) => (e.id === id ? { ...e, name } : e)) })),

  addEnvironmentVariable: (envId) =>
    set((s) => ({
      environments: s.environments.map((e) =>
        e.id !== envId
          ? e
          : {
              ...e,
              variables: [
                ...e.variables,
                { id: newId(), enabled: true, key: "", initialValue: "", currentValue: "" },
              ],
            },
      ),
    })),

  deleteEnvironmentVariable: (envId, varId) =>
    set((s) => ({
      environments: s.environments.map((e) =>
        e.id !== envId ? e : { ...e, variables: e.variables.filter((v) => v.id !== varId) },
      ),
    })),

  updateEnvironmentVariable: (envId, varId, patch) =>
    set((s) => ({
      environments: s.environments.map((e) =>
        e.id !== envId
          ? e
          : {
              ...e,
              variables: e.variables.map((v) => (v.id === varId ? { ...v, ...patch } : v)),
            },
      ),
    })),

  addCollectionVariable: (collectionId) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id !== collectionId
          ? c
          : {
              ...c,
              variables: [
                ...c.variables,
                { id: newId(), enabled: true, key: "", initialValue: "", currentValue: "" },
              ],
            },
      ),
    })),

  deleteCollectionVariable: (collectionId, varId) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id !== collectionId ? c : { ...c, variables: c.variables.filter((v) => v.id !== varId) },
      ),
    })),

  updateCollectionVariable: (collectionId, varId, patch) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id !== collectionId
          ? c
          : {
              ...c,
              variables: c.variables.map((v) => (v.id === varId ? { ...v, ...patch } : v)),
            },
      ),
    })),

  addGlobalVariable: () =>
    set((s) => ({
      globalVariables: [
        ...s.globalVariables,
        { id: newId(), enabled: true, key: "", initialValue: "", currentValue: "" },
      ],
    })),

  deleteGlobalVariable: (varId) =>
    set((s) => ({ globalVariables: s.globalVariables.filter((v) => v.id !== varId) })),

  updateGlobalVariable: (varId, patch) =>
    set((s) => ({
      globalVariables: s.globalVariables.map((v) => (v.id === varId ? { ...v, ...patch } : v)),
    })),

  moveItem: (sourceCollectionId, itemId, targetCollectionId, targetFolderId) => {
    set((s) => {
      const srcCol = s.collections.find((c) => c.id === sourceCollectionId)
      if (!srcCol) return s
      if (targetFolderId && itemId === targetFolderId) return s
      const { item, remaining } = extractFromList(srcCol.items, itemId)
      if (!item) return s
      return {
        collections: s.collections.map((c) => {
          if (c.id === sourceCollectionId && c.id === targetCollectionId) {
            return { ...c, items: insertIntoList(remaining, targetFolderId, item) }
          }
          if (c.id === sourceCollectionId) return { ...c, items: remaining }
          if (c.id === targetCollectionId)
            return { ...c, items: insertIntoList(c.items, targetFolderId, item) }
          return c
        }),
      }
    })
  },

  updateCollectionAuth: (collectionId, auth) => {
    set((s) => ({
      collections: s.collections.map((c) => (c.id === collectionId ? { ...c, auth } : c)),
    }))
  },

  updateItemAuth: (collectionId, itemId, auth) => {
    function patch(items: CollectionItem[]): CollectionItem[] {
      return items.map((item) => {
        if (item.id === itemId) return { ...item, auth }
        if (!("method" in item)) return { ...item, items: patch(item.items) }
        return item
      })
    }
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, items: patch(c.items) } : c,
      ),
    }))
  },
}))
