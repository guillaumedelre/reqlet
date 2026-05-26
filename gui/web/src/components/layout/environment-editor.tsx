import { useState } from "react"

import { VariableEditor } from "@/components/ui/variable-editor"
import { useEnvironmentsStore } from "@/store/environments"

interface Props {
  onClose: () => void
}

const GLOBALS_ID = "__globals__"

export function EnvironmentEditor({ onClose }: Props) {
  const {
    environments,
    globals,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    addVariable,
    updateVariable,
    removeVariable,
    addGlobal,
    updateGlobal,
    removeGlobal,
  } = useEnvironmentsStore()

  const [selectedId, setSelectedId] = useState<string>(GLOBALS_ID)
  const [newName, setNewName] = useState("")

  const isGlobals = selectedId === GLOBALS_ID
  const selectedEnv = isGlobals ? null : environments.find((e) => e.id === selectedId)

  function handleAddEnvironment() {
    const name = newName.trim() || "New Environment"
    const id = addEnvironment(name)
    setNewName("")
    setSelectedId(id)
  }

  function handleDeleteEnv(id: string) {
    deleteEnvironment(id)
    if (selectedId === id) setSelectedId(GLOBALS_ID)
  }

  return (
    <div
      data-testid="env-editor-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 800,
          maxWidth: "90vw",
          height: 560,
          maxHeight: "85vh",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Environments</span>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div
            style={{
              width: 200,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1, overflowY: "auto" }}>
              <button
                onClick={() => setSelectedId(GLOBALS_ID)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "7px 12px",
                  border: "none",
                  background: isGlobals ? "var(--bg-sidebar)" : "transparent",
                  color: isGlobals ? "var(--fg)" : "var(--fg-muted)",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                Globals
              </button>
              {environments.map((env) => (
                <div
                  key={env.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: selectedId === env.id ? "var(--bg-sidebar)" : "transparent",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <button
                    onClick={() => setSelectedId(env.id)}
                    style={{
                      flex: 1,
                      padding: "7px 12px",
                      border: "none",
                      background: "transparent",
                      color: selectedId === env.id ? "var(--fg)" : "var(--fg-muted)",
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
                  <button
                    onClick={() => handleDeleteEnv(env.id)}
                    title="Delete environment"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--fg-muted)",
                      cursor: "pointer",
                      padding: "4px 8px",
                      fontSize: 14,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: 8,
                borderTop: "1px solid var(--border)",
                flexShrink: 0,
                display: "flex",
                gap: 4,
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddEnvironment()
                }}
                placeholder="Environment name"
                style={{
                  flex: 1,
                  padding: "3px 6px",
                  fontSize: 11,
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  background: "var(--bg)",
                  color: "var(--fg)",
                  outline: "none",
                  minWidth: 0,
                }}
              />
              <button
                onClick={handleAddEnvironment}
                title="Add environment"
                style={{
                  padding: "3px 8px",
                  fontSize: 13,
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  background: "transparent",
                  color: "var(--accent)",
                  cursor: "pointer",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {isGlobals ? (
              <>
                <div
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
                    Global Variables
                  </span>
                  <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: "2px 0 0" }}>
                    Available in all environments.
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
              </>
            ) : selectedEnv ? (
              <>
                <div
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                >
                  <input
                    value={selectedEnv.name}
                    onChange={(e) => updateEnvironment(selectedEnv.id, { name: e.target.value })}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      border: "none",
                      background: "transparent",
                      color: "var(--fg)",
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <VariableEditor
                    variables={selectedEnv.variables}
                    onAdd={() => addVariable(selectedEnv.id)}
                    onUpdate={(varId, patch) => updateVariable(selectedEnv.id, varId, patch)}
                    onRemove={(varId) => removeVariable(selectedEnv.id, varId)}
                  />
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  Select an environment or create one.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
