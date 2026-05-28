import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SidePanel } from "./side-panel"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useUiStore } from "@/store/ui"
import { useWorkspaceStore } from "@/store/workspace"
import { useTabsStore } from "@/store/tabs"
import { toast } from "sonner"
import { api } from "@/lib/api"
import * as backend from "@/lib/backend"
import type { Collection, Environment } from "@/types"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock("@/lib/api", () => ({
  api: {
    collections: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      import: vi.fn(),
      export: vi.fn(),
    },
    environments: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      import: vi.fn(),
      export: vi.fn(),
    },
  },
}))

vi.mock("@/lib/backend", () => ({
  listHistory: vi.fn(),
  deleteHistoryEntry: vi.fn(),
  clearHistory: vi.fn(),
}))

const ENV_A: Environment = { id: "env-a", name: "Production", variables: [] }
const ENV_B: Environment = { id: "env-b", name: "Staging", variables: [] }

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidePanel />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useWorkspaceStore.setState((s) => ({ ...s, environments: [], collections: [] }))
  useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
  useUiStore.setState((s) => ({
    ...s,
    activePanel: "environments",
    activeEnvironmentId: null,
  }))
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

// ---------------------------------------------------------------------------
// HistoryPanel helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<backend.HistoryEntry> = {}): backend.HistoryEntry {
  return {
    id: "entry-1",
    method: "GET",
    url: "https://api.example.com/users",
    status: 200,
    durationMs: 25,
    timestamp: new Date("2024-01-15T14:30:00.000Z").toISOString(),
    ...overrides,
  }
}

function makeEntries(count: number, offsetId = 0): backend.HistoryEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry({ id: `entry-${offsetId + i}`, url: `https://api.example.com/item/${offsetId + i}` }),
  )
}

// ---------------------------------------------------------------------------
// EnvironmentsPanel — delete active environment
// ---------------------------------------------------------------------------

