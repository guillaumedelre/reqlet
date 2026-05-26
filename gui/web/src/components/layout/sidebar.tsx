import { useEnvironmentsStore } from "@/store/environments"
import { useTabsStore } from "@/store/tabs"
import { type SidebarSection, useUIStore } from "@/store/ui"

// --- Icons ---

function IconCollections({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ opacity: active ? 1 : 0.5 }}
    >
      <rect x="1" y="3" width="14" height="2" rx="1" />
      <rect x="1" y="7" width="10" height="2" rx="1" />
      <rect x="1" y="11" width="12" height="2" rx="1" />
    </svg>
  )
}

function IconEnvironments({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ opacity: active ? 1 : 0.5 }}
    >
      <circle cx="8" cy="8" r="5.5" />
      <ellipse cx="8" cy="8" rx="2.5" ry="5.5" />
      <line x1="2.5" y1="8" x2="13.5" y2="8" />
    </svg>
  )
}

function IconHistory({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.5 }}
    >
      <circle cx="8" cy="8" r="5.5" />
      <polyline points="8,4.5 8,8 10.5,9.5" />
    </svg>
  )
}

// --- Section panels ---

function CollectionsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg)" }}>Collections</span>
        <button
          title="New collection"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: "1px 4px",
          }}
        >
          +
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: 0 }}>No collections yet.</p>
      </div>
    </div>
  )
}

function EnvironmentsPanel() {
  const { environments, globals, activeEnvironmentId, setActiveEnvironment, addEnvironment } =
    useEnvironmentsStore()
  const { openEnvTab, openGlobalsTab } = useTabsStore()

  function handleNewEnv() {
    const id = addEnvironment("New Environment")
    openEnvTab(id)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg)" }}>Environments</span>
        <button
          onClick={handleNewEnv}
          title="New environment"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: "1px 4px",
          }}
        >
          +
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Globals row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 10px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            Globals
            {globals.filter((v) => v.enabled && v.key).length > 0 && (
              <span style={{ marginLeft: 4, fontSize: 10, color: "var(--fg-muted)" }}>
                ({globals.filter((v) => v.enabled && v.key).length})
              </span>
            )}
          </span>
          <button
            onClick={openGlobalsTab}
            title="Edit globals"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: 11,
              padding: "1px 4px",
            }}
          >
            ✎
          </button>
        </div>

        {environments.length === 0 ? (
          <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: "8px 10px" }}>
            No environments yet.
          </p>
        ) : (
          environments.map((env) => {
            const isActive = env.id === activeEnvironmentId
            return (
              <div
                key={env.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "5px 10px",
                  borderBottom: "1px solid var(--border)",
                  background: isActive ? "var(--bg-panel)" : "transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: isActive ? "var(--fg)" : "var(--fg-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {env.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={() => setActiveEnvironment(isActive ? null : env.id)}
                    title={isActive ? "Deactivate" : "Set active"}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: isActive ? "var(--accent)" : "var(--fg-muted)",
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "1px 4px",
                      lineHeight: 1,
                    }}
                  >
                    {isActive ? "●" : "○"}
                  </button>
                  <button
                    onClick={() => openEnvTab(env.id)}
                    title="Edit environment"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--fg-muted)",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "1px 4px",
                    }}
                  >
                    ✎
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function HistoryPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg)" }}>History</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: 0 }}>No history yet.</p>
      </div>
    </div>
  )
}

// --- Icon rail button ---

function RailButton({
  section,
  activeSection,
  title,
  children,
  onClick,
}: {
  section: SidebarSection
  activeSection: SidebarSection
  title: string
  children: React.ReactNode
  onClick: () => void
}) {
  const isActive = section === activeSection
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "100%",
        padding: "10px 0",
        border: "none",
        background: "transparent",
        color: isActive ? "var(--fg)" : "var(--fg-muted)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
      }}
    >
      {children}
    </button>
  )
}

// --- Main Sidebar ---

export function Sidebar() {
  const { sidebarCollapsed, sidebarSection, toggleSidebar, setSidebarSection } = useUIStore()

  function handleSectionClick(section: SidebarSection) {
    if (sidebarSection === section && !sidebarCollapsed) {
      toggleSidebar()
    } else {
      setSidebarSection(section)
      if (sidebarCollapsed) toggleSidebar()
    }
  }

  return (
    <aside style={{ height: "100%", display: "flex", background: "var(--bg-sidebar)" }}>
      {/* Icon rail */}
      <div
        style={{
          width: 40,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: sidebarCollapsed ? "none" : "1px solid var(--border)",
          paddingTop: 4,
        }}
      >
        <RailButton
          section="collections"
          activeSection={sidebarSection}
          title="Collections"
          onClick={() => handleSectionClick("collections")}
        >
          <IconCollections active={sidebarSection === "collections"} />
        </RailButton>
        <RailButton
          section="environments"
          activeSection={sidebarSection}
          title="Environments"
          onClick={() => handleSectionClick("environments")}
        >
          <IconEnvironments active={sidebarSection === "environments"} />
        </RailButton>
        <RailButton
          section="history"
          activeSection={sidebarSection}
          title="History"
          onClick={() => handleSectionClick("history")}
        >
          <IconHistory active={sidebarSection === "history"} />
        </RailButton>
      </div>

      {/* Section content */}
      {!sidebarCollapsed && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          {sidebarSection === "collections" && <CollectionsPanel />}
          {sidebarSection === "environments" && <EnvironmentsPanel />}
          {sidebarSection === "history" && <HistoryPanel />}
        </div>
      )}
    </aside>
  )
}
