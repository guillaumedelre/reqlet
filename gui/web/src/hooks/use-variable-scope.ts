import { useMemo } from "react"
import { useWorkspaceStore } from "@/store/workspace"
import { useUiStore } from "@/store/ui"

export interface VariableScope {
  resolvedMap: Map<string, string>
  allKeys: string[]
}

// Returns variable keys and their resolved values from all active scopes.
// Priority (highest wins): Environment > Collection > Global
// Data and Local scopes exist only at script runtime, not here.
export function useVariableScope(collectionId?: string): VariableScope {
  const environments = useWorkspaceStore((s) => s.environments)
  const globalVariables = useWorkspaceStore((s) => s.globalVariables)
  const collections = useWorkspaceStore((s) => s.collections)
  const activeEnvironmentId = useUiStore((s) => s.activeEnvironmentId)

  return useMemo(() => {
    const map = new Map<string, string>()

    for (const v of globalVariables) {
      if (v.enabled && v.key) map.set(v.key, v.currentValue || v.initialValue)
    }

    if (collectionId) {
      const col = collections.find((c) => c.id === collectionId)
      if (col) {
        for (const v of col.variables) {
          if (v.enabled && v.key) map.set(v.key, v.currentValue || v.initialValue)
        }
      }
    }

    if (activeEnvironmentId) {
      const env = environments.find((e) => e.id === activeEnvironmentId)
      if (env) {
        for (const v of env.variables) {
          if (v.enabled && v.key) map.set(v.key, v.currentValue || v.initialValue)
        }
      }
    }

    const keySet = new Set<string>(map.keys())
    return { resolvedMap: map, allKeys: Array.from(keySet) }
  }, [globalVariables, collections, collectionId, environments, activeEnvironmentId])
}
