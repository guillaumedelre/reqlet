import { useEffect, useRef } from "react"
import { useUIStore } from "@/store/ui"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"

export function SearchModal() {
  const { searchOpen, setSearchOpen } = useUIStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useKeyboardShortcut("k", () => setSearchOpen(true), { ctrlOrMeta: true })
  useKeyboardShortcut("Escape", () => setSearchOpen(false))

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  if (!searchOpen) return null

  return (
    <div
      onClick={() => setSearchOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 120,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          placeholder="Search requests, collections, environments…"
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 13,
            border: "none",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
            outline: "none",
          }}
        />
        <div style={{ padding: "32px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            No results — collections and requests will appear here.
          </p>
        </div>
      </div>
    </div>
  )
}
