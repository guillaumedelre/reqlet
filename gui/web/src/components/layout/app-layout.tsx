import { Group, Panel, Separator } from "react-resizable-panels"
import { Sidebar } from "./sidebar"
import { TabBar } from "./tab-bar"
import { RequestPane } from "./request-pane"
import { ResponsePane } from "./response-pane"
import { EnvPane } from "./env-pane"
import { StatusBar } from "./status-bar"
import { useUIStore } from "@/store/ui"
import { useTabsStore } from "@/store/tabs"

export function AppLayout() {
  const { sidebarCollapsed } = useUIStore()
  const { tabs, activeTabId } = useTabsStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isEnvTab = activeTab?.type === "environment" || activeTab?.type === "globals"

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <Group id="main" orientation="horizontal" style={{ flex: 1 }}>
        <Panel
          id="sidebar"
          defaultSize="20%"
          minSize={sidebarCollapsed ? "3%" : "12%"}
          maxSize={sidebarCollapsed ? "3%" : "40%"}
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <Sidebar />
        </Panel>

        <Separator style={{ width: 3, background: "transparent" }} />

        <Panel id="main-content" style={{ overflow: "hidden" }}>
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <TabBar />
            {isEnvTab ? (
              <div style={{ flex: 1, overflow: "hidden" }}>
                <EnvPane />
              </div>
            ) : (
              <Group id="content" orientation="vertical" style={{ flex: 1 }}>
                <Panel id="request" defaultSize="45%" minSize="20%" style={{ overflow: "hidden" }}>
                  <RequestPane />
                </Panel>

                <Separator style={{ height: 3, background: "transparent" }} />

                <Panel id="response" minSize="20%" style={{ overflow: "hidden" }}>
                  <ResponsePane />
                </Panel>
              </Group>
            )}
          </div>
        </Panel>
      </Group>

      <StatusBar />
    </div>
  )
}
