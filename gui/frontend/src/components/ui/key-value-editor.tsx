import type { KeyValueItem } from "@/store/tabs"

interface Props {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}

export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: Props) {
  function addRow() {
    onChange([...items, { id: crypto.randomUUID(), key: "", value: "", enabled: true }])
  }

  function updateRow(id: string, patch: Partial<KeyValueItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeRow(id: string) {
    onChange(items.filter((item) => item.id !== id))
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

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "20px 1fr 1fr 20px",
            gap: 4,
            padding: "2px 8px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span />
          <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>KEY</span>
          <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>VALUE</span>
          <span />
        </div>
      )}
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gridTemplateColumns: "20px 1fr 1fr 20px",
            alignItems: "center",
            gap: 4,
            padding: "1px 8px",
            borderBottom: "1px solid var(--border)",
            opacity: item.enabled ? 1 : 0.5,
          }}
        >
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => updateRow(item.id, { enabled: e.target.checked })}
            style={{ cursor: "pointer", justifySelf: "center" }}
          />
          <input
            value={item.key}
            onChange={(e) => updateRow(item.id, { key: e.target.value })}
            placeholder={keyPlaceholder}
            style={inputStyle(item.enabled)}
          />
          <input
            value={item.value}
            onChange={(e) => updateRow(item.id, { value: e.target.value })}
            placeholder={valuePlaceholder}
            style={inputStyle(item.enabled)}
          />
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
        </div>
      ))}
      <div style={{ padding: "6px 10px" }}>
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
    </div>
  )
}
