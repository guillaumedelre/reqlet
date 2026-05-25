export function guessExt(contentType: string): string {
  if (contentType.includes("json")) return "json"
  if (contentType.includes("xml")) return "xml"
  if (contentType.includes("html")) return "html"
  if (contentType.includes("css")) return "css"
  if (contentType.includes("javascript")) return "js"
  if (contentType.includes("csv")) return "csv"
  return "txt"
}
