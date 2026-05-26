import type { Variable } from "@/store/environments"

export function resolveVariables(
  text: string,
  globals: Variable[],
  envVariables: Variable[],
): string {
  const scope = new Map<string, string>()
  for (const v of globals) {
    if (v.enabled && v.key) scope.set(v.key.trim(), v.currentValue)
  }
  // env variables shadow globals
  for (const v of envVariables) {
    if (v.enabled && v.key) scope.set(v.key.trim(), v.currentValue)
  }
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => scope.get(key.trim()) ?? _match)
}
