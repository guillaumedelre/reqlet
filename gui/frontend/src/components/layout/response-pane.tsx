const RESPONSE_TABS = ["Pretty", "Raw", "Preview", "Visualize"]

export function ResponsePane() {
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
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "4px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {RESPONSE_TABS.map((tab) => (
          <button
            key={tab}
            style={{
              fontSize: 11,
              border: "none",
              background: "transparent",
              color: "var(--fg-muted)",
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>
          Send a request to see the response.
        </p>
      </div>
    </div>
  )
}
