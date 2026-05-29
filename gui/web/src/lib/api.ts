import type { Collection, Environment, RunEvent, RunOptions, RunSummary } from "@/types"

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
    import: async (file: File): Promise<Collection> => {
      const text = await file.text()
      const res = await fetch("/api/collections/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error((err as { error?: string }).error ?? "Request failed")
      }
      return res.json() as Promise<Collection>
    },
    export: async (id: string): Promise<void> => {
      const res = await fetch(`/api/collections/${id}/export`)
      if (!res.ok) throw new Error("Export failed")
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "collection.postman_collection.json"
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    run: (id: string, opts: RunOptions = {}): Promise<{ runId: string }> =>
      request<{ runId: string }>("POST", `/collections/${id}/run`, opts),
  },
  environments: {
    list: () => request<Environment[]>("GET", "/environments"),
    create: (env: Environment) => request<Environment>("POST", "/environments", env),
    get: (id: string) => request<Environment>("GET", `/environments/${id}`),
    update: (id: string, env: Environment) =>
      request<Environment>("PUT", `/environments/${id}`, env),
    delete: (id: string) => request<void>("DELETE", `/environments/${id}`),
    import: async (file: File): Promise<Environment> => {
      const text = await file.text()
      const res = await fetch("/api/environments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error((err as { error?: string }).error ?? "Request failed")
      }
      return res.json() as Promise<Environment>
    },
    export: async (id: string): Promise<void> => {
      const res = await fetch(`/api/environments/${id}/export`)
      if (!res.ok) throw new Error("Export failed")
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "environment.postman_environment.json"
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
  },
  runs: {
    get: (runId: string): Promise<RunSummary> => request<RunSummary>("GET", `/runs/${runId}`),
    stream: (
      runId: string,
      callbacks: {
        onEvent: (event: RunEvent) => void
        onDone: (summary: RunSummary) => void
        onError: (err: Error) => void
      },
    ): (() => void) => {
      const es = new EventSource(`/api/runs/${runId}/stream`)
      let completed = false

      es.onmessage = (e: MessageEvent) => {
        const evt = JSON.parse(e.data as string) as RunEvent
        callbacks.onEvent(evt)
        if (evt.type === "done" && evt.summary) {
          completed = true
          callbacks.onDone(evt.summary)
          es.close()
        }
      }
      es.onerror = () => {
        if (!completed) callbacks.onError(new Error("SSE connection error"))
        es.close()
      }
      return () => es.close()
    },
  },
}
