import { useState, useEffect, useRef, useCallback } from "react"
import {
  Play,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Timer,
} from "lucide-react"
import { toast } from "sonner"
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
import { useRunsStore } from "@/store/runs"
import { useVariableScope } from "@/hooks/use-variable-scope"
import { api } from "@/lib/api"
import { MethodBadge } from "@/components/method-badge"
import { AuthPanel } from "./auth-panel"
import type { CollectionSubTab, FolderSubTab, EnvVariable, RunOptions, HttpMethod } from "@/types"

// ---------- Sub-tab trigger style ----------

const SUB_TAB_CLS =
  "h-8 px-3 text-xs rounded-none border-0 border-b-2 border-transparent !bg-transparent !shadow-none data-active:border-primary data-active:text-foreground dark:data-active:!bg-transparent"

// ---------- Helpers ----------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  const rem = ms % 1000
  return rem > 0 ? `${s}s ${rem}ms` : `${s}s`
}

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

function findFolderItem(
  items: import("@/types").CollectionItem[],
  id: string,
): import("@/types").FolderItem | null {
  for (const item of items) {
    if (!("method" in item)) {
      if (item.id === id) return item
      const found = findFolderItem(item.items, id)
      if (found) return found
    }
  }
  return null
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-emerald-500"
  if (status >= 300 && status < 400) return "text-yellow-500"
  return "text-red-500"
}

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
            {t === "pre-request" ? "Pre-request" : "Post-response"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          value={active === "pre-request" ? preScript : testScript}
          onChange={(v) => (active === "pre-request" ? onPreChange(v) : onTestChange(v))}
          language="javascript"
          pmCompletions
        />
      </div>
    </div>
  )
}

// ---------- Runs tab ----------

interface IterResult {
  passed: boolean
  status?: number
  durationMs?: number
  error?: string
  tests: import("@/types").RunTestResult[]
}

interface RequestRowData {
  key: string
  name: string
  method: string
  iterResults: Map<number, IterResult>
}

function buildRows(events: import("@/types").RunEvent[]): RequestRowData[] {
  const rowMap = new Map<string, RequestRowData>()
  for (const evt of events) {
    const key = `${evt.method ?? "GET"}::${evt.name ?? evt.url ?? ""}`
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        key,
        name: evt.name ?? evt.url ?? "",
        method: evt.method ?? "GET",
        iterResults: new Map(),
      })
    }
    rowMap.get(key)!.iterResults.set(evt.iteration ?? 0, {
      passed: evt.passed,
      status: evt.status,
      durationMs: evt.durationMs,
      error: evt.error,
      tests: evt.tests ?? [],
    })
  }
  return [...rowMap.values()]
}

