import { create } from "zustand"

import type { RunEvent, RunSummary } from "@/types"

export type RunStatus = "running" | "done" | "error"

export interface RunState {
  status: RunStatus
  collectionId: string
  startedAt: string
  events: RunEvent[]
  summary: RunSummary | null
  error: string | null
}

interface RunsState {
  activeRunId: string | null
  runs: Map<string, RunState>
  startRun: (runId: string, collectionId: string) => void
  appendEvent: (runId: string, event: RunEvent) => void
  finishRun: (runId: string, summary: RunSummary) => void
  failRun: (runId: string, error: string) => void
  resetRuns: () => void
}

export const useRunsStore = create<RunsState>()((set) => ({
  activeRunId: null,
  runs: new Map(),

  startRun: (runId, collectionId) =>
    set((s) => {
      const runs = new Map(s.runs)
      runs.set(runId, {
        status: "running",
        collectionId,
        startedAt: new Date().toISOString(),
        events: [],
        summary: null,
        error: null,
      })
      return { activeRunId: runId, runs }
    }),

  appendEvent: (runId, event) =>
    set((s) => {
      const entry = s.runs.get(runId)
      if (!entry) return s
      const runs = new Map(s.runs)
      runs.set(runId, { ...entry, events: [...entry.events, event] })
      return { runs }
    }),

  finishRun: (runId, summary) =>
    set((s) => {
      const entry = s.runs.get(runId)
      if (!entry) return s
      const runs = new Map(s.runs)
      runs.set(runId, { ...entry, status: "done", summary })
      return { runs }
    }),

  failRun: (runId, error) =>
    set((s) => {
      const entry = s.runs.get(runId)
      if (!entry) return s
      const runs = new Map(s.runs)
      runs.set(runId, { ...entry, status: "error", error })
      return { runs }
    }),

  resetRuns: () => set({ activeRunId: null, runs: new Map() }),
}))
