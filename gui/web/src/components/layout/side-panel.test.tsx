import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SidePanel } from "./side-panel"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useUiStore } from "@/store/ui"
import { useWorkspaceStore } from "@/store/workspace"
import { useTabsStore } from "@/store/tabs"
import type { Environment } from "@/types"

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
