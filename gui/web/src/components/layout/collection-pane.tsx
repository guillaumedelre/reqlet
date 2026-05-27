import { useState } from "react"
import { Play, ChevronRight, Plus, Trash2 } from "lucide-react"
import { useDeleteConfirm } from "@/hooks/use-delete-confirm"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { CodeEditor } from "@/components/ui/code-editor"
import { cn } from "@/lib/utils"
import { useTabsStore } from "@/store/tabs"
import { useWorkspaceStore } from "@/store/workspace"
import { AuthPanel } from "./auth-panel"
import type { CollectionSubTab, FolderSubTab, EnvVariable } from "@/types"

// ---------- Sub-tab trigger style ----------

const SUB_TAB_CLS =
  "h-8 px-3 text-xs rounded-none border-0 border-b-2 border-transparent !bg-transparent !shadow-none data-active:border-primary data-active:text-foreground dark:data-active:!bg-transparent"

// ---------- Breadcrumb ----------

function Breadcrumb({
  segments,
  onCollectionClick,
  onFolderClick,
}: {
  segments: Array<{ id: string; name: string; type: "collection" | "folder" }>
  onCollectionClick: (id: string) => void
  onFolderClick: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 text-[0.6875rem] text-muted-foreground border-b border-border bg-card shrink-0">
      {segments.map((seg, i) => (
        <span key={seg.id} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          <button
            className={cn(
              "hover:text-foreground transition-colors truncate max-w-[160px]",
              i === segments.length - 1
                ? "text-foreground font-medium cursor-default"
                : "cursor-pointer",
            )}
            onClick={() => {
              if (i === segments.length - 1) return
              if (seg.type === "collection") onCollectionClick(seg.id)
              else onFolderClick(seg.id)
            }}
          >
            {seg.name}
          </button>
        </span>
      ))}
    </div>
  )
}

// ---------- Variables editor ----------

function VariableRow({ collectionId, variable }: { collectionId: string; variable: EnvVariable }) {
  const { deleteCollectionVariable, updateCollectionVariable } = useWorkspaceStore()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-muted/20">
      {deleteDialog}
      <Checkbox
        checked={variable.enabled}
        onCheckedChange={(checked) =>
          updateCollectionVariable(collectionId, variable.id, { enabled: !!checked })
        }
        className="shrink-0"
      />
      <Input
        value={variable.key}
        onChange={(e) =>
          updateCollectionVariable(collectionId, variable.id, { key: e.target.value })
        }
        placeholder="Variable"
        className="h-6 text-xs font-mono flex-1 border-0 bg-transparent focus-visible:ring-1 px-1"
      />
      <Input
        value={variable.initialValue}
        onChange={(e) =>
          updateCollectionVariable(collectionId, variable.id, { initialValue: e.target.value })
        }
        placeholder="Initial value"
        className="h-6 text-xs font-mono flex-1 border-0 bg-transparent focus-visible:ring-1 px-1"
      />
      <Input
        value={variable.currentValue}
        onChange={(e) =>
          updateCollectionVariable(collectionId, variable.id, { currentValue: e.target.value })
        }
        placeholder="Current value"
        className="h-6 text-xs font-mono flex-1 border-0 bg-transparent focus-visible:ring-1 px-1"
      />
      <button
        onClick={() =>
          requestDelete(variable.key || "", () =>
            deleteCollectionVariable(collectionId, variable.id),
          )
        }
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function VariablesTab({
  collectionId,
  variables,
}: {
  collectionId: string
  variables: EnvVariable[]
}) {
  const { addCollectionVariable } = useWorkspaceStore()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 bg-muted/30">
        <div className="w-4 shrink-0" />
        <span className="flex-1 text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
          Variable
        </span>
        <span className="flex-1 text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
          Initial Value
        </span>
        <span className="flex-1 text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
          Current Value
        </span>
        <div className="w-5 shrink-0" />
      </div>
      <ScrollArea className="flex-1">
        {variables.map((v) => (
          <VariableRow key={v.id} collectionId={collectionId} variable={v} />
        ))}
        {variables.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-muted-foreground">No variables yet.</p>
          </div>
        )}
      </ScrollArea>
      <div className="px-3 py-2 border-t border-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => addCollectionVariable(collectionId)}
        >
          <Plus className="h-3 w-3" />
          Add Variable
        </Button>
      </div>
    </div>
  )
}

// ---------- Scripts tab ----------

