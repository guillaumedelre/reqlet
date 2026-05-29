import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { EnvironmentPane } from "./environment-pane"
import { useTabsStore } from "@/store/tabs"
import { useWorkspaceStore } from "@/store/workspace"
import type { Environment, Tab } from "@/types"

const ENV: Environment = { id: "env-test", name: "Test Env", variables: [] }

const ENV_TAB: Tab = {
  id: "tab-env",
  type: "environment",
  title: "Test Env",
  dirty: false,
  environmentId: "env-test",
  request: {
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: {
      type: "none",
      raw: "",
      rawContentType: "application/json",
      formData: [],
      urlencoded: [],
      graphqlQuery: "",
      graphqlVariables: "",
    },
    auth: { type: "inherit" },
    preRequestScript: "",
    testScript: "",
  },
  isSending: false,
  response: null,
  requestSubTab: "params",
  responseSubTab: "body",
  collectionSubTab: "overview",
}

function setEnvs(envs: Environment[]) {
  useWorkspaceStore.setState((s) => ({ ...s, environments: envs }))
}

function setupStores(env: Environment | null = ENV) {
  useTabsStore.setState({ tabs: [ENV_TAB], activeTabId: "tab-env", closedTabs: [] })
  setEnvs(env ? [env] : [])
}

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
  setEnvs([])
  localStorage.clear()
})

