export function TabBar() {
  return (
    <div
      style={{
        height: 36,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 8px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-sidebar)",
        flexShrink: 0,
      }}
    >
      <button
        style={{
          padding: "2px 12px",
          fontSize: 11,
          borderRadius: 4,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--fg)",
          cursor: "pointer",
        }}
      >
        New Request
      </button>
      <button
        style={{
          padding: "2px 8px",
          fontSize: 14,
          borderRadius: 4,
          border: "none",
          background: "transparent",
          color: "var(--fg-muted)",
          cursor: "pointer",
        }}
      >
        +
      </button>
    </div>
  )
}
