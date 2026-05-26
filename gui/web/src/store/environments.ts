import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Variable {
  id: string
  key: string
  initialValue: string
  currentValue: string
  enabled: boolean
}

export interface Environment {
  id: string
  name: string
  variables: Variable[]
}

function newVariable(): Variable {
  return { id: crypto.randomUUID(), key: "", initialValue: "", currentValue: "", enabled: true }
}

interface EnvironmentsState {
  environments: Environment[]
  globals: Variable[]
  activeEnvironmentId: string | null
  addEnvironment: (name: string) => string
  updateEnvironment: (id: string, patch: Partial<Omit<Environment, "id">>) => void
  deleteEnvironment: (id: string) => void
  setActiveEnvironment: (id: string | null) => void
  addVariable: (envId: string) => void
  updateVariable: (envId: string, varId: string, patch: Partial<Omit<Variable, "id">>) => void
  removeVariable: (envId: string, varId: string) => void
  addGlobal: () => void
  updateGlobal: (varId: string, patch: Partial<Omit<Variable, "id">>) => void
  removeGlobal: (varId: string) => void
}

export const useEnvironmentsStore = create<EnvironmentsState>()(
  persist(
    (set) => ({
      environments: [],
      globals: [],
      activeEnvironmentId: null,

      addEnvironment: (name) => {
        const env: Environment = { id: crypto.randomUUID(), name, variables: [] }
        set((s) => ({ environments: [...s.environments, env] }))
        return env.id
      },

      updateEnvironment: (id, patch) =>
        set((s) => ({
          environments: s.environments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteEnvironment: (id) =>
        set((s) => ({
          environments: s.environments.filter((e) => e.id !== id),
          activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
        })),

      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

      addVariable: (envId) =>
        set((s) => ({
          environments: s.environments.map((e) =>
            e.id === envId ? { ...e, variables: [...e.variables, newVariable()] } : e,
          ),
        })),

      updateVariable: (envId, varId, patch) =>
        set((s) => ({
          environments: s.environments.map((e) =>
            e.id === envId
              ? {
                  ...e,
                  variables: e.variables.map((v) => (v.id === varId ? { ...v, ...patch } : v)),
                }
              : e,
          ),
        })),

      removeVariable: (envId, varId) =>
        set((s) => ({
          environments: s.environments.map((e) =>
            e.id === envId ? { ...e, variables: e.variables.filter((v) => v.id !== varId) } : e,
          ),
        })),

      addGlobal: () => set((s) => ({ globals: [...s.globals, newVariable()] })),

      updateGlobal: (varId, patch) =>
        set((s) => ({
          globals: s.globals.map((v) => (v.id === varId ? { ...v, ...patch } : v)),
        })),

      removeGlobal: (varId) =>
        set((s) => ({ globals: s.globals.filter((v) => v.id !== varId) })),
    }),
    { name: "reqlet-environments", version: 1 },
  ),
)
