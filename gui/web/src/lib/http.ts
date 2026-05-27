import type { HttpMethod } from "@/types"

export const COMMON_REQUEST_HEADERS = [
  "Accept",
  "Accept-Charset",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Connection",
  "Content-Disposition",
  "Content-Encoding",
  "Content-Length",
  "Content-Type",
  "Cookie",
  "DNT",
  "Date",
  "Expect",
  "Forwarded",
  "From",
  "Host",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "If-Range",
  "If-Unmodified-Since",
  "Keep-Alive",
  "Origin",
  "Pragma",
  "Proxy-Authorization",
  "Range",
  "Referer",
  "TE",
  "Transfer-Encoding",
  "Upgrade",
  "User-Agent",
  "Via",
  "X-Api-Key",
  "X-Correlation-ID",
  "X-Forwarded-For",
  "X-Forwarded-Host",
  "X-Forwarded-Proto",
  "X-Request-ID",
  "X-Requested-With",
]

export const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]

export const METHOD_LABEL_WIDTH: Record<HttpMethod, string> = {
  GET: "w-[46px]",
  POST: "w-[46px]",
  PUT: "w-[46px]",
  PATCH: "w-[52px]",
  DELETE: "w-[52px]",
  OPTIONS: "w-[60px]",
  HEAD: "w-[46px]",
}

export const METHOD_COLORS: Record<HttpMethod, { text: string; dark: string }> = {
  GET: { text: "text-[#61affe]", dark: "dark:text-[#61affe]" },
  POST: { text: "text-[#49cc90]", dark: "dark:text-[#49cc90]" },
  PUT: { text: "text-[#fca130]", dark: "dark:text-[#fca130]" },
  PATCH: { text: "text-[#50e3c2]", dark: "dark:text-[#50e3c2]" },
  DELETE: { text: "text-[#f93e3e]", dark: "dark:text-[#f93e3e]" },
  OPTIONS: { text: "text-[#0d5aa7]", dark: "dark:text-[#61affe]" },
  HEAD: { text: "text-[#9012fe]", dark: "dark:text-[#c084fc]" },
}

export function getStatusClasses(status: number): string {
  if (status >= 500) return "text-rose-600 dark:text-rose-400"
  if (status >= 400) return "text-orange-600 dark:text-orange-400"
  if (status >= 300) return "text-blue-600 dark:text-blue-400"
  if (status >= 200) return "text-emerald-600 dark:text-emerald-400"
  return "text-muted-foreground"
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}