describe("EnvironmentsPanel — delete active environment", () => {
  it("resets activeEnvironmentId to null when the active environment is deleted", async () => {
    const user = userEvent.setup()
    useWorkspaceStore.setState((s) => ({ ...s, environments: [ENV_A, ENV_B] }))
    useUiStore.setState((s) => ({
      ...s,
      activePanel: "environments",
      activeEnvironmentId: "env-a",
    }))

    renderPanel()

    const row = screen.getByText("Production").closest("div")!
    await user.click(within(row).getByRole("button"))

    await user.click(await screen.findByRole("menuitem", { name: /delete/i }))
    await user.click(await screen.findByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(useUiStore.getState().activeEnvironmentId).toBeNull()
    })
    expect(useWorkspaceStore.getState().environments.find((e) => e.id === "env-a")).toBeUndefined()
  })

  it("does not change activeEnvironmentId when a non-active environment is deleted", async () => {
    const user = userEvent.setup()
    useWorkspaceStore.setState((s) => ({ ...s, environments: [ENV_A, ENV_B] }))
    useUiStore.setState((s) => ({
      ...s,
      activePanel: "environments",
      activeEnvironmentId: "env-a",
    }))

    renderPanel()

    const row = screen.getByText("Staging").closest("div")!
    await user.click(within(row).getByRole("button"))

    await user.click(await screen.findByRole("menuitem", { name: /delete/i }))
    await user.click(await screen.findByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().environments.find((e) => e.id === "env-b"),
      ).toBeUndefined()
    })
    expect(useUiStore.getState().activeEnvironmentId).toBe("env-a")
  })

  it("leaves activeEnvironmentId unchanged when deletion is cancelled", async () => {
    const user = userEvent.setup()
    useWorkspaceStore.setState((s) => ({ ...s, environments: [ENV_A] }))
    useUiStore.setState((s) => ({
      ...s,
      activePanel: "environments",
      activeEnvironmentId: "env-a",
    }))

    renderPanel()

    const row = screen.getByText("Production").closest("div")!
    await user.click(within(row).getByRole("button"))

    await user.click(await screen.findByRole("menuitem", { name: /delete/i }))
    await user.click(await screen.findByRole("button", { name: /cancel/i }))

    await waitFor(() => {
      expect(useUiStore.getState().activeEnvironmentId).toBe("env-a")
    })
    expect(useWorkspaceStore.getState().environments).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// CollectionsPanel — duplicate import guard
// ---------------------------------------------------------------------------

const BASE_COLLECTION: Collection = {
  id: "col-a",
  name: "My API",
  description: "",
  auth: { type: "none" },
  variables: [],
  preRequestScript: "",
  testScript: "",
  items: [],
}

describe("CollectionsPanel — duplicate import guard", () => {
  beforeEach(() => {
    useUiStore.setState((s) => ({ ...s, activePanel: "collections" }))
    vi.mocked(api.collections.import).mockClear()
    vi.mocked(api.collections.import).mockResolvedValue(undefined as never)
    vi.mocked(toast.error).mockClear()
  })

  it("blocks import and shows error when collection with same name already exists", async () => {
    const user = userEvent.setup()
    useWorkspaceStore.setState((s) => ({ ...s, collections: [BASE_COLLECTION] }))
    renderPanel()

    const file = new File(['{"info":{"name":"My API"},"item":[]}'], "api.json", {
      type: "application/json",
    })
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining("My API"))
    })
    expect(vi.mocked(api.collections.import)).not.toHaveBeenCalled()
  })

  it("proceeds with import when no collection with same name exists", async () => {
    const user = userEvent.setup()
    useWorkspaceStore.setState((s) => ({ ...s, collections: [] }))
    renderPanel()

    const file = new File(['{"info":{"name":"New API"},"item":[]}'], "api.json", {
      type: "application/json",
    })
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(vi.mocked(api.collections.import)).toHaveBeenCalled()
    })
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it("shows error toast for invalid JSON", async () => {
    const user = userEvent.setup()
    renderPanel()

    const file = new File(["not valid json"], "bad.json", { type: "application/json" })
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining("Failed to import collection"),
      )
    })
    expect(vi.mocked(api.collections.import)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// EnvironmentsPanel — duplicate import guard
// ---------------------------------------------------------------------------

describe("EnvironmentsPanel — duplicate import guard", () => {
  beforeEach(() => {
    useUiStore.setState((s) => ({ ...s, activePanel: "environments" }))
    vi.mocked(api.environments.import).mockClear()
    vi.mocked(api.environments.import).mockResolvedValue(undefined as never)
    vi.mocked(toast.error).mockClear()
  })

  it("blocks import and shows error when environment with same name already exists", async () => {
    const user = userEvent.setup()
    useWorkspaceStore.setState((s) => ({ ...s, environments: [ENV_A] }))
    renderPanel()

    const file = new File(['{"name":"Production","values":[]}'], "prod.json", {
      type: "application/json",
    })
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining("Production"))
    })
    expect(vi.mocked(api.environments.import)).not.toHaveBeenCalled()
  })

  it("proceeds with import when no environment with same name exists", async () => {
    const user = userEvent.setup()
    useWorkspaceStore.setState((s) => ({ ...s, environments: [] }))
    renderPanel()

    const file = new File(['{"name":"QA","values":[]}'], "qa.json", { type: "application/json" })
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(vi.mocked(api.environments.import)).toHaveBeenCalled()
    })
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it("shows error toast for invalid JSON", async () => {
    const user = userEvent.setup()
    renderPanel()

    const file = new File(["not valid json"], "bad.json", { type: "application/json" })
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining("Failed to import environment"),
      )
    })
    expect(vi.mocked(api.environments.import)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// HistoryPanel
// ---------------------------------------------------------------------------

function renderHistoryPanel() {
  useUiStore.setState((s) => ({ ...s, activePanel: "history" }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidePanel />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe("HistoryPanel — loading & empty states", () => {
  beforeEach(() => {
    useUiStore.setState((s) => ({ ...s, activePanel: "history" }))
    vi.mocked(backend.listHistory).mockResolvedValue([])
    vi.mocked(backend.deleteHistoryEntry).mockResolvedValue(undefined)
    vi.mocked(backend.clearHistory).mockResolvedValue(undefined)
  })

  it("shows 'Loading…' while query is in flight", async () => {
    vi.mocked(backend.listHistory).mockReturnValue(new Promise(() => {}))
    renderHistoryPanel()
    expect(await screen.findByText("Loading…")).toBeInTheDocument()
  })

  it("shows 'No history yet' when list is empty", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([])
    renderHistoryPanel()
    expect(await screen.findByText("No history yet")).toBeInTheDocument()
  })

  it("hides the Clear-All button when entries is empty", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([])
    renderHistoryPanel()
    await screen.findByText("No history yet")
    // only the panel header "History" text is present, no Trash2 button
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("HistoryPanel — entry rendering", () => {
  beforeEach(() => {
    useUiStore.setState((s) => ({ ...s, activePanel: "history" }))
    vi.mocked(backend.deleteHistoryEntry).mockResolvedValue(undefined)
    vi.mocked(backend.clearHistory).mockResolvedValue(undefined)
  })

  it("renders entry url, method, status, duration", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry()])
    renderHistoryPanel()
    expect(await screen.findByText("https://api.example.com/users")).toBeInTheDocument()
    expect(screen.getByText("200")).toBeInTheDocument()
    // duration is a text node inside a <p> alongside other nodes; match by regex on container
    expect(screen.getByText(/25ms/)).toBeInTheDocument()
  })

  it("formats duration < 1000 ms as 'Xms'", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry({ durationMs: 42 })])
    renderHistoryPanel()
    expect(await screen.findByText(/42ms/)).toBeInTheDocument()
  })

  it("formats duration >= 1000 ms as 'X.XXs'", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry({ durationMs: 2500 })])
    renderHistoryPanel()
    expect(await screen.findByText(/2\.50s/)).toBeInTheDocument()
  })

  it("status 200: span has class containing 'emerald'", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry({ status: 200 })])
    renderHistoryPanel()
    await screen.findByText("200")
    const span = screen.getByText("200")
    expect(span.className).toMatch(/emerald/)
  })

  it("status 302: span has class containing 'yellow'", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry({ status: 302 })])
    renderHistoryPanel()
    await screen.findByText("302")
    const span = screen.getByText("302")
    expect(span.className).toMatch(/yellow/)
  })

  it("status 404: span has class containing 'orange'", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry({ status: 404 })])
    renderHistoryPanel()
    await screen.findByText("404")
    const span = screen.getByText("404")
    expect(span.className).toMatch(/orange/)
  })

  it("status 500: span has class containing 'destructive'", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry({ status: 500 })])
    renderHistoryPanel()
    await screen.findByText("500")
    const span = screen.getByText("500")
    expect(span.className).toMatch(/destructive/)
  })

  it("status 100: span has class containing 'muted'", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue([makeEntry({ status: 100 })])
    renderHistoryPanel()
    await screen.findByText("100")
    const span = screen.getByText("100")
    expect(span.className).toMatch(/muted/)
  })
})

