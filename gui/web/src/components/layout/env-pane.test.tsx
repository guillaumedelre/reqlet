import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useEnvironmentsStore } from "@/store/environments"
import { useTabsStore } from "@/store/tabs"
import { EnvPane } from "./env-pane"

beforeEach(() => {
  useEnvironmentsStore.setState({ environments: [], globals: [], activeEnvironmentId: null })
  useTabsStore.setState({ tabs: [], activeTabId: null, closedTabHistory: [] })
})

describe("EnvPane", () => {
  it("renders nothing when no active tab", () => {
    const { container } = render(<EnvPane />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing for a request tab", () => {
    useTabsStore.getState().openTab()
    const { container } = render(<EnvPane />)
    expect(container.firstChild).toBeNull()
  })

  describe("globals tab", () => {
    beforeEach(() => {
      useTabsStore.getState().openGlobalsTab()
    })

    it("shows Global Variables heading", () => {
      render(<EnvPane />)
      expect(screen.getByText("Global Variables")).toBeInTheDocument()
    })

    it("shows description text", () => {
      render(<EnvPane />)
      expect(screen.getByText(/Available across all environments/)).toBeInTheDocument()
    })

    it("shows Add Variable button", () => {
      render(<EnvPane />)
      expect(screen.getByText("+ Add Variable")).toBeInTheDocument()
    })

    it("adds a global variable on Add Variable click", () => {
      render(<EnvPane />)
      fireEvent.click(screen.getByText("+ Add Variable"))
      expect(useEnvironmentsStore.getState().globals).toHaveLength(1)
    })
  })

  describe("environment tab", () => {
    it("shows environment name input", () => {
      const id = useEnvironmentsStore.getState().addEnvironment("Staging")
      useTabsStore.getState().openEnvTab(id)
      render(<EnvPane />)
      expect(screen.getByDisplayValue("Staging")).toBeInTheDocument()
    })

    it("updates environment name on input change", () => {
      const id = useEnvironmentsStore.getState().addEnvironment("Staging")
      useTabsStore.getState().openEnvTab(id)
      render(<EnvPane />)
      fireEvent.change(screen.getByDisplayValue("Staging"), { target: { value: "Production" } })
      expect(useEnvironmentsStore.getState().environments[0].name).toBe("Production")
    })

    it("shows Environment label", () => {
      const id = useEnvironmentsStore.getState().addEnvironment("Dev")
      useTabsStore.getState().openEnvTab(id)
      render(<EnvPane />)
      expect(screen.getByText("Environment")).toBeInTheDocument()
    })

    it("shows Add Variable button", () => {
      const id = useEnvironmentsStore.getState().addEnvironment("Dev")
      useTabsStore.getState().openEnvTab(id)
      render(<EnvPane />)
      expect(screen.getByText("+ Add Variable")).toBeInTheDocument()
    })

    it("adds a variable on Add Variable click", () => {
      const id = useEnvironmentsStore.getState().addEnvironment("Dev")
      useTabsStore.getState().openEnvTab(id)
      render(<EnvPane />)
      fireEvent.click(screen.getByText("+ Add Variable"))
      expect(useEnvironmentsStore.getState().environments[0].variables).toHaveLength(1)
    })

    it("shows Environment not found when envId is stale", () => {
      // environments is empty but tab points to a deleted env id
      useTabsStore.getState().openEnvTab("ghost-id")
      render(<EnvPane />)
      expect(screen.getByText("Environment not found.")).toBeInTheDocument()
    })
  })
})
