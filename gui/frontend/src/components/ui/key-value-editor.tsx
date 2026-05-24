import { useState } from "react"

import type { KeyValueItem } from "@/store/tabs"

interface Props {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  readOnlyKeys?: boolean
  allowFileType?: boolean
  allowBulkEdit?: boolean
  defaultBulkMode?: boolean
  onBulkModeChange?: (v: boolean) => void
}

function itemsToText(items: KeyValueItem[]): string {
  return items
    .filter((item) => item.enabled && item.key)
    .map((item) => (item.value ? `${item.key}: ${item.value}` : item.key))
    .join("\n")
}

function textToItems(text: string, preserved: KeyValueItem[]): KeyValueItem[] {
  const parsed = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const ci = line.indexOf(":")
      if (ci < 0) return { id: crypto.randomUUID(), key: line, value: "", enabled: true }
      return {
        id: crypto.randomUUID(),
        key: line.slice(0, ci).trim(),
        value: line.slice(ci + 1).trim(),
        enabled: true,
      }
    })
    .filter((item) => item.key)
  return [...parsed, ...preserved]
}

export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  readOnlyKeys = false,
  allowFileType = false,
  allowBulkEdit = false,
  defaultBulkMode = false,
  onBulkModeChange,
}: Props) {
  const [isBulkMode, setIsBulkMode] = useState(defaultBulkMode)
  const [bulkText, setBulkText] = useState(() => (defaultBulkMode ? itemsToText(items) : ""))

  function toggleMode() {
    if (isBulkMode) {
      const disabled = items.filter((item) => !item.enabled)
      onChange(textToItems(bulkText, disabled))
      setIsBulkMode(false)
      onBulkModeChange?.(false)
    } else {
      setBulkText(itemsToText(items))
      setIsBulkMode(true)
      onBulkModeChange?.(true)
    }
  }

  function addRow() {
    onChange([...items, { id: crypto.randomUUID(), key: "", value: "", enabled: true }])
  }

  function updateRow(id: string, patch: Partial<KeyValueItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeRow(id: string) {
    onChange(items.filter((item) => item.id !== id))
  }

  function toggleType(id: string, current: "text" | "file" | undefined) {
    updateRow(id, { type: current === "file" ? "text" : "file", value: "" })
  }

  const inputStyle = (enabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "2px 6px",
    fontSize: 11,
    border: "none",
    background: "transparent",
    color: enabled ? "var(--fg)" : "var(--fg-muted)",
    outline: "none",
    minWidth: 0,
  })

  const gridCols = readOnlyKeys
    ? "1fr 1fr"
    : allowFileType
      ? "20px 1fr 50px 1fr 20px"
      : "20px 1fr 1fr 20px"

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {allowBulkEdit && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "3px 8px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <button
            onClick={toggleMode}
            style={{
              fontSize: 11,
              border: "none",
              background: "transparent",
              color: "var(--fg-muted)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {isBulkMode ? "Key-Value Edit" : "Bulk Edit"}
          </button>
        </div>
      )}

      {!isBulkMode && items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridCols,
            gap: 4,
            padding: "2px 8px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {!readOnlyKeys && <span />}
          <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>KEY</span>
          {allowFileType && (
            <span
              style={{
                fontSize: 10,
                color: "var(--fg-muted)",
                fontWeight: 600,
                justifySelf: "center",
              }}
            >
              TYPE
            </span>
          )}
          <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>VALUE</span>
          {!readOnlyKeys && <span />}
        </div>
      )}

      {isBulkMode ? (
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          spellCheck={false}
          placeholder={"key: value\nkey2: value2"}
          style={{
            padding: "8px 10px",
            fontSize: 11,
            fontFamily: "monospace",
            border: "none",
            borderBottom: "1px solid var(--border)",
            outline: "none",
            background: "var(--bg-panel)",
            color: "var(--fg)",
            lineHeight: 1.6,
            resize: "vertical",
            minHeight: 160,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      ) : (
        items.map((item) => {
          const isFile = item.type === "file"
          return (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                alignItems: "center",
                gap: 4,
                padding: "1px 8px",
                borderBottom: "1px solid var(--border)",
                opacity: item.enabled ? 1 : 0.5,
              }}
            >
              {!readOnlyKeys && (
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => updateRow(item.id, { enabled: e.target.checked })}
                  style={{ cursor: "pointer", justifySelf: "center" }}
                />
              )}
              <input
                value={item.key}
                readOnly={readOnlyKeys}
                onChange={
                  readOnlyKeys ? undefined : (e) => updateRow(item.id, { key: e.target.value })
                }
                placeholder={keyPlaceholder}
                style={{
                  ...inputStyle(item.enabled),
                  cursor: readOnlyKeys ? "default" : undefined,
                }}
              />
              {allowFileType && (
                <button
                  onClick={() => toggleType(item.id, item.type)}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--fg-muted)",
                    cursor: "pointer",
                    padding: "2px 4px",
                    justifySelf: "center",
                    width: 38,
                  }}
                >
                  {isFile ? "File" : "Text"}
                </button>
              )}
              {isFile ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    overflow: "hidden",
                    padding: "2px 0",
                  }}
                >
                  <label
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      border: "1px solid var(--border)",
                      borderRadius: 3,
                      padding: "2px 6px",
                      cursor: "pointer",
                      color: "var(--fg-muted)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="file"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) updateRow(item.id, { value: file.name })
                      }}
                    />
                    Choose
                  </label>
                  <span
                    style={{
                      fontSize: 10,
                      color: item.value ? "var(--fg)" : "var(--fg-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.value || "No file chosen"}
                  </span>
                </div>
              ) : (
                <input
                  value={item.value}
                  onChange={(e) => updateRow(item.id, { value: e.target.value })}
                  placeholder={valuePlaceholder}
                  style={inputStyle(item.enabled)}
                />
              )}
              {!readOnlyKeys && (
                <button
                  onClick={() => removeRow(item.id)}
                  title="Remove"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--fg-muted)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 14,
                    lineHeight: 1,
                    justifySelf: "center",
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })
      )}

      {!readOnlyKeys && !isBulkMode && (
        <div style={{ padding: "5px 10px" }}>
          <button
            onClick={addRow}
            style={{
              fontSize: 11,
              border: "none",
              background: "transparent",
              color: "var(--accent)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            + Add
          </button>
        </div>
      )}
    </div>
  )
}
