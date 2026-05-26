import { useEffect, useRef, useState } from "react"

import { EnvironmentEditor } from "@/components/layout/environment-editor"
import { type Theme, useTheme } from "@/hooks/use-theme"
import { useEnvironmentsStore } from "@/store/environments"

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

function EnvSelect({ onManage }: { onManage: () => void }) {
  const { environments, activeEnvironmentId, setActiveEnvironment } = useEnvironmentsStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

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
          color: activeEnv ? "var(--fg)" : "var(--fg-muted)",
          cursor: "pointer",
        }}
      >
        <span>{activeEnv ? activeEnv.name : "No environment"}</span>
        <span style={{ fontSize: 9, lineHeight: 1 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 3px)",
            left: 0,
            zIndex: 100,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 160,
          }}
        >
          <button
            onClick={() => {
              setActiveEnvironment(null)
              setOpen(false)
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "5px 10px",
              border: "none",
              background: !activeEnvironmentId ? "var(--bg-panel)" : "transparent",
              color: !activeEnvironmentId ? "var(--fg)" : "var(--fg-muted)",
              fontSize: 11,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            No environment
          </button>
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => {
                setActiveEnvironment(env.id)
                setOpen(false)
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 10px",
                border: "none",
                background: activeEnvironmentId === env.id ? "var(--bg-panel)" : "transparent",
                color: activeEnvironmentId === env.id ? "var(--fg)" : "var(--fg-muted)",
                fontSize: 11,
                cursor: "pointer",
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {env.name}
            </button>
          ))}
          {environments.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 2 }} />
          )}
          <button
            onClick={() => {
              setOpen(false)
              onManage()
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "5px 10px",
              border: "none",
              background: "transparent",
              color: "var(--accent)",
              fontSize: 11,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Manage environments...
          </button>
        </div>
      )}
    </div>
  )
}

export function StatusBar() {
  const { theme, setTheme } = useTheme()
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <>
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
        <EnvSelect onManage={() => setEditorOpen(true)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeSelect theme={theme} setTheme={setTheme} />
          <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>Reqlet v0.1.0</span>
        </div>
      </div>
      {editorOpen && <EnvironmentEditor onClose={() => setEditorOpen(false)} />}
    </>
  )
}
