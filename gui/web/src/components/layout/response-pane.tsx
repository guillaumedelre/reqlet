import { useState } from "react"

import { CodeEditor } from "@/components/ui/code-editor"
import { guessExt } from "@/lib/response"
import { useTabsStore, type ResponseData } from "@/store/tabs"

type ResponseSubTab = "Pretty" | "Raw" | "Headers" | "Preview" | "Visualize"

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

function StatusBar({ response, url }: { response: ResponseData; url: string }) {
  const color = statusColor(response.status)

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
        {response.time} ms
      </span>
      <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{formatSize(response.size)}</span>
      <button
        onClick={handleSave}
        title="Download response"
        style={{
          fontSize: 11,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--fg-muted)",
          cursor: "pointer",
          padding: "1px 8px",
          borderRadius: 3,
        }}
      >
        Save
      </button>
    </div>
  )
}

function PrettyBody({ response }: { response: ResponseData }) {
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

  return (
    <CodeEditor value={content} language={contentTypeToMonacoLang(response.contentType)} readOnly />
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

  if (!tab?.response) {
    return (
      <div
        style={{
          flex: 1,
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
        flex: 1,
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
          padding: "0 4px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {(["Pretty", "Raw", "Headers", "Preview", "Visualize"] as ResponseSubTab[]).map((t) => (
          <button key={t} onClick={() => setSubTab(t)} style={subTabStyle(t)}>
            {t}
          </button>
        ))}
      </div>
      {subTab === "Pretty" && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <PrettyBody response={response} />
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
