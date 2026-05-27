import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useWorkspaceStore } from "@/store/workspace"
import { api } from "@/lib/api"
import type { Collection, Environment } from "@/types"

function syncCollectionDiff(curr: Collection[], prev: Collection[]) {
  if (curr === prev) return
  const prevMap = new Map(prev.map((c) => [c.id, c]))
  const currIds = new Set(curr.map((c) => c.id))
  for (const [id] of prevMap) {
    if (!currIds.has(id)) api.collections.delete(id).catch(() => {})
  }
  for (const col of curr) {
    if (!prevMap.has(col.id)) {
      api.collections.create(col).catch(() => {})
    } else if (prevMap.get(col.id) !== col) {
      api.collections.update(col.id, col).catch(() => {})
    }
  }
}

function syncEnvironmentDiff(curr: Environment[], prev: Environment[]) {
  if (curr === prev) return
  const prevMap = new Map(prev.map((e) => [e.id, e]))
  const currIds = new Set(curr.map((e) => e.id))
  for (const [id] of prevMap) {
    if (!currIds.has(id)) api.environments.delete(id).catch(() => {})
  }
  for (const env of curr) {
    if (!prevMap.has(env.id)) {
      api.environments.create(env).catch(() => {})
    } else if (prevMap.get(env.id) !== env) {
      api.environments.update(env.id, env).catch(() => {})
    }
  }
}

export function useWorkspaceSync() {
  const { setCollections, setEnvironments } = useWorkspaceStore()
  const syncReady = useRef(false)

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: api.collections.list,
    staleTime: Infinity,
  })

  const { data: environments } = useQuery({
    queryKey: ["environments"],
    queryFn: api.environments.list,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!collections || !environments) return
    // Disable sync during init load to avoid firing back to the API.
    syncReady.current = false
    setCollections(collections)
    setEnvironments(environments)
    syncReady.current = true
  }, [collections, environments, setCollections, setEnvironments])

  useEffect(() => {
    return useWorkspaceStore.subscribe((state, prevState) => {
      if (!syncReady.current) return
      syncCollectionDiff(state.collections, prevState.collections)
      syncEnvironmentDiff(state.environments, prevState.environments)
    })
  }, [])
}

export { syncCollectionDiff, syncEnvironmentDiff }
