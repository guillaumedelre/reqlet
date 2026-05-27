import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PM_SANDBOX_TYPES } from "@/lib/pm-types"

// ---------------------------------------------------------------------------
// Monaco mock — simulates @monaco-editor/react calling onMount synchronously
// ---------------------------------------------------------------------------

const addExtraLibJs = vi.fn()
const registerCompletionProvider = vi.fn(() => ({ dispose: vi.fn() }))

const mockMonaco = {
  // Monaco 0.55+: typescript namespace lives at the top level, not under languages
  typescript: {
    javascriptDefaults: { addExtraLib: addExtraLibJs },
  },
  languages: {
    registerCompletionItemProvider: registerCompletionProvider,
  },
  editor: {
    defineTheme: vi.fn(),
  },
  Range: class {
    constructor(
      public sl: number,
      public sc: number,
      public el: number,
      public ec: number,
    ) {}
  },
}

const mockEditor = {
  getModel: vi.fn(() => null),
  createDecorationsCollection: vi.fn(() => ({ set: vi.fn(), clear: vi.fn() })),
  onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
}

vi.mock("@monaco-editor/react", () => ({
  default: vi.fn(({ onMount, beforeMount }) => {
    beforeMount?.(mockMonaco)
    onMount?.(mockEditor, mockMonaco)
    return null
  }),
}))

// ---------------------------------------------------------------------------
// Re-import CodeEditor AFTER the mock is registered
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CodeEditor } = await import("./code-editor")

beforeEach(() => {
  addExtraLibJs.mockClear()
  registerCompletionProvider.mockClear()
  // Reset the module-level guard so each test starts fresh
  vi.resetModules()
})

// ---------------------------------------------------------------------------
// pmCompletions prop
// ---------------------------------------------------------------------------

describe("CodeEditor — pmCompletions", () => {
  it("calls addExtraLib on javascriptDefaults when pmCompletions=true", () => {
    render(<CodeEditor value="" language="javascript" pmCompletions />)
    expect(addExtraLibJs).toHaveBeenCalledWith(PM_SANDBOX_TYPES as string, "ts:pm.d.ts")
  })

  it("does not call addExtraLib when pmCompletions is omitted", () => {
    render(<CodeEditor value="" language="javascript" />)
    expect(addExtraLibJs).not.toHaveBeenCalled()
  })

  it("does not call addExtraLib when pmCompletions=false", () => {
    render(<CodeEditor value="" language="javascript" pmCompletions={false} />)
    expect(addExtraLibJs).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Rendering baseline
// ---------------------------------------------------------------------------

describe("CodeEditor — rendering", () => {
  it("renders without crashing with default props", () => {
    expect(() => render(<CodeEditor value="hello" />)).not.toThrow()
  })

  it("renders without crashing with pmCompletions=true", () => {
    expect(() => render(<CodeEditor value="" language="javascript" pmCompletions />)).not.toThrow()
  })
})
