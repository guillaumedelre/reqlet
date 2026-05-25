import { useRef, useState } from "react"

import type { OnMount } from "@monaco-editor/react"

import { CodeEditor } from "@/components/ui/code-editor"
import { guessExt } from "@/lib/response"
import { useTabsStore, type HttpTimings, type ResponseData } from "@/store/tabs"

type ResponseSubTab = "Pretty" | "Raw" | "Headers" | "Preview" | "Visualize"
type MonacoEditor = Parameters<OnMount>[0]

const RESPONSE_TABS: ResponseSubTab[] = ["Pretty", "Raw", "Headers", "Preview", "Visualize"]

const TIMELINE_PHASES: { key: keyof HttpTimings; label: string; color: string }[] = [
  { key: "dns", label: "DNS Lookup", color: "#f90" },
  { key: "tcp", label: "TCP Handshake", color: "#0c6" },
  { key: "tls", label: "TLS Handshake", color: "#c33" },
  { key: "ttfb", label: "Wait (TTFB)", color: "#26f" },
  { key: "download", label: "Download", color: "#a4f" },
]

function statusColor(status: number): string {
  if (status < 200) return "var(--fg-muted)"
  if (status < 300) return "#49cc90"
  if (status < 400) return "#61affe"
  if (status < 500) return "#fca130"
  return "#f93e3e"
}

