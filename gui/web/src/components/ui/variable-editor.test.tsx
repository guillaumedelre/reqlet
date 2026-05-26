import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Variable } from "@/store/environments"
import { VariableEditor } from "./variable-editor"

function makeVar(key = "MY_VAR", currentValue = "value"): Variable {
  return { id: crypto.randomUUID(), key, initialValue: "init", currentValue, enabled: true }
}

describe("VariableEditor", () => {
  it("shows Add Variable button when empty", () => {
    render(<VariableEditor variables={[]} onAdd={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByText("+ Add Variable")).toBeInTheDocument()
  })

  it("does not show header row when no variables", () => {
    render(<VariableEditor variables={[]} onAdd={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.queryByText("VARIABLE")).not.toBeInTheDocument()
  })

  it("shows header row when variables exist", () => {
    render(
      <VariableEditor
        variables={[makeVar()]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByText("VARIABLE")).toBeInTheDocument()
    expect(screen.getByText("INITIAL VALUE")).toBeInTheDocument()
    expect(screen.getByText("CURRENT VALUE")).toBeInTheDocument()
  })

  it("calls onAdd when + Add Variable is clicked", () => {
    const onAdd = vi.fn()
    render(<VariableEditor variables={[]} onAdd={onAdd} onUpdate={vi.fn()} onRemove={vi.fn()} />)
    fireEvent.click(screen.getByText("+ Add Variable"))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it("renders variable key input with correct value", () => {
    render(
      <VariableEditor
        variables={[makeVar("API_KEY")]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument()
  })

  it("renders initial and current value inputs", () => {
    render(
      <VariableEditor
        variables={[makeVar("K", "curr")]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByDisplayValue("init")).toBeInTheDocument()
    expect(screen.getByDisplayValue("curr")).toBeInTheDocument()
  })

  it("calls onUpdate with key when key input changes", () => {
    const onUpdate = vi.fn()
    const v = makeVar("OLD")
    render(
      <VariableEditor variables={[v]} onAdd={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    )
    fireEvent.change(screen.getByDisplayValue("OLD"), { target: { value: "NEW" } })
    expect(onUpdate).toHaveBeenCalledWith(v.id, { key: "NEW" })
  })

  it("calls onUpdate with initialValue when initial value input changes", () => {
    const onUpdate = vi.fn()
    const v = makeVar()
    render(
      <VariableEditor variables={[v]} onAdd={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    )
    fireEvent.change(screen.getByDisplayValue("init"), { target: { value: "new-init" } })
    expect(onUpdate).toHaveBeenCalledWith(v.id, { initialValue: "new-init" })
  })

  it("calls onUpdate with currentValue when current value input changes", () => {
    const onUpdate = vi.fn()
    const v = makeVar("K", "old-curr")
    render(
      <VariableEditor variables={[v]} onAdd={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    )
    fireEvent.change(screen.getByDisplayValue("old-curr"), { target: { value: "new-curr" } })
    expect(onUpdate).toHaveBeenCalledWith(v.id, { currentValue: "new-curr" })
  })

  it("calls onUpdate with enabled=false when checkbox is unchecked", () => {
    const onUpdate = vi.fn()
    const v = makeVar()
    render(
      <VariableEditor variables={[v]} onAdd={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onUpdate).toHaveBeenCalledWith(v.id, { enabled: false })
  })

  it("calls onRemove when × button is clicked", () => {
    const onRemove = vi.fn()
    const v = makeVar()
    render(
      <VariableEditor variables={[v]} onAdd={vi.fn()} onUpdate={vi.fn()} onRemove={onRemove} />,
    )
    fireEvent.click(screen.getByTitle("Remove"))
    expect(onRemove).toHaveBeenCalledWith(v.id)
  })

  it("renders multiple variable rows", () => {
    const vars = [makeVar("A"), makeVar("B"), makeVar("C")]
    render(
      <VariableEditor variables={vars} onAdd={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    )
    expect(screen.getAllByTitle("Remove")).toHaveLength(3)
  })
})