function ScriptsTab({
  preScript,
  testScript,
  onPreChange,
  onTestChange,
}: {
  preScript: string
  testScript: string
  onPreChange: (v: string) => void
  onTestChange: (v: string) => void
}) {
  const [active, setActive] = useState<"pre-request" | "test">("pre-request")

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border px-3 shrink-0">
        {(["pre-request", "test"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={cn(
              "px-3 py-1.5 text-xs border-b-2 transition-colors",
              active === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "pre-request" ? "Pre-request Script" : "Tests"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          value={active === "pre-request" ? preScript : testScript}
          onChange={(v) => (active === "pre-request" ? onPreChange(v) : onTestChange(v))}
          language="javascript"
        />
      </div>
    </div>
  )
}

// ---------- Runs empty state ----------

function RunsEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
      <Play className="h-8 w-8 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-foreground">No runs yet</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Use the Run button to execute this collection
        </p>
      </div>
    </div>
  )
}

// ---------- Overview ----------

function Overview({
  name,
  description,
  itemCount,
}: {
  name: string
  description: string
  itemCount: number
}) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
            Name
          </label>
          <Input value={name} className="text-sm font-medium" readOnly />
        </div>
        {description && (
          <div className="space-y-1">
            <label className="text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <p className="text-xs text-foreground leading-relaxed">{description}</p>
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          {itemCount} request{itemCount !== 1 ? "s" : ""}
        </div>
      </div>
    </ScrollArea>
  )
}

// ---------- CollectionPane ----------

export function CollectionPane() {
  const { tabs, activeTabId, setTabCollectionSubTab } = useTabsStore()
  const {
    collections,
    findFolderPath,
    updateCollectionScript,
    updateItemScript,
    updateCollectionAuth,
    updateItemAuth,
  } = useWorkspaceStore()
  const { openCollectionTab, openFolderTab } = useTabsStore()

  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab || (activeTab.type !== "collection" && activeTab.type !== "folder")) return null

  const subTab = (activeTab.collectionSubTab ?? "overview") as CollectionSubTab | FolderSubTab
  const isCollection = activeTab.type === "collection"

  const collection = collections.find((c) => c.id === activeTab.collectionId)
  if (!collection) return null

  const folderPath = !isCollection && activeTab.folderId ? findFolderPath(activeTab.folderId) : null

  const folder =
    !isCollection && activeTab.folderId
      ? (() => {
          function findFolder(
            items: import("@/types").CollectionItem[],
            id: string,
          ): import("@/types").FolderItem | null {
            for (const item of items) {
              if (!("method" in item)) {
                if (item.id === id) return item
                const found = findFolder(item.items, id)
                if (found) return found
              }
            }
            return null
          }
          return findFolder(collection.items, activeTab.folderId!)
        })()
      : null

  const displayName = isCollection ? collection.name : (folder?.name ?? "")
  const description = isCollection ? collection.description : ""
  const auth = isCollection ? collection.auth : (folder?.auth ?? { type: "inherit" as const })

  const countRequests = (items: import("@/types").CollectionItem[]): number =>
    items.reduce((acc, item) => {
      if ("method" in item) return acc + 1
      return acc + countRequests(item.items)
    }, 0)

  const itemCount = isCollection
    ? countRequests(collection.items)
    : countRequests(folder?.items ?? [])

  const breadcrumbSegments = isCollection
    ? [{ id: collection.id, name: collection.name, type: "collection" as const }]
    : (folderPath ?? [{ id: collection.id, name: collection.name, type: "collection" as const }])

  const collectionSubTabs: CollectionSubTab[] = [
    "overview",
    "authorization",
    "variables",
    "scripts",
    "runs",
  ]
  const folderSubTabs: FolderSubTab[] = ["overview", "authorization", "scripts"]
  const subTabs = isCollection ? collectionSubTabs : folderSubTabs

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header row: breadcrumb + Run button */}
      <div className="flex items-center border-b border-border shrink-0">
        <div className="flex-1 overflow-hidden">
          <Breadcrumb
            segments={breadcrumbSegments}
            onCollectionClick={(id) => {
              const col = collections.find((c) => c.id === id)
              if (col) openCollectionTab(col)
            }}
            onFolderClick={(id) => {
              // find the folder item and open its tab
              function findFolderItem(
                items: import("@/types").CollectionItem[],
                fid: string,
              ): import("@/types").FolderItem | null {
                for (const item of items) {
                  if (!("method" in item)) {
                    if (item.id === fid) return item
                    const found = findFolderItem(item.items, fid)
                    if (found) return found
                  }
                }
                return null
              }
              const fi = findFolderItem(collection.items, id)
              if (fi) openFolderTab(fi, collection.id)
            }}
          />
        </div>
        {isCollection && (
          <div className="px-3 shrink-0">
            <Button size="sm" className="h-6 text-xs gap-1 px-2">
              <Play className="h-3 w-3" />
              Run
            </Button>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <Tabs
        value={subTab}
        onValueChange={(v) =>
          setTabCollectionSubTab(activeTabId, v as CollectionSubTab | FolderSubTab)
        }
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="border-b border-border shrink-0 px-1">
          <TabsList className="h-8 bg-transparent gap-0 rounded-none p-0">
            {subTabs.map((v) => (
              <TabsTrigger key={v} value={v} className={SUB_TAB_CLS}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-hidden mt-0">
          <Overview name={displayName} description={description} itemCount={itemCount} />
        </TabsContent>

        <TabsContent value="authorization" className="flex-1 overflow-auto mt-0">
          <AuthPanel
            auth={auth}
            hideInherit={isCollection}
            onChange={(a) =>
              isCollection
                ? updateCollectionAuth(collection.id, a)
                : updateItemAuth(collection.id, activeTab.folderId!, a)
            }
          />
        </TabsContent>

        {isCollection && (
          <TabsContent value="variables" className="flex-1 overflow-hidden mt-0">
            <VariablesTab collectionId={collection.id} variables={collection.variables} />
          </TabsContent>
        )}

        <TabsContent value="scripts" className="flex-1 overflow-hidden mt-0">
          {isCollection ? (
            <ScriptsTab
              preScript={collection.preRequestScript}
              testScript={collection.testScript}
              onPreChange={(v) => updateCollectionScript(collection.id, "preRequestScript", v)}
              onTestChange={(v) => updateCollectionScript(collection.id, "testScript", v)}
            />
          ) : folder ? (
            <ScriptsTab
              preScript={folder.preRequestScript}
              testScript={folder.testScript}
              onPreChange={(v) => updateItemScript(collection.id, folder.id, "preRequestScript", v)}
              onTestChange={(v) => updateItemScript(collection.id, folder.id, "testScript", v)}
            />
          ) : null}
        </TabsContent>

        {isCollection && (
          <TabsContent value="runs" className="flex-1 overflow-hidden mt-0">
            <RunsEmpty />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
