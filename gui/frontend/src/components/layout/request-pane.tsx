import { useEffect, useRef, useState } from "react"

import { KeyValueEditor } from "@/components/ui/key-value-editor"
import { HTTP_METHOD_COLORS } from "@/lib/http-methods"
import { assembleUrl, extractPathVarNames, mergeParams, mergePathVars, parseUrl } from "@/lib/url"
import {
  useTabsStore,
  type BodyType,
  type HttpMethod,
  type KeyValueItem,
  type RawContentType,
  type RequestSubTab,
} from "@/store/tabs"

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
const REQUEST_TABS: RequestSubTab[] = ["Params", "Auth", "Headers", "Body", "Scripts"]
const BODY_TYPES: BodyType[] = ["none", "form-data", "urlencoded", "raw", "binary", "GraphQL"]
const RAW_CONTENT_TYPES: RawContentType[] = ["JSON", "XML", "Text", "HTML", "JavaScript"]

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

const sectionLabelStyle: React.CSSProperties = {
  padding: "5px 8px 3px",
  fontSize: 10,
  fontWeight: 600,
  color: "var(--fg-muted)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
}

function bodyTypeLabel(t: BodyType): string {
  if (t === "urlencoded") return "x-www-form-urlencoded"
  return t
}

function BodyEditor({
  bodyType,
  bodyRaw,
  bodyRawContentType,
  bodyFormData,
  bodyUrlencoded,
  onBodyTypeChange,
  onBodyRawChange,
  onBodyRawContentTypeChange,
  onBodyFormDataChange,
  onBodyUrlencodedChange,
}: {
  bodyType: BodyType
  bodyRaw: string
  bodyRawContentType: RawContentType
  bodyFormData: KeyValueItem[]
  bodyUrlencoded: KeyValueItem[]
  onBodyTypeChange: (t: BodyType) => void
  onBodyRawChange: (v: string) => void
  onBodyRawContentTypeChange: (t: RawContentType) => void
  onBodyFormDataChange: (items: KeyValueItem[]) => void
  onBodyUrlencodedChange: (items: KeyValueItem[]) => void
}) {
  const typeBtn = (t: BodyType): React.CSSProperties => ({
    fontSize: 11,
    border: "none",
    background: bodyType === t ? "var(--bg)" : "transparent",
    color: bodyType === t ? "var(--fg)" : "var(--fg-muted)",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 3,
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "4px 8px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        {BODY_TYPES.map((t) => (
          <button key={t} onClick={() => onBodyTypeChange(t)} style={typeBtn(t)}>
            {bodyTypeLabel(t)}
          </button>
        ))}
        {bodyType === "raw" && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 1,
              background: "var(--bg-sidebar)",
              borderRadius: 3,
              padding: 2,
            }}
          >
            {RAW_CONTENT_TYPES.map((ct) => (
              <button
                key={ct}
                onClick={() => onBodyRawContentTypeChange(ct)}
                style={{
                  fontSize: 10,
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: 2,
                  background: bodyRawContentType === ct ? "var(--bg)" : "transparent",
                  color: bodyRawContentType === ct ? "var(--fg)" : "var(--fg-muted)",
                }}
              >
                {ct}
              </button>
            ))}
          </div>
        )}
      </div>

      {bodyType === "none" && (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>This request has no body.</p>
        </div>
      )}

      {bodyType === "raw" && (
        <textarea
          value={bodyRaw}
          onChange={(e) => onBodyRawChange(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            resize: "none",
            border: "none",
            outline: "none",
            padding: "8px 10px",
            fontSize: 11,
            fontFamily: "monospace",
            background: "var(--bg-panel)",
            color: "var(--fg)",
            lineHeight: 1.5,
          }}
          placeholder={`Enter ${bodyRawContentType} body`}
        />
      )}

      {bodyType === "form-data" && (
        <KeyValueEditor
          items={bodyFormData}
          onChange={onBodyFormDataChange}
          keyPlaceholder="Key"
          valuePlaceholder="Value"
        />
      )}

      {bodyType === "urlencoded" && (
        <KeyValueEditor
          items={bodyUrlencoded}
          onChange={onBodyUrlencodedChange}
          keyPlaceholder="Key"
          valuePlaceholder="Value"
        />
      )}

      {(bodyType === "binary" || bodyType === "GraphQL") && (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            {bodyTypeLabel(bodyType)} — coming soon.
          </p>
        </div>
      )}
    </div>
  )
}

