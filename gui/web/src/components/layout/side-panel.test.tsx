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
})

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
