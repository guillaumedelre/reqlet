import { beforeEach, describe, expect, it } from "vitest"

import type { RunEvent, RunSummary } from "@/types"
import { useRunsStore } from "./runs"

const summary: RunSummary = {
  runId: "r1",
  collectionId: "col-1",
  startedAt: "2026-01-01T00:00:00Z",
  durationMs: 500,
  total: 3,
  passed: 2,
  failed: 1,
}

const startEvent: RunEvent = { type: "start", total: 3, iterations: 1, passed: false }
const reqEvent: RunEvent = { type: "request", name: "req1", passed: true }
const doneEvent: RunEvent = { type: "done", passed: true, summary }

beforeEach(() => {
  useRunsStore.getState().resetRuns()
})

describe("initial state", () => {
  it("has no active run and empty runs map", () => {
    const { activeRunId, runs } = useRunsStore.getState()
    expect(activeRunId).toBeNull()
    expect(runs.size).toBe(0)
  })
})

describe("startRun", () => {
  it("creates a running entry and sets activeRunId", () => {
    useRunsStore.getState().startRun("r1", "col-1")
    const { activeRunId, runs } = useRunsStore.getState()
    expect(activeRunId).toBe("r1")
    const entry = runs.get("r1")
    expect(entry?.status).toBe("running")
    expect(entry?.collectionId).toBe("col-1")
    expect(entry?.events).toEqual([])
    expect(entry?.summary).toBeNull()
    expect(entry?.error).toBeNull()
  })

  it("stores startedAt as a valid ISO string", () => {
    const before = Date.now()
    useRunsStore.getState().startRun("r1", "col-1")
    const after = Date.now()
    const entry = useRunsStore.getState().runs.get("r1")!
    const ts = new Date(entry.startedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it("tracks multiple independent runs", () => {
    useRunsStore.getState().startRun("r1", "col-1")
    useRunsStore.getState().startRun("r2", "col-2")
    expect(useRunsStore.getState().runs.size).toBe(2)
    expect(useRunsStore.getState().activeRunId).toBe("r2")
  })

  it("associates each run with its collection", () => {
    useRunsStore.getState().startRun("r1", "col-A")
    useRunsStore.getState().startRun("r2", "col-B")
    expect(useRunsStore.getState().runs.get("r1")?.collectionId).toBe("col-A")
    expect(useRunsStore.getState().runs.get("r2")?.collectionId).toBe("col-B")
  })
})

describe("appendEvent", () => {
  it("appends events in order", () => {
    useRunsStore.getState().startRun("r1", "col-1")
    useRunsStore.getState().appendEvent("r1", startEvent)
    useRunsStore.getState().appendEvent("r1", reqEvent)
    const events = useRunsStore.getState().runs.get("r1")!.events
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe("start")
    expect(events[1].type).toBe("request")
  })

  it("is a no-op for unknown runId", () => {
    useRunsStore.getState().appendEvent("unknown", reqEvent)
    expect(useRunsStore.getState().runs.size).toBe(0)
  })

  it("does not mutate existing event arrays", () => {
    useRunsStore.getState().startRun("r1", "col-1")
    useRunsStore.getState().appendEvent("r1", startEvent)
    const before = useRunsStore.getState().runs.get("r1")!.events
    useRunsStore.getState().appendEvent("r1", reqEvent)
    const after = useRunsStore.getState().runs.get("r1")!.events
    expect(before).not.toBe(after)
    expect(before).toHaveLength(1)
    expect(after).toHaveLength(2)
  })
})

describe("finishRun", () => {
  it("sets status to done and stores summary", () => {
    useRunsStore.getState().startRun("r1", "col-1")
    useRunsStore.getState().appendEvent("r1", doneEvent)
    useRunsStore.getState().finishRun("r1", summary)
    const entry = useRunsStore.getState().runs.get("r1")!
    expect(entry.status).toBe("done")
    expect(entry.summary).toEqual(summary)
    expect(entry.events).toHaveLength(1)
  })

  it("is a no-op for unknown runId", () => {
    useRunsStore.getState().finishRun("unknown", summary)
    expect(useRunsStore.getState().runs.size).toBe(0)
  })
})

describe("failRun", () => {
  it("sets status to error and stores message", () => {
    useRunsStore.getState().startRun("r1", "col-1")
    useRunsStore.getState().failRun("r1", "SSE connection error")
    const entry = useRunsStore.getState().runs.get("r1")!
    expect(entry.status).toBe("error")
    expect(entry.error).toBe("SSE connection error")
  })

  it("is a no-op for unknown runId", () => {
    useRunsStore.getState().failRun("unknown", "err")
    expect(useRunsStore.getState().runs.size).toBe(0)
  })
})

describe("resetRuns", () => {
  it("clears all run state and active run", () => {
    useRunsStore.getState().startRun("r1", "col-1")
    useRunsStore.getState().startRun("r2", "col-2")
    useRunsStore.getState().resetRuns()
    const { activeRunId, runs } = useRunsStore.getState()
    expect(activeRunId).toBeNull()
    expect(runs.size).toBe(0)
  })
})

describe("full lifecycle", () => {
  it("start → events → done", () => {
    const { startRun, appendEvent, finishRun } = useRunsStore.getState()
    startRun("r1", "col-1")
    appendEvent("r1", startEvent)
    appendEvent("r1", reqEvent)
    appendEvent("r1", doneEvent)
    finishRun("r1", summary)

    const entry = useRunsStore.getState().runs.get("r1")!
    expect(entry.status).toBe("done")
    expect(entry.events).toHaveLength(3)
    expect(entry.summary?.passed).toBe(2)
    expect(entry.summary?.failed).toBe(1)
  })

  it("start → error path", () => {
    const { startRun, appendEvent, failRun } = useRunsStore.getState()
    startRun("r1", "col-1")
    appendEvent("r1", startEvent)
    failRun("r1", "network error")

    const entry = useRunsStore.getState().runs.get("r1")!
    expect(entry.status).toBe("error")
    expect(entry.error).toBe("network error")
    expect(entry.events).toHaveLength(1)
  })
})
