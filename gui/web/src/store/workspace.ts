import { create } from "zustand"
import type {
  Collection,
  Environment,
  EnvVariable,
  KeyValuePair,
  CollectionItem,
  RequestItem,
  FolderItem,
} from "@/types"

let _id = 0
function uid(): string {
  return `id-${++_id}`
}
function newId(): string {
  return `id-${crypto.randomUUID().slice(0, 8)}`
}

function kv(key: string, value: string): KeyValuePair {
  return { id: uid(), enabled: true, key, value, description: "" }
}
function ev(key: string, initialValue: string, currentValue?: string): EnvVariable {
  return { id: uid(), enabled: true, key, initialValue, currentValue: currentValue ?? initialValue }
}

function body(
  type: "none" | "raw",
  raw = "",
  rawContentType: "application/json" | "text/plain" = "application/json",
) {
  return {
    type,
    raw,
    rawContentType,
    formData: [],
    urlencoded: [],
    graphqlQuery: "",
    graphqlVariables: "",
  }
}

const MOCK_COLLECTIONS: Collection[] = [
  {
    id: "col-1",
    name: "Reqlet API",
    description: "Core Reqlet workspace API",
    auth: { type: "bearer", bearer: { token: "{{accessToken}}" } },
    variables: [ev("baseUrl", "http://localhost:3001"), ev("apiVersion", "v1")],
    preRequestScript: "",
    testScript: "",
    items: [
      {
        id: "f-auth",
        name: "Authentication",
        auth: { type: "inherit" },
        preRequestScript: "",
        testScript: "",
        items: [
          {
            id: "r-login",
            name: "Login",
            method: "POST",
            url: "{{baseUrl}}/api/auth/login",
            params: [],
            headers: [kv("Content-Type", "application/json")],
            body: {
              type: "raw",
              raw: '{\n  "email": "user@example.com",\n  "password": "secret"\n}',
              rawContentType: "application/json",
              formData: [],
              urlencoded: [],
              graphqlQuery: "",
              graphqlVariables: "",
            },
            auth: { type: "none" },
            preRequestScript: "",
            testScript:
              'pm.test("Status 200", () => pm.response.to.have.status(200));\npm.test("Token present", () => {\n  const body = pm.response.json();\n  pm.expect(body.token).to.be.a("string");\n  pm.environment.set("accessToken", body.token);\n});',
          },
          {
            id: "r-refresh",
            name: "Refresh Token",
            method: "POST",
            url: "{{baseUrl}}/api/auth/refresh",
            params: [],
            headers: [],
            body: body("none"),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
          {
            id: "r-logout",
            name: "Logout",
            method: "DELETE",
            url: "{{baseUrl}}/api/auth/session",
            params: [],
            headers: [],
            body: body("none"),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
        ],
      },
      {
        id: "f-collections",
        name: "Collections",
        auth: { type: "inherit" },
        preRequestScript: "",
        testScript: "",
        items: [
          {
            id: "r-list-cols",
            name: "List Collections",
            method: "GET",
            url: "{{baseUrl}}/api/collections",
            params: [
              kv("page", "1"),
              { id: uid(), enabled: false, key: "limit", value: "20", description: "Page size" },
            ],
            headers: [],
            body: body("none"),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: 'pm.test("Status 200", () => pm.response.to.have.status(200));',
          },
          {
            id: "r-create-col",
            name: "Create Collection",
            method: "POST",
            url: "{{baseUrl}}/api/collections",
            params: [],
            headers: [],
            body: body("raw", '{\n  "name": "My New Collection",\n  "description": ""\n}'),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
          {
            id: "r-get-col",
            name: "Get Collection",
            method: "GET",
            url: "{{baseUrl}}/api/collections/:id",
            params: [],
            headers: [],
            body: body("none"),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
          {
            id: "r-update-col",
            name: "Update Collection",
            method: "PUT",
            url: "{{baseUrl}}/api/collections/:id",
            params: [],
            headers: [],
            body: body("raw", '{\n  "name": "Updated Name"\n}'),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
          {
            id: "r-delete-col",
            name: "Delete Collection",
            method: "DELETE",
            url: "{{baseUrl}}/api/collections/:id",
            params: [],
            headers: [],
            body: body("none"),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
        ],
      },
      {
        id: "f-environments",
        name: "Environments",
        auth: { type: "inherit" },
        preRequestScript: "",
        testScript: "",
        items: [
          {
            id: "r-list-envs",
            name: "List Environments",
            method: "GET",
            url: "{{baseUrl}}/api/environments",
            params: [],
            headers: [],
            body: body("none"),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
          {
            id: "r-create-env",
            name: "Create Environment",
            method: "POST",
            url: "{{baseUrl}}/api/environments",
            params: [],
            headers: [],
            body: body("raw", '{\n  "name": "Production"\n}'),
            auth: { type: "inherit" },
            preRequestScript: "",
            testScript: "",
          },
        ],
      },
    ],
  },
  {
    id: "col-2",
    name: "GitHub API",
    description: "GitHub REST API v3",
    auth: { type: "bearer", bearer: { token: "{{githubToken}}" } },
    variables: [
      ev("baseUrl", "https://api.github.com"),
      ev("owner", "reqlet"),
      ev("repo", "reqlet"),
    ],
    preRequestScript: "",
    testScript: "",
    items: [
      {
        id: "r-gh-user",
        name: "Get Authenticated User",
        method: "GET",
        url: "{{baseUrl}}/user",
        params: [],
        headers: [kv("Accept", "application/vnd.github.v3+json")],
        body: body("none"),
        auth: { type: "inherit" },
        preRequestScript: "",
        testScript: "",
      },
      {
        id: "r-gh-repos",
        name: "List Repositories",
        method: "GET",
        url: "{{baseUrl}}/user/repos",
        params: [kv("sort", "updated"), kv("per_page", "30"), kv("visibility", "all")],
        headers: [kv("Accept", "application/vnd.github.v3+json")],
        body: body("none"),
        auth: { type: "inherit" },
        preRequestScript: "",
        testScript: "",
      },
      {
        id: "r-gh-create-issue",
        name: "Create Issue",
        method: "POST",
        url: "{{baseUrl}}/repos/{{owner}}/{{repo}}/issues",
        params: [],
        headers: [kv("Accept", "application/vnd.github.v3+json")],
        body: {
          type: "raw",
          raw: '{\n  "title": "Bug: unexpected behavior",\n  "body": "## Description\\n\\nSteps to reproduce:",\n  "labels": ["bug"]\n}',
          rawContentType: "application/json",
          formData: [],
          urlencoded: [],
          graphqlQuery: "",
          graphqlVariables: "",
        },
        auth: { type: "inherit" },
        preRequestScript: "",
        testScript: "",
      },
    ],
  },
]

const MOCK_ENVIRONMENTS: Environment[] = [
  {
    id: "env-dev",
    name: "Development",
    variables: [
      ev("baseUrl", "http://localhost:3001"),
      ev("accessToken", "", ""),
      ev("apiVersion", "v1"),
    ],
  },
  {
    id: "env-staging",
    name: "Staging",
    variables: [ev("baseUrl", "https://staging.reqlet.dev"), ev("accessToken", "", "")],
  },
  {
    id: "env-prod",
    name: "Production",
    variables: [ev("baseUrl", "https://api.reqlet.dev"), ev("accessToken", "", "")],
  },
]

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
  collections: MOCK_COLLECTIONS,
  environments: MOCK_ENVIRONMENTS,
  globalVariables: [],
  expandedIds: new Set(["col-1", "f-auth", "f-collections"]),

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
}))
