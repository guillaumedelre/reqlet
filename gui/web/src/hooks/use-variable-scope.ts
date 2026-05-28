import { useMemo } from "react"
import { useWorkspaceStore } from "@/store/workspace"
import { useUiStore } from "@/store/ui"

export interface VariableScope {
  resolvedMap: Map<string, string>
  allKeys: string[]
}

// Substitutes all {{var}} tokens in a string using a pre-resolved variable map.
// Tokens whose key is absent from the map are left as-is.
export function applyVariables(s: string, resolvedMap: Map<string, string>): string {
  return s.replace(/\{\{([^{}]*)\}\}/g, (match, key: string) => resolvedMap.get(key) ?? match)
}

// Resolves {{var}} references recursively within a raw key→value map.
// Cycles (a → b → a) and undefined references are left as-is: {{var}} is preserved.
// The function is pure and exported for direct testing.
export function resolveRecursive(rawMap: Map<string, string>): Map<string, string> {
  const resolved = new Map<string, string>()

  function resolveValue(value: string, visiting: Set<string>): string {
    return value.replace(/\{\{([^{}]*)\}\}/g, (match, key: string) => {
      if (visiting.has(key)) return match // cycle guard — leave token as-is
      const raw = rawMap.get(key)
      if (raw === undefined) return match // undefined variable — leave as-is
      if (resolved.has(key)) return resolved.get(key)! // already memoized
      visiting.add(key)
      const result = resolveValue(raw, visiting)
      visiting.delete(key)
      resolved.set(key, result)
      return result
    })
  }

  for (const key of rawMap.keys()) {
    if (!resolved.has(key)) {
      resolved.set(key, resolveValue(rawMap.get(key)!, new Set([key])))
    }
  }

  return resolved
}

// Returns variable keys and their recursively resolved values from all active scopes.
// Priority (highest wins): Environment > Collection > Global
// Data and Local scopes exist only at script runtime, not here.
export function useVariableScope(collectionId?: string): VariableScope {
  const environments = useWorkspaceStore((s) => s.environments)
  const globalVariables = useWorkspaceStore((s) => s.globalVariables)
  const collections = useWorkspaceStore((s) => s.collections)
  const activeEnvironmentId = useUiStore((s) => s.activeEnvironmentId)

  return useMemo(() => {
    const rawMap = new Map<string, string>()

    for (const v of globalVariables) {
      if (v.enabled && v.key) rawMap.set(v.key, v.currentValue || v.initialValue)
    }

    if (collectionId) {
      const col = collections.find((c) => c.id === collectionId)
      if (col) {
        for (const v of col.variables) {
          if (v.enabled && v.key) rawMap.set(v.key, v.currentValue || v.initialValue)
        }
      }
    }

    if (activeEnvironmentId) {
      const env = environments.find((e) => e.id === activeEnvironmentId)
      if (env) {
        for (const v of env.variables) {
          if (v.enabled && v.key) rawMap.set(v.key, v.currentValue || v.initialValue)
        }
      }
    }

    const resolvedMap = resolveRecursive(rawMap)
    const allKeys = Array.from(rawMap.keys())
    return { resolvedMap, allKeys }
  }, [globalVariables, collections, collectionId, environments, activeEnvironmentId])
}
