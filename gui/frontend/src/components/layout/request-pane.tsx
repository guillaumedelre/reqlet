const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
const REQUEST_TABS = ["Params", "Auth", "Headers", "Body", "Scripts"]

export function RequestPane() {
  return (
    <div
      style={{
        height: 260,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* URL bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <select
          style={{
            padding: "3px 6px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
            cursor: "pointer",
          }}
        >
          {HTTP_METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
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
      {/* Sub-tabs */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "4px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {REQUEST_TABS.map((tab) => (
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
      <div style={{ flex: 1 }} />
    </div>
  )
}