function RunResultsTable({
  requestEvents,
  totalIterations,
}: {
  requestEvents: import("@/types").RunEvent[]
  totalIterations: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const rows = buildRows(requestEvents)
  const seenMax = rows.reduce((m, r) => {
    const keys = [...r.iterResults.keys()]
    return keys.length > 0 ? Math.max(m, ...keys) : m
  }, 0)
  const N = Math.max(totalIterations, seenMax, 1)

  const toggle = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  return (
    <div>
      {/* Iteration column header — only when multi-iteration */}
      {N > 1 && (
        <div className="flex items-center px-2 py-1 border-b border-border/40 bg-muted/10 sticky top-0">
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 pl-2">
            {Array.from({ length: N }, (_, i) => (
              <div
                key={i}
                className="w-3.5 shrink-0 text-center text-[0.625rem] text-muted-foreground"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.map((row) => {
        const isExpanded = expanded.has(row.key)
        const sortedIters = [...row.iterResults.entries()].sort(([a], [b]) => b - a)
        const lastResult = sortedIters[0]?.[1]
        const failedTests = lastResult?.tests.filter((t) => !t.passed) ?? []
        const allTests = [...row.iterResults.values()].flatMap((r) => r.tests)
        const passedCount = allTests.filter((t) => t.passed).length
        const totalCount = allTests.length

        return (
          <div key={row.key} className="border-b border-border/40 last:border-0">
            <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/20 text-xs">
              <button
                onClick={() => toggle(row.key)}
                className="w-4 h-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight
                  className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
                />
              </button>
              <MethodBadge
                method={row.method as HttpMethod}
                className="w-12 text-center shrink-0"
              />
              <span className="flex-1 truncate text-foreground min-w-0">{row.name}</span>
              {lastResult?.status != null && (
                <span className={cn("font-mono shrink-0", statusColor(lastResult.status))}>
                  {lastResult.status}
                </span>
              )}
              {totalCount > 0 && (
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    passedCount < totalCount ? "text-red-500" : "text-muted-foreground",
                  )}
                >
                  {passedCount}/{totalCount}
                </span>
              )}
              {lastResult?.durationMs != null && (
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatDuration(lastResult.durationMs)}
                </span>
              )}
              {/* Iteration cells */}
              <div className="flex items-center gap-0.5 shrink-0 pl-2">
                {Array.from({ length: N }, (_, i) => {
                  const res = row.iterResults.get(i)
                  return (
                    <div
                      key={i}
                      title={`Iteration ${i + 1}`}
                      className={cn(
                        "w-3.5 h-3.5 rounded-sm shrink-0",
                        res == null ? "bg-muted/50" : res.passed ? "bg-emerald-500" : "bg-red-500",
                      )}
                    />
                  )
                })}
              </div>
            </div>

            {/* Network errors — always visible, one line per failed iteration */}
            {!isExpanded && [...row.iterResults.values()].some((r) => r.error) && (
              <div className="px-3 pb-1.5 space-y-0.5">
                {[...row.iterResults.entries()]
                  .filter(([, r]) => r.error)
                  .map(([iter, r]) => (
                    <p
                      key={iter}
                      className="text-[0.625rem] text-red-400 pl-14 leading-snug font-mono"
                    >
                      {N > 1 && <span className="text-muted-foreground mr-1">#{iter + 1}</span>}
                      {r.error}
                    </p>
                  ))}
              </div>
            )}

            {/* Failed tests inline — visible without expanding */}
            {failedTests.length > 0 && !isExpanded && (
              <div className="px-3 pb-1.5 space-y-0.5">
                {failedTests.map((t, i) => (
                  <p key={i} className="text-[0.625rem] text-red-500 pl-14 leading-snug">
                    ✗ {t.name}
                    {t.error && <span className="text-muted-foreground"> — {t.error}</span>}
                  </p>
                ))}
              </div>
            )}

            {/* Expanded: all tests per iteration */}
            {isExpanded && (
              <div className="pl-6 pb-1.5">
                {[...row.iterResults.entries()]
                  .sort(([a], [b]) => a - b)
                  .map(([iter, result]) => (
                    <div key={iter} className="py-0.5">
                      {N > 1 && (
                        <p className="text-[0.625rem] font-medium text-muted-foreground px-2 py-0.5">
                          Iteration {iter + 1}
                          {result.status != null && ` · ${result.status}`}
                          {result.durationMs != null && ` · ${formatDuration(result.durationMs)}`}
                        </p>
                      )}
                      {result.error ? (
                        <p className="text-[0.625rem] text-red-400 px-2 font-mono break-all">
                          {result.error}
                        </p>
                      ) : result.tests.length > 0 ? (
                        result.tests.map((t, ti) => (
                          <div
                            key={ti}
                            className="flex items-start gap-1.5 px-2 py-0.5 text-[0.625rem]"
                          >
                            {t.passed ? (
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0 mt-px" />
                            ) : (
                              <XCircle className="h-2.5 w-2.5 text-red-500 shrink-0 mt-px" />
                            )}
                            <span className={t.passed ? "text-muted-foreground" : "text-red-400"}>
                              {t.name}
                            </span>
                            {t.error && (
                              <span className="text-muted-foreground ml-1">— {t.error}</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[0.625rem] text-muted-foreground px-2">
                          HTTP {result.status ?? "—"}
                          {result.durationMs != null && ` · ${formatDuration(result.durationMs)}`}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RunsTab({
  collectionId,
  folderId,
  runOpts,
  onOptsChange,
  selectedRunId,
  onSelectedRunIdChange,
  onRun,
  isStarting,
}: {
  collectionId: string
  folderId?: string
  runOpts: RunOptions
  onOptsChange: (patch: Partial<RunOptions>) => void
  selectedRunId: string | null
  onSelectedRunIdChange: (id: string | null) => void
  onRun: () => void
  isStarting: boolean
}) {
  const { runs, activeRunId } = useRunsStore()

  const collectionRuns = [...runs.entries()]
    .filter(([, r]) => r.collectionId === collectionId && r.folderId === folderId)
    .sort((a, b) => new Date(b[1].startedAt).getTime() - new Date(a[1].startedAt).getTime())

  const activeRunEntry = activeRunId ? runs.get(activeRunId) : null
  const activeRun =
    activeRunEntry?.collectionId === collectionId && activeRunEntry?.folderId === folderId
      ? activeRunEntry
      : null

  // Auto-select the active run when a new one starts for this collection/folder
  useEffect(() => {
    const entry = activeRunId ? runs.get(activeRunId) : null
    if (entry?.collectionId === collectionId && entry?.folderId === folderId) {
      onSelectedRunIdChange(activeRunId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, collectionId, folderId, runs])

  const displayRunId = selectedRunId ?? collectionRuns[0]?.[0] ?? null
  const displayRun = displayRunId ? runs.get(displayRunId) : null

  const isRunning = activeRun?.status === "running"

  const requestEvents = (displayRun?.events ?? []).filter((e) => e.type === "request")
  const startEvent = (displayRun?.events ?? []).find((e) => e.type === "start")
  const totalFromStart = startEvent?.total ?? 0
  const iterations = startEvent?.iterations ?? runOpts.iterations ?? 1

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Config bar */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border shrink-0 bg-muted/20">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          Iterations
          <Input
            type="number"
            min={1}
            max={999}
            value={runOpts.iterations ?? 1}
            onChange={(e) =>
              onOptsChange({ iterations: Math.max(1, parseInt(e.target.value) || 1) })
            }
            className="h-6 w-14 text-xs px-1.5 text-center"
            disabled={isRunning}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          Delay (ms)
          <Input
            type="number"
            min={0}
            value={runOpts.delayMs ?? 0}
            onChange={(e) => onOptsChange({ delayMs: Math.max(0, parseInt(e.target.value) || 0) })}
            className="h-6 w-16 text-xs px-1.5 text-center"
            disabled={isRunning}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
          <Checkbox
            checked={runOpts.bail ?? false}
            onCheckedChange={(v) => onOptsChange({ bail: !!v })}
            disabled={isRunning}
          />
          Stop on failure
        </label>
        <div className="flex-1" />
        <Button
          size="sm"
          className="h-6 text-xs gap-1 px-2 shrink-0"
          onClick={onRun}
          disabled={isStarting || isRunning}
        >
          {isStarting || isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isRunning ? "Running…" : "Run"}
        </Button>
      </div>

      {/* Run results */}
      {displayRun ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Summary area */}
          {displayRun.status === "running" ? (
            <div className="flex items-center gap-3 px-3 py-2 border-b border-border shrink-0 text-xs bg-muted/10">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                {requestEvents.length}
                {totalFromStart > 0 ? ` / ${totalFromStart * iterations}` : ""} requests
              </span>
            </div>
          ) : displayRun.status === "done" && displayRun.summary ? (
            <div className="grid grid-cols-4 gap-1.5 px-3 py-2 border-b border-border shrink-0">
              <div
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-2 py-2",
                  displayRun.summary.failed === 0 ? "bg-emerald-500/10" : "bg-muted/20",
                )}
              >
                <span className="text-[0.6rem] font-medium text-muted-foreground uppercase tracking-wider">
                  Passed
                </span>
                <div className="flex items-center gap-1">
                  <CheckCircle2
                    className={cn(
                      "h-3 w-3 shrink-0",
                      displayRun.summary.failed === 0
                        ? "text-emerald-500"
                        : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-base font-bold tabular-nums leading-none",
                      displayRun.summary.failed === 0 ? "text-emerald-500" : "text-foreground",
                    )}
                  >
                    {displayRun.summary.passed}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-2 py-2",
                  displayRun.summary.failed > 0 ? "bg-red-500/10" : "bg-muted/20",
                )}
              >
                <span className="text-[0.6rem] font-medium text-muted-foreground uppercase tracking-wider">
                  Failed
                </span>
                <div className="flex items-center gap-1">
                  <XCircle
                    className={cn(
                      "h-3 w-3 shrink-0",
                      displayRun.summary.failed > 0 ? "text-red-500" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-base font-bold tabular-nums leading-none",
                      displayRun.summary.failed > 0 ? "text-red-500" : "text-foreground",
                    )}
                  >
                    {displayRun.summary.failed}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-md bg-muted/20 px-2 py-2">
                <span className="text-[0.6rem] font-medium text-muted-foreground uppercase tracking-wider">
                  Total
                </span>
                <span className="text-base font-bold tabular-nums leading-none text-foreground">
                  {displayRun.summary.total}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-md bg-muted/20 px-2 py-2">
                <span className="text-[0.6rem] font-medium text-muted-foreground uppercase tracking-wider">
                  Duration
                </span>
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold tabular-nums leading-none text-foreground">
                    {formatDuration(displayRun.summary.durationMs)}
                  </span>
                </div>
              </div>
            </div>
          ) : displayRun.status === "error" ? (
            <div className="flex items-center gap-3 px-3 py-2 border-b border-border shrink-0 text-xs bg-red-500/5">
              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-red-500 truncate">{displayRun.error ?? "Run failed"}</span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs gap-1 px-2"
                onClick={onRun}
                disabled={isStarting}
              >
                <Play className="h-3 w-3" />
                Retry
              </Button>
            </div>
          ) : null}

          {/* Event list + past runs */}
          <div className="flex flex-1 overflow-hidden">
            <ScrollArea className="flex-1">
              {requestEvents.length > 0 ? (
                <RunResultsTable requestEvents={requestEvents} totalIterations={iterations} />
              ) : displayRun.status === "running" ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-xs text-muted-foreground">Waiting for first request…</p>
                </div>
              ) : null}
            </ScrollArea>

            {/* Past runs sidebar */}
            {collectionRuns.length > 1 && (
              <div className="w-36 border-l border-border flex flex-col shrink-0 overflow-hidden">
                <p className="px-2 py-1.5 text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider border-b border-border shrink-0">
                  Past Runs
                </p>
                <ScrollArea className="flex-1">
                  {collectionRuns.map(([runId, run]) => (
                    <button
                      key={runId}
                      onClick={() => onSelectedRunIdChange(runId)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors",
                        selectedRunId === runId && "bg-accent",
                      )}
                    >
                      <div className="flex items-center gap-1 text-[0.625rem]">
                        {run.status === "running" ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
                        ) : run.status === "done" && run.summary ? (
                          run.summary.failed === 0 ? (
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                          )
                        ) : (
                          <XCircle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                        )}
                        <span className="text-muted-foreground truncate">
                          {formatRelTime(run.startedAt)}
                        </span>
                      </div>
                      {run.summary && (
                        <p className="text-[0.625rem] text-muted-foreground mt-0.5">
                          {run.summary.passed}/{run.summary.total} ·{" "}
                          {formatDuration(run.summary.durationMs)}
                        </p>
                      )}
                    </button>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
          <Play className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">No runs yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure options above and click Run
            </p>
          </div>
        </div>
      )}
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
  const { tabs, activeTabId, setTabCollectionSubTab, updateTab } = useTabsStore()
  const {
    collections,
    findFolderPath,
    updateCollectionScript,
    updateItemScript,
    updateCollectionAuth,
    updateItemAuth,
  } = useWorkspaceStore()
  const { openCollectionTab, openFolderTab } = useTabsStore()
  const { startRun, appendEvent, finishRun, failRun } = useRunsStore()

  const [isStarting, setIsStarting] = useState(false)
  const sseCleanupRef = useRef<(() => void) | null>(null)

  // Derived before hooks so useCallback deps are unconditional
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const collection = collections.find((c) => c.id === activeTab?.collectionId)
  const isCollection = activeTab?.type === "collection"
  const folder =
    !isCollection && activeTab?.folderId && collection
      ? findFolderItem(collection.items, activeTab.folderId)
      : null
  const runOpts = activeTab?.runOptions ?? { iterations: 1, delayMs: 0, bail: false }

  const { globals, environment, collectionVariables } = useVariableScope(collection?.id)

  useEffect(
    () => () => {
      sseCleanupRef.current?.()
    },
    [],
  )

  const handleRun = useCallback(async () => {
    if (!collection || isStarting) return
    setIsStarting(true)
    setTabCollectionSubTab(activeTabId, "runs")
    try {
      const { runId } = await api.collections.run(collection.id, {
        ...runOpts,
        ...(folder ? { folder: folder.name } : {}),
        variables: { globals, environment, collectionVariables },
      })
      startRun(runId, collection.id, folder?.id ?? undefined)
      sseCleanupRef.current?.()
      sseCleanupRef.current = api.runs.stream(runId, {
        onEvent: (evt) => appendEvent(runId, evt),
        onDone: (summary) => finishRun(runId, summary),
        onError: (err) => failRun(runId, err.message),
      })
    } catch (err) {
      toast.error((err as Error).message || "Failed to start run")
    } finally {
      setIsStarting(false)
    }
  }, [
    collection,
    folder,
    isStarting,
    activeTabId,
    runOpts,
    setTabCollectionSubTab,
    startRun,
    appendEvent,
    finishRun,
    failRun,
  ])

  if (!activeTab || (activeTab.type !== "collection" && activeTab.type !== "folder")) return null

  const subTab = (activeTab.collectionSubTab ?? "overview") as CollectionSubTab | FolderSubTab

  if (!collection) return null

  const folderPath = !isCollection && activeTab.folderId ? findFolderPath(activeTab.folderId) : null

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
  const folderSubTabs: FolderSubTab[] = ["overview", "authorization", "scripts", "runs"]
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
              const fi = findFolderItem(collection.items, id)
              if (fi) openFolderTab(fi, collection.id)
            }}
          />
        </div>
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

        <TabsContent value="runs" className="flex-1 overflow-hidden mt-0">
          <RunsTab
            collectionId={collection.id}
            folderId={folder?.id}
            runOpts={runOpts}
            onOptsChange={(patch) =>
              updateTab(activeTabId, { runOptions: { ...runOpts, ...patch } })
            }
            selectedRunId={activeTab.runSelectedRunId ?? null}
            onSelectedRunIdChange={(id) => updateTab(activeTabId, { runSelectedRunId: id })}
            onRun={handleRun}
            isStarting={isStarting}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