describe("HistoryPanel — delete entry", () => {
  beforeEach(() => {
    useUiStore.setState((s) => ({ ...s, activePanel: "history" }))
    vi.mocked(backend.deleteHistoryEntry).mockClear().mockResolvedValue(undefined)
    vi.mocked(backend.clearHistory).mockClear().mockResolvedValue(undefined)
    vi.mocked(backend.listHistory).mockClear().mockResolvedValue([makeEntry()])
  })

  it("clicking delete on an entry shows the confirmation dialog", async () => {
    const user = userEvent.setup()
    renderHistoryPanel()
    const urlText = await screen.findByText("https://api.example.com/users")
    const row = urlText.closest("div.group") as HTMLElement
    await user.click(within(row).getByRole("button"))
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  })

  it("confirming delete calls deleteHistoryEntry with the entry's id", async () => {
    const user = userEvent.setup()
    renderHistoryPanel()
    const urlText = await screen.findByText("https://api.example.com/users")
    const row = urlText.closest("div.group") as HTMLElement
    await user.click(within(row).getByRole("button"))
    await user.click(await screen.findByRole("button", { name: /^delete$/i }))
    await waitFor(() => {
      expect(vi.mocked(backend.deleteHistoryEntry)).toHaveBeenCalledWith("entry-1")
    })
  })

  it("confirming delete triggers reload (listHistory called again)", async () => {
    const user = userEvent.setup()
    renderHistoryPanel()
    const urlText = await screen.findByText("https://api.example.com/users")
    const row = urlText.closest("div.group") as HTMLElement
    await user.click(within(row).getByRole("button"))
    const callsBefore = vi.mocked(backend.listHistory).mock.calls.length
    await user.click(await screen.findByRole("button", { name: /^delete$/i }))
    await waitFor(() => {
      expect(vi.mocked(backend.listHistory).mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it("cancelling delete does NOT call deleteHistoryEntry", async () => {
    const user = userEvent.setup()
    renderHistoryPanel()
    const urlText = await screen.findByText("https://api.example.com/users")
    const row = urlText.closest("div.group") as HTMLElement
    await user.click(within(row).getByRole("button"))
    await user.click(await screen.findByRole("button", { name: /^cancel$/i }))
    expect(vi.mocked(backend.deleteHistoryEntry)).not.toHaveBeenCalled()
  })
})

describe("HistoryPanel — clear all", () => {
  beforeEach(() => {
    useUiStore.setState((s) => ({ ...s, activePanel: "history" }))
    vi.mocked(backend.deleteHistoryEntry).mockClear().mockResolvedValue(undefined)
    vi.mocked(backend.clearHistory).mockClear().mockResolvedValue(undefined)
    vi.mocked(backend.listHistory).mockClear().mockResolvedValue([makeEntry()])
  })

  it("clear-all button is visible when entries are present", async () => {
    renderHistoryPanel()
    await screen.findByText("https://api.example.com/users")
    // The Clear All button is the only button visible in the header before hovering entries
    const buttons = screen.getAllByRole("button")
    expect(buttons.length).toBeGreaterThan(0)
  })

  it("confirming clear all calls clearHistory", async () => {
    const user = userEvent.setup()
    renderHistoryPanel()
    await screen.findByText("https://api.example.com/users")
    // Header Trash2 button is the first button rendered
    const [clearAllBtn] = screen.getAllByRole("button")
    await user.click(clearAllBtn)
    await user.click(await screen.findByRole("button", { name: /^delete$/i }))
    await waitFor(() => {
      expect(vi.mocked(backend.clearHistory)).toHaveBeenCalled()
    })
  })

  it("confirming clear all triggers reload (listHistory called again)", async () => {
    const user = userEvent.setup()
    renderHistoryPanel()
    await screen.findByText("https://api.example.com/users")
    const [clearAllBtn] = screen.getAllByRole("button")
    const callsBefore = vi.mocked(backend.listHistory).mock.calls.length
    await user.click(clearAllBtn)
    await user.click(await screen.findByRole("button", { name: /^delete$/i }))
    await waitFor(() => {
      expect(vi.mocked(backend.listHistory).mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it("cancelling clear all does NOT call clearHistory", async () => {
    const user = userEvent.setup()
    renderHistoryPanel()
    await screen.findByText("https://api.example.com/users")
    const [clearAllBtn] = screen.getAllByRole("button")
    await user.click(clearAllBtn)
    await user.click(await screen.findByRole("button", { name: /^cancel$/i }))
    expect(vi.mocked(backend.clearHistory)).not.toHaveBeenCalled()
  })
})

describe("HistoryPanel — pagination", () => {
  beforeEach(() => {
    useUiStore.setState((s) => ({ ...s, activePanel: "history" }))
    vi.mocked(backend.deleteHistoryEntry).mockClear().mockResolvedValue(undefined)
    vi.mocked(backend.clearHistory).mockClear().mockResolvedValue(undefined)
    vi.mocked(backend.listHistory).mockClear()
  })

  it("hides 'Load more' when fewer than PAGE_SIZE (50) entries", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue(makeEntries(10))
    renderHistoryPanel()
    await screen.findByText("https://api.example.com/item/0")
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull()
  })

  it("shows 'Load more' when exactly PAGE_SIZE (50) entries", async () => {
    vi.mocked(backend.listHistory).mockResolvedValue(makeEntries(50))
    renderHistoryPanel()
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument()
  })

  it("clicking 'Load more' calls listHistory with offset 50 and appends entries", async () => {
    const user = userEvent.setup()
    const firstPage = makeEntries(50)
    const secondPage = makeEntries(5, 50)
    vi.mocked(backend.listHistory)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage)

    renderHistoryPanel()
    const loadMore = await screen.findByRole("button", { name: /load more/i })
    await user.click(loadMore)

    await waitFor(() => {
      expect(vi.mocked(backend.listHistory)).toHaveBeenCalledWith(50, 50)
    })
    expect(await screen.findByText("https://api.example.com/item/50")).toBeInTheDocument()
  })
})
