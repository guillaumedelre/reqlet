import { beforeEach, describe, expect, it } from "vitest"
import { useEnvironmentsStore } from "./environments"

beforeEach(() => {
  useEnvironmentsStore.setState({
    environments: [],
    globals: [],
    activeEnvironmentId: null,
  })
})

describe("addEnvironment", () => {
  it("creates an environment and returns its id", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Production")
    const { environments } = useEnvironmentsStore.getState()
    expect(environments).toHaveLength(1)
    expect(environments[0].id).toBe(id)
    expect(environments[0].name).toBe("Production")
    expect(environments[0].variables).toEqual([])
  })

  it("creates multiple independent environments", () => {
    useEnvironmentsStore.getState().addEnvironment("Dev")
    useEnvironmentsStore.getState().addEnvironment("Prod")
    expect(useEnvironmentsStore.getState().environments).toHaveLength(2)
  })
})

describe("updateEnvironment", () => {
  it("renames an environment", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Old Name")
    useEnvironmentsStore.getState().updateEnvironment(id, { name: "New Name" })
    const env = useEnvironmentsStore.getState().environments.find((e) => e.id === id)
    expect(env?.name).toBe("New Name")
  })

  it("ignores unknown id", () => {
    useEnvironmentsStore.getState().addEnvironment("Env")
    useEnvironmentsStore.getState().updateEnvironment("nonexistent", { name: "X" })
    expect(useEnvironmentsStore.getState().environments[0].name).toBe("Env")
  })
})

describe("deleteEnvironment", () => {
  it("removes the environment", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Temp")
    useEnvironmentsStore.getState().deleteEnvironment(id)
    expect(useEnvironmentsStore.getState().environments).toHaveLength(0)
  })

  it("clears activeEnvironmentId when the active env is deleted", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Env")
    useEnvironmentsStore.getState().setActiveEnvironment(id)
    useEnvironmentsStore.getState().deleteEnvironment(id)
    expect(useEnvironmentsStore.getState().activeEnvironmentId).toBeNull()
  })

  it("does not clear activeEnvironmentId for a different env", () => {
    const id1 = useEnvironmentsStore.getState().addEnvironment("Env1")
    const id2 = useEnvironmentsStore.getState().addEnvironment("Env2")
    useEnvironmentsStore.getState().setActiveEnvironment(id1)
    useEnvironmentsStore.getState().deleteEnvironment(id2)
    expect(useEnvironmentsStore.getState().activeEnvironmentId).toBe(id1)
  })
})

describe("setActiveEnvironment", () => {
  it("sets the active environment id", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Env")
    useEnvironmentsStore.getState().setActiveEnvironment(id)
    expect(useEnvironmentsStore.getState().activeEnvironmentId).toBe(id)
  })

  it("accepts null to deselect", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Env")
    useEnvironmentsStore.getState().setActiveEnvironment(id)
    useEnvironmentsStore.getState().setActiveEnvironment(null)
    expect(useEnvironmentsStore.getState().activeEnvironmentId).toBeNull()
  })
})

describe("addVariable / updateVariable / removeVariable", () => {
  it("adds a variable to an environment", () => {
    const envId = useEnvironmentsStore.getState().addEnvironment("Env")
    useEnvironmentsStore.getState().addVariable(envId)
    const env = useEnvironmentsStore.getState().environments.find((e) => e.id === envId)
    expect(env?.variables).toHaveLength(1)
    expect(env?.variables[0].key).toBe("")
    expect(env?.variables[0].enabled).toBe(true)
  })

  it("updates a variable field", () => {
    const envId = useEnvironmentsStore.getState().addEnvironment("Env")
    useEnvironmentsStore.getState().addVariable(envId)
    const { environments } = useEnvironmentsStore.getState()
    const varId = environments[0].variables[0].id
    useEnvironmentsStore.getState().updateVariable(envId, varId, {
      key: "token",
      initialValue: "abc",
      currentValue: "xyz",
    })
    const updated = useEnvironmentsStore.getState().environments[0].variables[0]
    expect(updated.key).toBe("token")
    expect(updated.initialValue).toBe("abc")
    expect(updated.currentValue).toBe("xyz")
  })

  it("removes a variable", () => {
    const envId = useEnvironmentsStore.getState().addEnvironment("Env")
    useEnvironmentsStore.getState().addVariable(envId)
    const { environments } = useEnvironmentsStore.getState()
    const varId = environments[0].variables[0].id
    useEnvironmentsStore.getState().removeVariable(envId, varId)
    expect(useEnvironmentsStore.getState().environments[0].variables).toHaveLength(0)
  })
})

describe("globals", () => {
  it("adds a global variable", () => {
    useEnvironmentsStore.getState().addGlobal()
    expect(useEnvironmentsStore.getState().globals).toHaveLength(1)
  })

  it("updates a global variable", () => {
    useEnvironmentsStore.getState().addGlobal()
    const varId = useEnvironmentsStore.getState().globals[0].id
    useEnvironmentsStore.getState().updateGlobal(varId, { key: "base_url", currentValue: "http://localhost" })
    const g = useEnvironmentsStore.getState().globals[0]
    expect(g.key).toBe("base_url")
    expect(g.currentValue).toBe("http://localhost")
  })

  it("removes a global variable", () => {
    useEnvironmentsStore.getState().addGlobal()
    const varId = useEnvironmentsStore.getState().globals[0].id
    useEnvironmentsStore.getState().removeGlobal(varId)
    expect(useEnvironmentsStore.getState().globals).toHaveLength(0)
  })
})