function SubTabContent({
  subTab,
  params,
  headers,
  pathVars,
  bodyType,
  bodyRaw,
  bodyRawContentType,
  bodyFormData,
  bodyUrlencoded,
  onParamsChange,
  onHeadersChange,
  onPathVarsChange,
  onBodyTypeChange,
  onBodyRawChange,
  onBodyRawContentTypeChange,
  onBodyFormDataChange,
  onBodyUrlencodedChange,
}: {
  subTab: RequestSubTab
  params: KeyValueItem[]
  headers: KeyValueItem[]
  pathVars: KeyValueItem[]
  bodyType: BodyType
  bodyRaw: string
  bodyRawContentType: RawContentType
  bodyFormData: KeyValueItem[]
  bodyUrlencoded: KeyValueItem[]
  onParamsChange: (items: KeyValueItem[]) => void
  onHeadersChange: (items: KeyValueItem[]) => void
  onPathVarsChange: (items: KeyValueItem[]) => void
  onBodyTypeChange: (t: BodyType) => void
  onBodyRawChange: (v: string) => void
  onBodyRawContentTypeChange: (t: RawContentType) => void
  onBodyFormDataChange: (items: KeyValueItem[]) => void
  onBodyUrlencodedChange: (items: KeyValueItem[]) => void
}) {
  if (subTab === "Params") {
    return (
      <div style={{ overflowY: "auto", flex: 1 }}>
        {pathVars.length > 0 && (
          <>
            <div style={sectionLabelStyle}>Path Variables</div>
            <KeyValueEditor
              items={pathVars}
              onChange={onPathVarsChange}
              valuePlaceholder="Value"
              readOnlyKeys
            />
            <div
              style={{ ...sectionLabelStyle, borderTop: "1px solid var(--border)", marginTop: 2 }}
            >
              Query Params
            </div>
          </>
        )}
        <KeyValueEditor items={params} onChange={onParamsChange} />
      </div>
    )
  }
  if (subTab === "Headers") {
    return (
      <div style={{ overflowY: "auto", flex: 1 }}>
        <KeyValueEditor items={headers} onChange={onHeadersChange} />
      </div>
    )
  }
  if (subTab === "Body") {
    return (
      <BodyEditor
        bodyType={bodyType}
        bodyRaw={bodyRaw}
        bodyRawContentType={bodyRawContentType}
        bodyFormData={bodyFormData}
        bodyUrlencoded={bodyUrlencoded}
        onBodyTypeChange={onBodyTypeChange}
        onBodyRawChange={onBodyRawChange}
        onBodyRawContentTypeChange={onBodyRawContentTypeChange}
        onBodyFormDataChange={onBodyFormDataChange}
        onBodyUrlencodedChange={onBodyUrlencodedChange}
      />
    )
  }
  return (
    <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
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
    const pathVars = mergePathVars(tab!.pathVars, extractPathVarNames(base))
    updateTab(tab!.id, { url: base, params, pathVars, dirty: !!raw })
  }

  function handleParamsChange(params: KeyValueItem[]) {
    updateTab(tab!.id, { params, dirty: !!tab!.url || params.some((p) => !!p.key) })
  }

  function handleHeadersChange(headers: KeyValueItem[]) {
    updateTab(tab!.id, { headers, dirty: !!tab!.url || headers.some((h) => !!h.key) })
  }

  function handlePathVarsChange(pathVars: KeyValueItem[]) {
    updateTab(tab!.id, { pathVars })
  }

  function handleBodyTypeChange(bodyType: BodyType) {
    updateTab(tab!.id, { bodyType, dirty: !!tab!.url || bodyType !== "none" })
  }

  function handleBodyRawChange(bodyRaw: string) {
    updateTab(tab!.id, { bodyRaw, dirty: !!tab!.url || !!bodyRaw })
  }

  function handleBodyRawContentTypeChange(bodyRawContentType: RawContentType) {
    updateTab(tab!.id, { bodyRawContentType })
  }

  function handleBodyFormDataChange(bodyFormData: KeyValueItem[]) {
    updateTab(tab!.id, {
      bodyFormData,
      dirty: !!tab!.url || bodyFormData.some((f) => !!f.key),
    })
  }

  function handleBodyUrlencodedChange(bodyUrlencoded: KeyValueItem[]) {
    updateTab(tab!.id, {
      bodyUrlencoded,
      dirty: !!tab!.url || bodyUrlencoded.some((u) => !!u.key),
    })
  }

  const enabledParamsCount = tab.params.filter((p) => p.enabled && p.key).length
  const enabledHeadersCount = tab.headers.filter((h) => h.enabled && h.key).length
  const hasBody =
    tab.bodyType !== "none" &&
    (tab.bodyRaw.trim() !== "" ||
      tab.bodyFormData.some((f) => f.enabled && f.key) ||
      tab.bodyUrlencoded.some((u) => u.enabled && u.key))

  function subTabLabel(t: RequestSubTab): string {
    if (t === "Params" && enabledParamsCount > 0) return `Params (${enabledParamsCount})`
    if (t === "Headers" && enabledHeadersCount > 0) return `Headers (${enabledHeadersCount})`
    if (t === "Body" && hasBody) return "Body ●"
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
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <SubTabContent
          subTab={tab.activeSubTab}
          params={tab.params}
          headers={tab.headers}
          pathVars={tab.pathVars}
          bodyType={tab.bodyType}
          bodyRaw={tab.bodyRaw}
          bodyRawContentType={tab.bodyRawContentType}
          bodyFormData={tab.bodyFormData}
          bodyUrlencoded={tab.bodyUrlencoded}
          onParamsChange={handleParamsChange}
          onHeadersChange={handleHeadersChange}
          onPathVarsChange={handlePathVarsChange}
          onBodyTypeChange={handleBodyTypeChange}
          onBodyRawChange={handleBodyRawChange}
          onBodyRawContentTypeChange={handleBodyRawContentTypeChange}
          onBodyFormDataChange={handleBodyFormDataChange}
          onBodyUrlencodedChange={handleBodyUrlencodedChange}
        />
      </div>
    </div>
  )
}