function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(2)} KB`
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

function contentTypeToMonacoLang(ct: string): string {
  if (ct.includes("json")) return "json"
  if (ct.includes("xml")) return "xml"
  if (ct.includes("html")) return "html"
  if (ct.includes("javascript")) return "javascript"
  if (ct.includes("css")) return "css"
  return "plaintext"
}

function tryPrettyJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function TimingPopover({ timings }: { timings: HttpTimings | undefined }) {
  const popoverStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    background: "var(--bg-panel)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "8px 12px",
    zIndex: 100,
    minWidth: 240,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  }

  if (!timings) {
    return (
      <div style={popoverStyle}>
        <p style={{ margin: 0, fontSize: 10, color: "var(--fg-muted)" }}>
          Detailed timings available once the HTTP engine is wired up (Bloc C).
        </p>
      </div>
    )
  }

  const total = TIMELINE_PHASES.reduce((sum, { key }) => sum + timings[key], 0)
  let offset = 0

  return (
    <div style={popoverStyle}>
      {TIMELINE_PHASES.map(({ key, label, color }) => {
        const duration = timings[key]
        const leftPct = total > 0 ? (offset / total) * 100 : 0
        const widthPct = total > 0 ? (duration / total) * 100 : 0
        offset += duration
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 110,
                fontSize: 10,
                color: "var(--fg-muted)",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {label}
            </span>
            <div
              style={{
                flex: 1,
                height: 10,
                position: "relative",
                background: "var(--border)",
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 2,
                }}
              />
            </div>
            <span
              style={{
                width: 52,
                fontSize: 10,
                color: "var(--fg)",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {duration.toFixed(2)} ms
            </span>
          </div>
        )
      })}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: 6,
          paddingTop: 4,
          display: "flex",
          justifyContent: "flex-end",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 10, color: "var(--fg-muted)" }}>Total</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--fg)" }}>
          {total.toFixed(2)} ms
        </span>
      </div>
    </div>
  )
}

function StatusBar({ response, url }: { response: ResponseData; url: string }) {
  const [copied, setCopied] = useState(false)
  const [showTimings, setShowTimings] = useState(false)
  const color = statusColor(response.status)

  function handleCopy() {
    navigator.clipboard?.writeText(response.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleSave() {
    const ext = guessExt(response.contentType)
    const blob = new Blob([response.body], { type: response.contentType })
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = `response.${ext}`
    a.click()
    URL.revokeObjectURL(href)
  }

  // suppress unused-var warning — url will be used for filename inference once Send is wired
  void url

  const btnStyle: React.CSSProperties = {
    fontSize: 11,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--fg-muted)",
    cursor: "pointer",
    padding: "1px 8px",
    borderRadius: 3,
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "4px 10px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          background: `${color}1a`,
          padding: "1px 6px",
          borderRadius: 3,
        }}
      >
        {response.status}
      </span>
      <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{response.statusText}</span>
      <span style={{ fontSize: 11, color: "var(--fg-muted)", marginLeft: "auto" }}>
        <span
          style={{
            position: "relative",
            cursor: "pointer",
            textDecoration: "underline dotted",
          }}
          onMouseEnter={() => setShowTimings(true)}
          onMouseLeave={() => setShowTimings(false)}
          aria-label="Show timing breakdown"
        >
          {response.time} ms
          {showTimings && <TimingPopover timings={response.timings} />}
        </span>
      </span>
      <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{formatSize(response.size)}</span>
      <button onClick={handleCopy} title="Copy response body" style={btnStyle}>
        {copied ? "Copied!" : "Copy"}
      </button>
      <button onClick={handleSave} title="Download response" style={btnStyle}>
        Save
      </button>
    </div>
  )
}

function PrettyBody({
  response,
  wordWrap,
  onEditorMount,
}: {
  response: ResponseData
  wordWrap: "on" | "off"
  onEditorMount: (editor: MonacoEditor) => void
}) {
  const isJson =
    response.contentType.includes("application/json") || response.contentType.includes("+json")
  const content = isJson ? tryPrettyJson(response.body) : response.body

  if (!content) {
    return (
      <p style={{ padding: "10px 12px", fontSize: 11, color: "var(--fg-muted)" }}>
        Empty response body.
      </p>
    )
  }

  const handleMount: OnMount = (editor) => {
    onEditorMount(editor)
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <CodeEditor
        value={content}
        language={contentTypeToMonacoLang(response.contentType)}
        readOnly
        wordWrap={wordWrap}
        onMount={handleMount}
      />
    </div>
  )
}

function RawBody({ body }: { body: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "10px 12px",
        fontSize: 11,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        color: "var(--fg)",
        lineHeight: 1.6,
      }}
    >
      {body || <span style={{ color: "var(--fg-muted)" }}>Empty response body.</span>}
    </pre>
  )
}

function HeadersList({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return (
      <p style={{ padding: "10px 12px", fontSize: 11, color: "var(--fg-muted)" }}>
        No response headers.
      </p>
    )
  }
  return (
    <div>
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: "3px 12px",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--fg-muted)", fontWeight: 600, wordBreak: "break-all" }}>
            {key}
          </span>
          <span style={{ color: "var(--fg)", wordBreak: "break-all" }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewBody({ body }: { body: string }) {
  if (!body) {
    return (
      <p style={{ padding: "10px 12px", fontSize: 11, color: "var(--fg-muted)" }}>
        Empty response body.
      </p>
    )
  }
  return (
    <iframe
      sandbox=""
      srcDoc={body}
      title="Response preview"
      style={{ flex: 1, border: "none", width: "100%", height: "100%", background: "#fff" }}
    />
  )
}

function VisualizeBody() {
  return (
    <p style={{ padding: "10px 12px", fontSize: 11, color: "var(--fg-muted)" }}>
      Visualize data is set via{" "}
      <code style={{ fontFamily: "monospace" }}>pm.visualizer.set(template, data)</code> in the
      Tests script. Available once the script engine is wired up (section 2.14).
    </p>
  )
}

export function ResponsePane() {
  const { tabs, activeTabId } = useTabsStore()
  const tab = tabs.find((t) => t.id === activeTabId)
  const [subTab, setSubTab] = useState<ResponseSubTab>("Pretty")
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on")
  const editorRef = useRef<MonacoEditor | null>(null)

  const subTabStyle = (t: ResponseSubTab): React.CSSProperties => ({
    fontSize: 11,
    border: "none",
    background: "transparent",
    color: subTab === t ? "var(--fg)" : "var(--fg-muted)",
    cursor: "pointer",
    padding: "6px 10px",
    borderBottom: subTab === t ? "2px solid var(--accent)" : "2px solid transparent",
    marginBottom: -1,
    whiteSpace: "nowrap",
  })

  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 10,
    border: `1px solid ${active ? "var(--fg-muted)" : "var(--border)"}`,
    background: "transparent",
    color: active ? "var(--fg)" : "var(--fg-muted)",
    cursor: "pointer",
    padding: "1px 6px",
    borderRadius: 3,
  })

  if (!tab?.response) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-panel)",
        }}
      >
        <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: 0 }}>
          Hit <strong>Send</strong> to get a response.
        </p>
      </div>
    )
  }

  const { response } = tab

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
        overflow: "hidden",
      }}
    >
      <StatusBar response={response} url={tab.url} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", padding: "0 4px", flex: 1 }}>
          {RESPONSE_TABS.map((t) => (
            <button key={t} onClick={() => setSubTab(t)} style={subTabStyle(t)}>
              {t}
            </button>
          ))}
        </div>
        {subTab === "Pretty" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0 8px",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setWordWrap((w) => (w === "on" ? "off" : "on"))}
              aria-label={wordWrap === "on" ? "Disable word wrap" : "Enable word wrap"}
              title={wordWrap === "on" ? "Disable word wrap" : "Enable word wrap"}
              style={toolBtnStyle(wordWrap === "on")}
            >
              Wrap
            </button>
            <button
              onClick={() => editorRef.current?.getAction("actions.find")?.run()}
              aria-label="Search in response (Ctrl+F)"
              title="Search in response (Ctrl+F)"
              style={toolBtnStyle(false)}
            >
              Search
            </button>
          </div>
        )}
      </div>
      {subTab === "Pretty" && (
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <PrettyBody
            response={response}
            wordWrap={wordWrap}
            onEditorMount={(editor) => {
              editorRef.current = editor
            }}
          />
        </div>
      )}
      {subTab === "Raw" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <RawBody body={response.body} />
        </div>
      )}
      {subTab === "Headers" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <HeadersList headers={response.headers} />
        </div>
      )}
      {subTab === "Preview" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <PreviewBody body={response.body} />
        </div>
      )}
      {subTab === "Visualize" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <VisualizeBody />
        </div>
      )}
    </div>
  )
}
