import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useEnvironmentsStore } from "@/store/environments"
import { EnvironmentEditor } from "./environment-editor"

beforeEach(() => {
  useEnvironmentsStore.setState({ environments: [], globals: [], activeEnvironmentId: null })
})

describe("EnvironmentEditor", () => {
  it("renders Globals button selected by default", () => {
    render(<EnvironmentEditor onClose={vi.fn()} />)
    expect(screen.getByText("Globals")).toBeInTheDocument()
  })

  it("shows Global Variables panel by default", () => {
    render(<EnvironmentEditor onClose={vi.fn()} />)
    expect(screen.getByText("Global Variables")).toBeInTheDocument()
  })

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn()
    render(<EnvironmentEditor onClose={onClose} />)
    fireEvent.click(screen.getByText("×"))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn()
    render(<EnvironmentEditor onClose={onClose} />)
    fireEvent.mouseDown(screen.getByTestId("env-editor-backdrop"))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("does not call onClose when clicking inside the modal", () => {
    const onClose = vi.fn()
    render(<EnvironmentEditor onClose={onClose} />)
    fireEvent.mouseDown(screen.getByText("Global Variables"))
    expect(onClose).not.toHaveBeenCalled()
  })

  it("shows environment name input and Add button", () => {
    render(<EnvironmentEditor onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText("Environment name")).toBeInTheDocument()
    expect(screen.getByTitle("Add environment")).toBeInTheDocument()
  })

  it("adds environment with typed name on button click", () => {
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText("Environment name"), {
      target: { value: "Staging" },
    })
    fireEvent.click(screen.getByTitle("Add environment"))
    expect(useEnvironmentsStore.getState().environments).toHaveLength(1)
    expect(useEnvironmentsStore.getState().environments[0].name).toBe("Staging")
  })

  it("uses 'New Environment' as fallback name when input is empty", () => {
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle("Add environment"))
    expect(useEnvironmentsStore.getState().environments[0].name).toBe("New Environment")
  })

  it("adds environment on Enter key", () => {
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.keyDown(screen.getByPlaceholderText("Environment name"), { key: "Enter" })
    expect(useEnvironmentsStore.getState().environments).toHaveLength(1)
  })

  it("selects newly added environment and shows its panel", () => {
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText("Environment name"), {
      target: { value: "Dev" },
    })
    fireEvent.click(screen.getByTitle("Add environment"))
    expect(screen.getByDisplayValue("Dev")).toBeInTheDocument()
  })

  it("selects an existing environment by clicking its name", () => {
    useEnvironmentsStore.getState().addEnvironment("Production")
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Production"))
    expect(screen.getByDisplayValue("Production")).toBeInTheDocument()
  })

  it("updates environment name when its input changes", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Old")
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Old"))
    fireEvent.change(screen.getByDisplayValue("Old"), { target: { value: "New" } })
    expect(useEnvironmentsStore.getState().environments.find((e) => e.id === id)?.name).toBe("New")
  })

  it("deletes selected environment and returns to globals", () => {
    useEnvironmentsStore.getState().addEnvironment("ToDelete")
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("ToDelete"))
    fireEvent.click(screen.getByTitle("Delete environment"))
    expect(useEnvironmentsStore.getState().environments).toHaveLength(0)
    expect(screen.getByText("Global Variables")).toBeInTheDocument()
  })

  it("deletes a non-selected environment without changing panel", () => {
    useEnvironmentsStore.getState().addEnvironment("Keep")
    useEnvironmentsStore.getState().addEnvironment("Remove")
    render(<EnvironmentEditor onClose={vi.fn()} />)
    const deleteButtons = screen.getAllByTitle("Delete environment")
    fireEvent.click(deleteButtons[1])
    expect(useEnvironmentsStore.getState().environments).toHaveLength(1)
    expect(screen.getByText("Global Variables")).toBeInTheDocument()
  })

  it("shows 'Select an environment or create one' when selected env is removed from store", () => {
    useEnvironmentsStore.getState().addEnvironment("Stale")
    const { rerender } = render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Stale"))
    useEnvironmentsStore.setState({ environments: [] })
    rerender(<EnvironmentEditor onClose={vi.fn()} />)
    expect(screen.getByText(/Select an environment/)).toBeInTheDocument()
  })

  it("clicking Globals button switches back from an environment panel", () => {
    useEnvironmentsStore.getState().addEnvironment("Dev")
    render(<EnvironmentEditor onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Dev"))
    fireEvent.click(screen.getByText("Globals"))
    expect(screen.getByText("Global Variables")).toBeInTheDocument()
  })
})
