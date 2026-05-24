import { useTheme } from "@/hooks/use-theme"

export function StatusBar() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      style={{
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-sidebar)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>No environment</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <select
          style={{
            fontSize: 11,
            border: "none",
            background: "transparent",
            color: "var(--fg-muted)",
            cursor: "pointer",
          }}
          value={theme}
          onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>Reqlet v0.1.0</span>
      </div>
    </div>
  )
}
