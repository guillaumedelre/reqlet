import type { Collection, Environment } from "@/types"

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed", code: "request_failed" }))
    throw new Error((err as { error?: string }).error ?? "Request failed")
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  collections: {
    list: () => request<Collection[]>("GET", "/collections"),
    create: (col: Collection) => request<Collection>("POST", "/collections", col),
    get: (id: string) => request<Collection>("GET", `/collections/${id}`),
    update: (id: string, col: Collection) => request<Collection>("PUT", `/collections/${id}`, col),
    delete: (id: string) => request<void>("DELETE", `/collections/${id}`),
  },
  environments: {
    list: () => request<Environment[]>("GET", "/environments"),
    create: (env: Environment) => request<Environment>("POST", "/environments", env),
    get: (id: string) => request<Environment>("GET", `/environments/${id}`),
    update: (id: string, env: Environment) =>
      request<Environment>("PUT", `/environments/${id}`, env),
    delete: (id: string) => request<void>("DELETE", `/environments/${id}`),
  },
}
