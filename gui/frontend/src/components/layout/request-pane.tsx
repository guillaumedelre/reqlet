import { useEffect, useRef, useState } from "react"

import { KeyValueEditor } from "@/components/ui/key-value-editor"
import { HTTP_METHOD_COLORS } from "@/lib/http-methods"
import { assembleUrl, mergeParams, parseUrl } from "@/lib/url"
import { useTabsStore, type HttpMethod, type KeyValueItem, type RequestSubTab } from "@/store/tabs"

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
const REQUEST_TABS: RequestSubTab[] = ["Params", "Auth", "Headers", "Body", "Scripts"]

function MethodSelect({
  value,
  onChange,
}: {
  value: HttpMethod
  onChange: (m: HttpMethod) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 6px 3px 8px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 4,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: HTTP_METHOD_COLORS[value],
          cursor: "pointer",
          minWidth: 80,
        }}
      >
        <span style={{ flex: 1 }}>{value}</span>
        <span style={{ color: "var(--fg-muted)", fontSize: 9, lineHeight: 1 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 3px)",
            left: 0,
            zIndex: 100,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 110,
          }}
        >
          {HTTP_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => {
                onChange(m)
                setOpen(false)
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 10px",
                border: "none",
                background: m === value ? `${HTTP_METHOD_COLORS[m]}1a` : "transparent",
                color: HTTP_METHOD_COLORS[m],
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SubTabContent({
  subTab,
  params,
  headers,
  onParamsChange,
  onHeadersChange,
}: {
  subTab: RequestSubTab
  params: KeyValueItem[]
  headers: KeyValueItem[]
  onParamsChange: (items: KeyValueItem[]) => void
  onHeadersChange: (items: KeyValueItem[]) => void
}) {
  if (subTab === "Params") {
    return <KeyValueEditor items={params} onChange={onParamsChange} />
  }
  if (subTab === "Headers") {
    return <KeyValueEditor items={headers} onChange={onHeadersChange} />
  }
  return (
    <div style={{ padding: 12 }}>
      <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>{subTab} — coming soon.</p>
    </div>
  )
}

export function RequestPane() {
  const { tabs, activeTabId, updateTab } = useTabsStore()
  const tab = tabs.find((t) => t.id === activeTabId)

  if (!tab) {
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
        <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>No tab open.</p>
      </div>
    )
  }

  const displayUrl = assembleUrl(tab.url, tab.params)

  function setMethod(method: HttpMethod) {
    updateTab(tab!.id, { method, dirty: !!tab!.url })
  }

  function handleUrlChange(raw: string) {
    const { base, params: parsed } = parseUrl(raw)
    const params = mergeParams(tab!.params, parsed)
    updateTab(tab!.id, { url: base, params, dirty: !!raw })
  }

  function handleParamsChange(params: KeyValueItem[]) {
    updateTab(tab!.id, { params, dirty: !!tab!.url || params.some((p) => !!p.key) })
  }

  function handleHeadersChange(headers: KeyValueItem[]) {
    updateTab(tab!.id, { headers, dirty: !!tab!.url || headers.some((h) => !!h.key) })
  }

  const enabledParamsCount = tab.params.filter((p) => p.enabled && p.key).length
  const enabledHeadersCount = tab.headers.filter((h) => h.enabled && h.key).length

  function subTabLabel(t: RequestSubTab): string {
    if (t === "Params" && enabledParamsCount > 0) return `Params (${enabledParamsCount})`
    if (t === "Headers" && enabledHeadersCount > 0) return `Headers (${enabledHeadersCount})`
    return t
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <MethodSelect value={tab.method} onChange={setMethod} />
        <input
          value={displayUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          style={{
            flex: 1,
            padding: "3px 8px",
            fontSize: 11,
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
            outline: "none",
          }}
          placeholder="Enter URL"
        />
        <button
          style={{
            padding: "3px 14px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
      <div
        style={{
          display: "flex",
          padding: "0 4px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {REQUEST_TABS.map((t) => (
          <button
            key={t}
            onClick={() => updateTab(tab.id, { activeSubTab: t })}
            style={{
              fontSize: 11,
              border: "none",
              background: "transparent",
              color: tab.activeSubTab === t ? "var(--fg)" : "var(--fg-muted)",
              cursor: "pointer",
              padding: "6px 10px",
              borderBottom:
                tab.activeSubTab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {subTabLabel(t)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SubTabContent
          subTab={tab.activeSubTab}
          params={tab.params}
          headers={tab.headers}
          onParamsChange={handleParamsChange}
          onHeadersChange={handleHeadersChange}
        />
      </div>
    </div>
  )
}
