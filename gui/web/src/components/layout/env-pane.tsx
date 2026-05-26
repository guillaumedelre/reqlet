import { VariableEditor } from "@/components/ui/variable-editor"
import { useEnvironmentsStore } from "@/store/environments"
import { useTabsStore } from "@/store/tabs"

export function EnvPane() {
  const { tabs, activeTabId } = useTabsStore()
  const {
    environments,
    globals,
    addVariable,
    updateVariable,
    removeVariable,
    updateEnvironment,
    addGlobal,
    updateGlobal,
    removeGlobal,
  } = useEnvironmentsStore()

  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab) return null

  if (tab.type === "globals") {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-panel)",
        }}
      >
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
            Global Variables
          </span>
          <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: "2px 0 0" }}>
            Available across all environments and collections.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <VariableEditor
            variables={globals}
            onAdd={addGlobal}
            onUpdate={updateGlobal}
            onRemove={removeGlobal}
          />
        </div>
      </div>
    )
  }

  if (tab.type === "environment" && tab.envId) {
    const env = environments.find((e) => e.id === tab.envId)
    if (!env) {
      return (
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-panel)",
          }}
        >
          <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>Environment not found.</p>
        </div>
      )
    }

    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-panel)",
        }}
      >
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <input
            value={env.name}
            onChange={(e) => updateEnvironment(env.id, { name: e.target.value })}
            style={{
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              background: "transparent",
              color: "var(--fg)",
              outline: "none",
              flex: 1,
              minWidth: 0,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--fg-muted)", flexShrink: 0 }}>
            Environment
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <VariableEditor
            variables={env.variables}
            onAdd={() => addVariable(env.id)}
            onUpdate={(varId, patch) => updateVariable(env.id, varId, patch)}
            onRemove={(varId) => removeVariable(env.id, varId)}
          />
        </div>
      </div>
    )
  }

  return null
}
