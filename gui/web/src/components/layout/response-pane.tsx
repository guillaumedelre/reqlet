import {
  Copy,
  Check,
  Clock,
  Database,
  ArrowDown,
  Download,
  AlignLeft,
  AlignJustify,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { CodeEditor } from "@/components/ui/code-editor"
import { cn } from "@/lib/utils"
import { getStatusClasses, formatTime, formatSize } from "@/lib/http"
import { useTabsStore } from "@/store/tabs"
import type { ResponseSubTab } from "@/types"

function guessLanguage(contentType: string): string {
  if (contentType.includes("json")) return "json"
  if (contentType.includes("xml")) return "xml"
  if (contentType.includes("html")) return "html"
  if (contentType.includes("javascript")) return "javascript"
  if (contentType.includes("css")) return "css"
  return "plaintext"
}

function downloadBody(body: string, contentType: string) {
  const ext = contentType.includes("json")
    ? ".json"
    : contentType.includes("xml")
      ? ".xml"
      : contentType.includes("html")
        ? ".html"
        : contentType.includes("css")
          ? ".css"
          : contentType.includes("javascript")
            ? ".js"
            : ".txt"
  const blob = new Blob([body], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `response${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Send a request</p>
        <p className="text-xs text-muted-foreground mt-0.5">The response will be displayed here</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border shrink-0">
        <Skeleton className="h-5 w-12 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className="flex-1 p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  )
}

type BodyView = "pretty" | "raw" | "preview"

function parseCookies(headers: Record<string, string>): Array<{
  name: string
  value: string
  domain: string
  path: string
  expires: string
  httpOnly: boolean
  secure: boolean
}> {
  const raw = headers["set-cookie"] ?? headers["Set-Cookie"] ?? ""
  if (!raw) return []
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [nameVal, ...attrs] = line.split(";").map((s) => s.trim())
      const eq = nameVal.indexOf("=")
      const name = eq === -1 ? nameVal : nameVal.slice(0, eq).trim()
      const value = eq === -1 ? "" : nameVal.slice(eq + 1).trim()
      const attrMap: Record<string, string | boolean> = {}
      for (const a of attrs) {
        const aEq = a.indexOf("=")
        if (aEq === -1) attrMap[a.toLowerCase()] = true
        else attrMap[a.slice(0, aEq).toLowerCase()] = a.slice(aEq + 1)
      }
      return {
        name,
        value,
        domain: (attrMap["domain"] as string) ?? "",
        path: (attrMap["path"] as string) ?? "/",
        expires: (attrMap["expires"] as string) ?? "",
        httpOnly: "httponly" in attrMap,
        secure: "secure" in attrMap,
      }
    })
}

function ResponseBody({
  body,
  contentType,
  view,
  wordWrap,
}: {
  body: string
  contentType: string
  view: BodyView
  wordWrap: boolean
}) {
  const isJson = contentType.includes("json")
  const isHtml = contentType.includes("html")

  let formatted = body
  if (view === "pretty" && isJson && body) {
    try {
      formatted = JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      /* keep */
    }
  }

  if (!body) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground">No body content</p>
      </div>
    )
  }

  if (view === "preview") {
    return isHtml ? (
      <iframe
        sandbox="allow-scripts"
        srcDoc={body}
        className="w-full h-full border-0"
        title="response-preview"
      />
    ) : (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Preview only available for HTML responses</p>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div className="absolute top-2 right-3 z-10 flex items-center gap-1 pointer-events-auto">
        <Badge variant="secondary" className="text-[0.625rem] h-5 px-1.5">
          {isJson ? "JSON" : (contentType.split("/")[1] ?? "text")}
        </Badge>
        <CopyButton text={formatted} />
      </div>
      <CodeEditor
        value={formatted}
        readOnly
        language={guessLanguage(contentType)}
        wordWrap={wordWrap}
      />
    </div>
  )
}

function ResponseHeaders({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="flex text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 border-b border-border mb-1">
          <span className="flex-1">Header</span>
          <span className="flex-1">Value</span>
        </div>
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-start gap-2 px-2 py-1 rounded hover:bg-muted/30 group"
          >
            <span className="flex-1 text-xs font-mono text-primary truncate">{key}</span>
            <span className="flex-1 text-xs font-mono text-foreground break-all">{value}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

function Timeline({ time }: { time: number }) {
  const phases = [
    { label: "DNS Lookup", ms: Math.floor(time * 0.03) },
    { label: "TCP Connect", ms: Math.floor(time * 0.08) },
    { label: "TLS Handshake", ms: Math.floor(time * 0.1) },
    { label: "Request Sent", ms: Math.floor(time * 0.02) },
    { label: "Waiting (TTFB)", ms: Math.floor(time * 0.6) },
    { label: "Content Download", ms: Math.floor(time * 0.17) },
  ]
  const total = phases.reduce((s, p) => s + p.ms, 0)

  const colors = [
    "bg-violet-400",
    "bg-blue-400",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-orange-400",
    "bg-rose-400",
  ]

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Bar */}
        <div className="flex h-2 rounded overflow-hidden gap-px">
          {phases.map((p, i) => (
            <div
              key={p.label}
              className={cn("h-full", colors[i])}
              style={{ width: `${(p.ms / total) * 100}%` }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="space-y-1">
          {phases.map((p, i) => (
            <div key={p.label} className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-sm shrink-0", colors[i])} />
              <span className="text-xs text-muted-foreground flex-1">{p.label}</span>
              <span className="text-xs font-mono text-foreground">{p.ms} ms</span>
              <div className="w-24 h-1.5 bg-muted rounded overflow-hidden">
                <div
                  className={cn("h-full rounded", colors[i])}
                  style={{ width: `${(p.ms / time) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-1 border-t border-border text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono font-semibold text-foreground">{time} ms</span>
        </div>
      </div>
    </ScrollArea>
  )
}

export function ResponsePane() {
  const { tabs, activeTabId, setTabResponseSubTab } = useTabsStore()
  const [bodyView, setBodyView] = useState<BodyView>("pretty")
  const [wordWrap, setWordWrap] = useState(true)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isSending = activeTab?.isSending ?? false
  const response = activeTab?.response ?? null
  const responseSubTab = activeTab?.responseSubTab ?? "body"
  const setResponseSubTab = (v: ResponseSubTab) => setTabResponseSubTab(activeTabId, v)

  if (isSending) return <LoadingState />
  if (!response) return <EmptyState />

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 h-9 border-b border-border shrink-0 bg-card">
        <Badge
          variant="outline"
          className={cn(
            "text-[0.6875rem] h-5 px-2 font-bold border",
            getStatusClasses(response.status),
          )}
        >
          {response.status} {response.statusText}
        </Badge>

        <div className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span
            className={cn(
              "font-mono",
              response.time > 1000 ? "text-orange-500" : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {formatTime(response.time)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
          <Database className="h-3 w-3" />
          <span className="font-mono">{formatSize(response.size)}</span>
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => downloadBody(response.body, response.contentType)}
          title="Save response"
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs
        value={responseSubTab}
        onValueChange={(v) => setResponseSubTab(v as typeof responseSubTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="border-b border-border shrink-0 px-1">
          <TabsList className="h-8 bg-transparent gap-0 rounded-none p-0">
            {[
              { value: "body", label: "Body", badge: null as number | null },
              { value: "headers", label: "Headers", badge: Object.keys(response.headers).length },
              { value: "cookies", label: "Cookies", badge: null },
              { value: "timeline", label: "Timeline", badge: null },
            ].map(({ value, label, badge }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-8 px-3 text-xs rounded-none border-0 border-b-2 border-transparent !bg-transparent !shadow-none data-active:border-primary data-active:text-foreground dark:data-active:!bg-transparent gap-1"
              >
                {label}
                {badge ? (
                  <Badge variant="secondary" className="h-3.5 min-w-3.5 px-1 text-[9px]">
                    {badge}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="body" className="flex-1 overflow-hidden mt-0 flex flex-col">
          {/* Body toolbar */}
          <div className="flex items-center gap-1 px-2 border-b border-border shrink-0 h-7">
            {(["pretty", "raw", "preview"] as BodyView[]).map((v) => (
              <button
                key={v}
                onClick={() => setBodyView(v)}
                className={cn(
                  "px-2 py-0.5 text-[0.6875rem] rounded transition-colors capitalize",
                  bodyView === v
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setWordWrap((w) => !w)}
              title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
              className={cn(
                "h-5 w-5 flex items-center justify-center rounded transition-colors",
                wordWrap ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {wordWrap ? <AlignJustify className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ResponseBody
              body={response.body}
              contentType={response.contentType}
              view={bodyView}
              wordWrap={wordWrap}
            />
          </div>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 overflow-hidden mt-0">
          <ResponseHeaders headers={response.headers} />
        </TabsContent>

        <TabsContent value="cookies" className="flex-1 overflow-hidden mt-0">
          {(() => {
            const cookies = parseCookies(response.headers)
            if (!cookies.length)
              return (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No cookies received</p>
                </div>
              )
            return (
              <ScrollArea className="h-full">
                <div className="p-2">
                  <div className="flex text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 border-b border-border mb-1 gap-2">
                    <span className="w-32 shrink-0">Name</span>
                    <span className="flex-1">Value</span>
                    <span className="w-16 shrink-0 text-right">Flags</span>
                  </div>
                  {cookies.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-2 py-1 hover:bg-muted/30 rounded group"
                    >
                      <span className="w-32 shrink-0 text-xs font-mono text-primary truncate">
                        {c.name}
                      </span>
                      <span className="flex-1 text-xs font-mono text-foreground break-all">
                        {c.value}
                      </span>
                      <div className="w-16 shrink-0 flex justify-end gap-1">
                        {c.httpOnly && (
                          <span className="text-[9px] bg-muted px-1 rounded font-medium">
                            HttpOnly
                          </span>
                        )}
                        {c.secure && (
                          <span className="text-[9px] bg-muted px-1 rounded font-medium">
                            Secure
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )
          })()}
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 overflow-hidden mt-0">
          <Timeline time={response.time} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
