import { useUIStore } from "@/store/ui"

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-sidebar)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        {!sidebarCollapsed && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg)" }}>Collections</span>
        )}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            marginLeft: "auto",
            padding: "2px 4px",
            fontSize: 14,
            border: "none",
            background: "transparent",
            color: "var(--fg-muted)",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
      </div>
      {!sidebarCollapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>No collections yet.</p>
        </div>
      )}
    </aside>
  )
}
