import type { KeyValueItem } from "@/store/tabs"

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "))
  } catch {
    return s
  }
}

export function assembleUrl(base: string, params: KeyValueItem[]): string {
  const enabled = params.filter((p) => p.enabled && p.key)
  if (!enabled.length || !base) return base
  const qs = enabled
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&")
  return `${base}?${qs}`
}

export function parseUrl(raw: string): {
  base: string
  params: Array<{ key: string; value: string }>
} {
  const qi = raw.indexOf("?")
  if (qi < 0) return { base: raw, params: [] }
  const base = raw.slice(0, qi)
  const params = raw
    .slice(qi + 1)
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const ei = part.indexOf("=")
      if (ei < 0) return { key: safeDecode(part), value: "" }
      return { key: safeDecode(part.slice(0, ei)), value: safeDecode(part.slice(ei + 1)) }
    })
  return { base, params }
}

// Merge URL-parsed params into existing list.
// Enabled items are reconciled with the URL; disabled items are preserved as-is.
export function mergeParams(
  existing: KeyValueItem[],
  parsed: Array<{ key: string; value: string }>,
): KeyValueItem[] {
  const usedIds = new Set<string>()
  const fromUrl = parsed.map(({ key, value }) => {
    const match = existing.find((p) => p.enabled && p.key === key && !usedIds.has(p.id))
    if (match) {
      usedIds.add(match.id)
      return { ...match, value }
    }
    return { id: crypto.randomUUID(), key, value, enabled: true }
  })
  const disabled = existing.filter((p) => !p.enabled)
  return [...fromUrl, ...disabled]
}
