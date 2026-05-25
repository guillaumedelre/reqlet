import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    height,
    language,
    onChange,
    options,
  }: {
    value?: string
    height?: string | number
    language?: string
    onChange?: unknown
    options?: Record<string, unknown>
  }) => (
    <textarea
      data-testid="monaco-editor"
      data-height={String(height)}
      data-language={language}
      data-has-onchange={onChange !== undefined ? "true" : "false"}
      data-options={JSON.stringify(options ?? {})}
      defaultValue={value ?? ""}
      readOnly
    />
  ),
}))

import { CodeEditor } from "./code-editor"

function getOptions(): Record<string, unknown> {
  const raw =
    (screen.getByTestId("monaco-editor") as HTMLElement).getAttribute("data-options") ?? "{}"
  return JSON.parse(raw)
}

describe("CodeEditor — scrollbar configuration", () => {
  it("sets verticalScrollbarSize to 6 to match app custom scrollbar width", () => {
    render(<CodeEditor value="" />)
    const scrollbar = getOptions().scrollbar as Record<string, unknown>
    expect(scrollbar.verticalScrollbarSize).toBe(6)
  })

  it("sets horizontalScrollbarSize to 6 to match app custom scrollbar height", () => {
    render(<CodeEditor value="" />)
    const scrollbar = getOptions().scrollbar as Record<string, unknown>
    expect(scrollbar.horizontalScrollbarSize).toBe(6)
  })

  it("sets useShadows to false", () => {
    render(<CodeEditor value="" />)
    const scrollbar = getOptions().scrollbar as Record<string, unknown>
    expect(scrollbar.useShadows).toBe(false)
  })

  it("scrollbar config matches app-wide 6 px custom scrollbar theme as a whole", () => {
    render(<CodeEditor value="" />)
    expect(getOptions().scrollbar).toEqual({
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
      useShadows: false,
    })
  })
})

describe("CodeEditor — props passthrough", () => {
  it("passes value to Monaco", () => {
    render(<CodeEditor value="hello world" />)
    expect((screen.getByTestId("monaco-editor") as HTMLTextAreaElement).defaultValue).toBe(
      "hello world",
    )
  })

  it("defaults language to plaintext", () => {
    render(<CodeEditor value="" />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-language")).toBe("plaintext")
  })

  it("passes custom language to Monaco", () => {
    render(<CodeEditor value="" language="json" />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-language")).toBe("json")
  })

  it("defaults height to 100%", () => {
    render(<CodeEditor value="" />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-height")).toBe("100%")
  })

  it("passes custom numeric height to Monaco", () => {
    render(<CodeEditor value="" height={300} />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-height")).toBe("300")
  })

  it("passes custom string height to Monaco", () => {
    render(<CodeEditor value="" height="50vh" />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-height")).toBe("50vh")
  })

  it("sets readOnly option to true when readOnly prop is true", () => {
    render(<CodeEditor value="" readOnly />)
    expect(getOptions().readOnly).toBe(true)
  })

  it("sets readOnly option to false by default", () => {
    render(<CodeEditor value="" />)
    expect(getOptions().readOnly).toBe(false)
  })

  it("wordWrap defaults to on", () => {
    render(<CodeEditor value="" />)
    expect(getOptions().wordWrap).toBe("on")
  })

  it("passes wordWrap off to Monaco options", () => {
    render(<CodeEditor value="" wordWrap="off" />)
    expect(getOptions().wordWrap).toBe("off")
  })

  it("does not pass onChange to Monaco when readOnly is true", () => {
    render(<CodeEditor value="" readOnly onChange={vi.fn()} />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-has-onchange")).toBe("false")
  })

  it("passes onChange to Monaco when not readOnly", () => {
    render(<CodeEditor value="" onChange={vi.fn()} />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-has-onchange")).toBe("true")
  })

  it("passes a no-op onChange wrapper when not readOnly even without a handler", () => {
    render(<CodeEditor value="" />)
    expect(screen.getByTestId("monaco-editor").getAttribute("data-has-onchange")).toBe("true")
  })
})