describe("rendering", () => {
  it("renders the environment name in the header", () => {
    setupStores()
    render(<EnvironmentPane />)
    expect(screen.getByText("Test Env")).toBeInTheDocument()
  })

  it("renders the variable count", () => {
    const envWithVars: Environment = {
      ...ENV,
      variables: [
        {
          id: "v1",
          enabled: true,
          key: "baseUrl",
          initialValue: "http://localhost",
          currentValue: "http://localhost",
        },
      ],
    }
    setupStores(envWithVars)
    render(<EnvironmentPane />)
    expect(screen.getByText("1 variables")).toBeInTheDocument()
  })

  it("shows empty state when there are no variables", () => {
    setupStores()
    render(<EnvironmentPane />)
    expect(screen.getByText(/No variables yet/)).toBeInTheDocument()
  })

  it("renders nothing when the environment does not exist", () => {
    setupStores(null)
    const { container } = render(<EnvironmentPane />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when there is no active environment tab", () => {
    useTabsStore.setState({ tabs: [], activeTabId: "", closedTabs: [] })
    setEnvs([ENV])
    const { container } = render(<EnvironmentPane />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("auto-close on environment deletion", () => {
  it("closes the tab when the environment is deleted", async () => {
    setupStores()
    render(<EnvironmentPane />)

    expect(useTabsStore.getState().tabs).toHaveLength(1)

    act(() => {
      setEnvs([])
    })

    await waitFor(() => {
      expect(useTabsStore.getState().tabs.find((t) => t.id === "tab-env")).toBeUndefined()
    })
  })

  it("does not close unrelated tabs when an environment is deleted", async () => {
    const otherTab: Tab = {
      ...ENV_TAB,
      id: "tab-other",
      type: "request",
      environmentId: undefined,
      title: "Other Tab",
    }
    useTabsStore.setState({ tabs: [ENV_TAB, otherTab], activeTabId: "tab-env", closedTabs: [] })
    setEnvs([ENV])

    render(<EnvironmentPane />)

    act(() => {
      setEnvs([])
    })

    await waitFor(() => {
      const tabIds = useTabsStore.getState().tabs.map((t) => t.id)
      expect(tabIds).not.toContain("tab-env")
      expect(tabIds).toContain("tab-other")
    })
  })
})

describe("add variable", () => {
  it("adds a variable row when clicking Add Variable", async () => {
    setupStores()
    const { getByText } = render(<EnvironmentPane />)
    const btn = getByText(/Add Variable/)

    act(() => btn.click())

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("Variable").length).toBe(1)
    })
  })
})

describe("EnvRow — variable editing", () => {
  const ENV_WITH_VAR: Environment = {
    id: "env-test",
    name: "Test Env",
    variables: [
      {
        id: "v1",
        enabled: true,
        key: "BASE_URL",
        initialValue: "http://localhost",
        currentValue: "http://dev",
      },
    ],
  }

  it("renders existing variable key and values", () => {
    setupStores(ENV_WITH_VAR)
    render(<EnvironmentPane />)
    expect(screen.getByDisplayValue("BASE_URL")).toBeInTheDocument()
    expect(screen.getByDisplayValue("http://localhost")).toBeInTheDocument()
    expect(screen.getByDisplayValue("http://dev")).toBeInTheDocument()
  })

  it("calls updateEnvironmentVariable when key is edited", async () => {
    setupStores(ENV_WITH_VAR)
    render(<EnvironmentPane />)
    const keyInput = screen.getByDisplayValue("BASE_URL")

    act(() => {
      fireEvent.change(keyInput, { target: { value: "API_URL" } })
    })

    await waitFor(() => {
      const env = useWorkspaceStore.getState().environments.find((e) => e.id === ENV_WITH_VAR.id)!
      expect(env.variables[0].key).toBe("API_URL")
    })
  })

  it("calls updateEnvironmentVariable when initial value is edited", async () => {
    setupStores(ENV_WITH_VAR)
    render(<EnvironmentPane />)
    const initialInput = screen.getByDisplayValue("http://localhost")

    act(() => {
      fireEvent.change(initialInput, { target: { value: "https://new.example.com" } })
    })

    await waitFor(() => {
      const env = useWorkspaceStore.getState().environments.find((e) => e.id === ENV_WITH_VAR.id)!
      expect(env.variables[0].initialValue).toBe("https://new.example.com")
    })
  })

  it("calls updateEnvironmentVariable when current value is edited", async () => {
    setupStores(ENV_WITH_VAR)
    render(<EnvironmentPane />)
    const currentInput = screen.getByDisplayValue("http://dev")

    act(() => {
      fireEvent.change(currentInput, { target: { value: "https://prod.example.com" } })
    })

    await waitFor(() => {
      const env = useWorkspaceStore.getState().environments.find((e) => e.id === ENV_WITH_VAR.id)!
      expect(env.variables[0].currentValue).toBe("https://prod.example.com")
    })
  })

  it("toggles variable enabled state via checkbox", async () => {
    setupStores(ENV_WITH_VAR)
    render(<EnvironmentPane />)

    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).toHaveAttribute("data-state", "checked")

    act(() => {
      fireEvent.click(checkbox)
    })

    await waitFor(() => {
      const env = useWorkspaceStore.getState().environments.find((e) => e.id === ENV_WITH_VAR.id)!
      expect(env.variables[0].enabled).toBe(false)
    })
  })

  it("deletes a variable with empty key after confirming the dialog", async () => {
    const envWithEmptyKey: Environment = {
      id: "env-test",
      name: "Test Env",
      variables: [{ id: "v1", enabled: true, key: "", initialValue: "", currentValue: "" }],
    }
    setEnvs([envWithEmptyKey])
    useTabsStore.setState({ tabs: [ENV_TAB], activeTabId: "tab-env", closedTabs: [] })
    render(<EnvironmentPane />)

    const deleteBtn = screen.getAllByRole("button")[0]
    act(() => {
      fireEvent.click(deleteBtn)
    })
    const confirmBtn = await screen.findByRole("button", { name: /delete/i })
    act(() => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      const env = useWorkspaceStore.getState().environments.find((e) => e.id === envWithEmptyKey.id)
      expect(env?.variables).toHaveLength(0)
    })
  })

  it("deletes the variable after confirming the dialog", async () => {
    setEnvs([ENV_WITH_VAR])
    useTabsStore.setState({ tabs: [ENV_TAB], activeTabId: "tab-env", closedTabs: [] })
    render(<EnvironmentPane />)

    // delete button is first <button> in the row; "Add Variable" is last
    const deleteBtn = screen.getAllByRole("button")[0]

    act(() => {
      fireEvent.click(deleteBtn)
    })

    // confirm in the dialog
    const confirmBtn = await screen.findByRole("button", { name: /delete/i })
    act(() => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      const env = useWorkspaceStore.getState().environments.find((e) => e.id === ENV_WITH_VAR.id)
      expect(env?.variables).toHaveLength(0)
    })
  })
})
