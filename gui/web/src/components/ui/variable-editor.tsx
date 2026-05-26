import type { Variable } from "@/store/environments"

interface Props {
  variables: Variable[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Omit<Variable, "id">>) => void
  onRemove: (id: string) => void
}

export function VariableEditor({ variables, onAdd, onUpdate, onRemove }: Props) {
  const inputStyle = (enabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "3px 6px",
    fontSize: 11,
    border: "none",
    background: "transparent",
    color: enabled ? "var(--fg)" : "var(--fg-muted)",
    outline: "none",
    minWidth: 0,
    width: "100%",
    fontFamily: "monospace",
  })

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {variables.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "20px 1fr 1fr 1fr 20px",
            gap: 4,
            padding: "2px 8px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span />
          <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>VARIABLE</span>
          <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>
            INITIAL VALUE
          </span>
          <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>
            CURRENT VALUE
          </span>
          <span />
        </div>
      )}
      {variables.map((v) => (
        <div
          key={v.id}
          style={{
            display: "grid",
            gridTemplateColumns: "20px 1fr 1fr 1fr 20px",
            alignItems: "center",
            gap: 4,
            padding: "1px 8px",
            borderBottom: "1px solid var(--border)",
            opacity: v.enabled ? 1 : 0.5,
          }}
        >
          <input
            type="checkbox"
            checked={v.enabled}
            onChange={(e) => onUpdate(v.id, { enabled: e.target.checked })}
            style={{ cursor: "pointer", justifySelf: "center" }}
          />
          <input
            value={v.key}
            onChange={(e) => onUpdate(v.id, { key: e.target.value })}
            placeholder="Variable"
            style={inputStyle(v.enabled)}
          />
          <input
            value={v.initialValue}
            onChange={(e) => onUpdate(v.id, { initialValue: e.target.value })}
            placeholder="Initial value"
            style={inputStyle(v.enabled)}
          />
          <input
            value={v.currentValue}
            onChange={(e) => onUpdate(v.id, { currentValue: e.target.value })}
            placeholder="Current value"
            style={inputStyle(v.enabled)}
          />
          <button
            onClick={() => onRemove(v.id)}
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
      <div style={{ padding: "5px 10px" }}>
        <button
          onClick={onAdd}
          style={{
            fontSize: 11,
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          + Add Variable
        </button>
      </div>
    </div>
  )
}
