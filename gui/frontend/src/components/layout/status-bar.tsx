import { useEffect, useRef, useState } from "react"

import { type Theme, useTheme } from "@/hooks/use-theme"

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: "system", label: "System", icon: "⊙" },
  { value: "light", label: "Light", icon: "○" },
  { value: "dark", label: "Dark", icon: "●" },
]

function ThemeSelect({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = THEMES.find((t) => t.value === theme)!

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 5px",
          fontSize: 11,
          borderRadius: 4,
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--fg-muted)",
          cursor: "pointer",
        }}
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <span style={{ fontSize: 9, lineHeight: 1 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 3px)",
            right: 0,
            zIndex: 100,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 100,
          }}
        >
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTheme(t.value)
                setOpen(false)
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "5px 10px",
                border: "none",
                background: t.value === theme ? "var(--bg-panel)" : "transparent",
                color: t.value === theme ? "var(--fg)" : "var(--fg-muted)",
                fontSize: 11,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ThemeSelect theme={theme} setTheme={setTheme} />
        <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>Reqlet v0.1.0</span>
      </div>
    </div>
  )
}
