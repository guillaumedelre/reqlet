import { useEffect, useRef, useState } from "react"

import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { HTTP_METHOD_COLORS } from "@/lib/http-methods"
import { useTabsStore, type Tab } from "@/store/tabs"

function getTabTitle(url: string): string {
  if (!url) return "New Request"
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split("/").filter(Boolean)
    return parts[parts.length - 1] ?? parsed.hostname
  } catch {
    const parts = url.split("?")[0].split("/").filter(Boolean)
    return parts[parts.length - 1] ?? url
  }
}

interface CtxMenu {
  tabId: string
  x: number
  y: number
}

function ContextMenu({ menu, onClose }: { menu: CtxMenu; onClose: () => void }) {
  const { tabs, duplicateTab, closeTab, closeOthers, closeToRight } = useTabsStore()
  const ref = useRef<HTMLDivElement>(null)
  const tabIdx = tabs.findIndex((t) => t.id === menu.tabId)
  const hasRight = tabIdx < tabs.length - 1
  const hasOthers = tabs.length > 1

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const itemStyle = (disabled = false): React.CSSProperties => ({
    display: "block",
    width: "100%",
    padding: "5px 12px",
    border: "none",
    background: "transparent",
    color: disabled ? "var(--fg-muted)" : "var(--fg)",
    fontSize: 11,
    cursor: disabled ? "default" : "pointer",
    textAlign: "left",
    opacity: disabled ? 0.5 : 1,
  })

  function action(fn: () => void) {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: menu.y,
        left: menu.x,
        zIndex: 200,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
        minWidth: 160,
        padding: "3px 0",
      }}
    >
      <button style={itemStyle()} onClick={() => action(() => duplicateTab(menu.tabId))}>
        Duplicate
      </button>
      <button
        style={itemStyle(!hasOthers)}
        onClick={() => !hasOthers || action(() => closeOthers(menu.tabId))}
      >
        Close others
      </button>
      <button
        style={itemStyle(!hasRight)}
        onClick={() => !hasRight || action(() => closeToRight(menu.tabId))}
      >
        Close to the right
      </button>
      <div style={{ borderTop: "1px solid var(--border)", margin: "3px 0" }} />
      <button style={itemStyle()} onClick={() => action(() => closeTab(menu.tabId))}>
        Close
      </button>
    </div>
  )
}

function TabItem({
  tab,
  active,
  onContextMenu,
}: {
  tab: Tab
  active: boolean
  onContextMenu: (e: React.MouseEvent, id: string) => void
}) {
  const { activateTab, closeTab } = useTabsStore()
  const methodColor = HTTP_METHOD_COLORS[tab.method]

  return (
    <div
      role="tab"
      aria-selected={active}
      onClick={() => activateTab(tab.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, tab.id)
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "0 6px 0 8px",
        height: "100%",
        cursor: "pointer",
        borderRight: "1px solid var(--border)",
        background: active ? "var(--bg)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        flexShrink: 0,
        maxWidth: 180,
        minWidth: 80,
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: methodColor,
          background: `${methodColor}1a`,
          flexShrink: 0,
          letterSpacing: "0.02em",
          padding: "1px 4px",
          borderRadius: 3,
        }}
      >
        {tab.method}
      </span>
      <span
        style={{
          fontSize: 11,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {getTabTitle(tab.url)}
      </span>
      {tab.dirty && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--fg-muted)",
            flexShrink: 0,
          }}
        />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          closeTab(tab.id)
        }}
        title="Close tab"
        style={{
          border: "none",
          background: "transparent",
          color: "var(--fg-muted)",
          cursor: "pointer",
          padding: "0 2px",
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        ×
      </button>
    </div>
  )
}

export function TabBar() {
  const { tabs, activeTabId, openTab, closeTab, reopenLastTab } = useTabsStore()
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)

  useKeyboardShortcut("t", openTab, { ctrlOrMeta: true, shift: false })
  useKeyboardShortcut(
    "w",
    () => {
      if (activeTabId) closeTab(activeTabId)
    },
    { ctrlOrMeta: true, shift: false },
  )
  useKeyboardShortcut("t", reopenLastTab, { ctrlOrMeta: true, shift: true })

  function handleContextMenu(e: React.MouseEvent, tabId: string) {
    setCtxMenu({ tabId, x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-sidebar)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flex: 1, overflowX: "auto", overflowY: "hidden" }}>
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              onContextMenu={handleContextMenu}
            />
          ))}
          <button
            onClick={openTab}
            title="New tab (Ctrl+T)"
            style={{
              flexShrink: 0,
              width: 28,
              border: "none",
              background: "transparent",
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: 16,
              alignSelf: "center",
            }}
          >
            +
          </button>
        </div>
      </div>
      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </>
  )
}
