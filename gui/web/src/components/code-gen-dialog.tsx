import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import type { RequestState, KeyValuePair, AuthConfig } from "@/types"

// ---------- Generators ----------

function buildFinalUrl(url: string, params: KeyValuePair[]): string {
  const enabled = params.filter((p) => p.enabled && p.key)
  if (!enabled.length) return url
  const base = url.includes("?") ? url.slice(0, url.indexOf("?")) : url
  return `${base}?${enabled.map((p) => `${p.key}=${p.value}`).join("&")}`
}

function getAuthEntries(auth: AuthConfig): Array<[string, string]> {
  if (auth.type === "bearer" && auth.bearer?.token)
    return [["Authorization", `Bearer ${auth.bearer.token}`]]
  if (auth.type === "basic" && auth.basic)
    return [["Authorization", `Basic ${btoa(`${auth.basic.username}:${auth.basic.password}`)}`]]
  if (auth.type === "api-key" && auth.apiKey?.addTo === "header")
    return [[auth.apiKey.key, auth.apiKey.value]]
  return []
}

function allHeaders(req: RequestState): Array<[string, string]> {
  const base = req.headers
    .filter((h) => h.enabled && h.key)
    .map((h): [string, string] => [h.key, h.value])
  return [...base, ...getAuthEntries(req.auth)]
}

function bodyString(req: RequestState): string {
  if (req.body.type === "none") return ""
  if (req.body.type === "raw") return req.body.raw
  if (req.body.type === "x-www-form-urlencoded")
    return req.body.urlencoded
      .filter((p) => p.enabled && p.key)
      .map((p) => `${p.key}=${p.value}`)
      .join("&")
  return ""
}

function genCurl(req: RequestState): string {
  const url = buildFinalUrl(req.url, req.params)
  const lines: string[] = [`curl -X ${req.method} '${url}'`]
  for (const [k, v] of allHeaders(req)) lines.push(`  -H '${k}: ${v}'`)
  if (req.body.type === "raw" && req.body.rawContentType)
    lines.push(`  -H 'Content-Type: ${req.body.rawContentType}'`)
  const body = bodyString(req)
  if (body) lines.push(`  -d '${body.replace(/'/g, "'\\''")}'`)
  return lines.join(" \\\n")
}

function genPython(req: RequestState): string {
  const url = buildFinalUrl(req.url, req.params)
  const headers = allHeaders(req)
  if (req.body.type === "raw" && req.body.rawContentType)
    headers.push(["Content-Type", req.body.rawContentType])
  const body = bodyString(req)

  const lines = ["import requests", ""]
  lines.push(`url = "${url}"`)
  if (headers.length) {
    lines.push("headers = {")
    for (const [k, v] of headers) lines.push(`    "${k}": "${v}",`)
    lines.push("}")
  } else {
    lines.push("headers = {}")
  }
  if (body) lines.push(`data = '${body}'`)
  lines.push("")

  const kwArgs = ["url", "headers=headers"]
  if (body) kwArgs.push("data=data")
  lines.push(`response = requests.${req.method.toLowerCase()}(${kwArgs.join(", ")})`)
  lines.push("print(response.status_code)")
  lines.push("print(response.text)")
  return lines.join("\n")
}

function genJS(req: RequestState): string {
  const url = buildFinalUrl(req.url, req.params)
  const headers = allHeaders(req)
  if (req.body.type === "raw" && req.body.rawContentType)
    headers.push(["Content-Type", req.body.rawContentType])
  const body = bodyString(req)

  const opts: string[] = [`  method: '${req.method}'`]
  if (headers.length) {
    opts.push("  headers: {")
    for (const [k, v] of headers) opts.push(`    '${k}': '${v}',`)
    opts.push("  }")
  }
  if (body) opts.push(`  body: \`${body.replace(/`/g, "\\`")}\``)

  return [
    `const response = await fetch('${url}', {`,
    ...opts.map((l) => `${l},`),
    "});",
    "",
    "const data = await response.text();",
    "console.log(data);",
  ].join("\n")
}

function genGo(req: RequestState): string {
  const url = buildFinalUrl(req.url, req.params)
  const headers = allHeaders(req)
  if (req.body.type === "raw" && req.body.rawContentType)
    headers.push(["Content-Type", req.body.rawContentType])
  const body = bodyString(req)

  const lines = [
    "package main",
    "",
    "import (",
    '\t"fmt"',
    '\t"io"',
    '\t"net/http"',
    body ? '\t"strings"' : "",
    ")",
    "",
    "func main() {",
  ].filter((l) => l !== undefined)

  if (body) {
    lines.push(`\tbody := strings.NewReader(\`${body}\`)`)
    lines.push(`\treq, _ := http.NewRequest("${req.method}", "${url}", body)`)
  } else {
    lines.push(`\treq, _ := http.NewRequest("${req.method}", "${url}", nil)`)
  }

  for (const [k, v] of headers) lines.push(`\treq.Header.Set("${k}", "${v}")`)

  lines.push(
    "",
    "\tclient := &http.Client{}",
    "\tresp, err := client.Do(req)",
    "\tif err != nil { panic(err) }",
    "\tdefer resp.Body.Close()",
    "\trespBody, _ := io.ReadAll(resp.Body)",
    "\tfmt.Println(string(respBody))",
    "}",
  )
  return lines.join("\n")
}

// ---------- CopyButton ----------

function CopySnippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handle}>
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

// ---------- CodeSnippets (tab content, reusable) ----------

const LANGS = [
  { id: "curl", label: "cURL", gen: genCurl },
  { id: "python", label: "Python", gen: genPython },
  { id: "javascript", label: "JavaScript", gen: genJS },
  { id: "go", label: "Go", gen: genGo },
] as const

export function CodeSnippets({ request }: { request: RequestState }) {
  const [lang, setLang] = useState<string>("curl")

  return (
    <Tabs value={lang} onValueChange={setLang} className="flex flex-col h-full">
      <div className="border-b border-border px-3 shrink-0">
        <TabsList className="h-8 bg-transparent gap-0 rounded-none p-0">
          {LANGS.map((l) => (
            <TabsTrigger
              key={l.id}
              value={l.id}
              className="h-8 px-3 text-xs rounded-none border-0 border-b-2 border-transparent !bg-transparent !shadow-none data-active:border-primary data-active:text-foreground"
            >
              {l.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {LANGS.map((l) => (
          <TabsContent key={l.id} value={l.id} className="absolute inset-0 mt-0 overflow-auto">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopySnippet text={l.gen(request)} />
              </div>
              <pre className="p-4 pr-10 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-all">
                {l.gen(request)}
              </pre>
            </div>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

// ---------- CodeGenDialog ----------

interface CodeGenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: RequestState
}

export function CodeGenDialog({ open, onOpenChange, request }: CodeGenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="text-sm font-semibold">Code Snippet</DialogTitle>
        </DialogHeader>
        <div className="h-80">
          <CodeSnippets request={request} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
