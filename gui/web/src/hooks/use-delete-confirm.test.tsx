import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useDeleteConfirm } from "./use-delete-confirm"

function Fixture({ label = "", onConfirm = vi.fn() }: { label?: string; onConfirm?: () => void }) {
  const { requestDelete, dialog } = useDeleteConfirm()
  return (
    <>
      <button onClick={() => requestDelete(label, onConfirm)}>open</button>
      {dialog}
    </>
  )
}

describe("useDeleteConfirm", () => {
  it("does not render dialog before requestDelete is called", () => {
    render(<Fixture />)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("renders dialog with quoted label after requestDelete", async () => {
    const user = userEvent.setup()
    render(<Fixture label="My Collection" />)
    await user.click(screen.getByRole("button", { name: "open" }))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText(/"My Collection"\?/)).toBeInTheDocument()
  })

  it('renders "this item" when label is empty', async () => {
    const user = userEvent.setup()
    render(<Fixture label="" />)
    await user.click(screen.getByRole("button", { name: "open" }))
    expect(screen.getByText(/this item\?/)).toBeInTheDocument()
  })

  it("calls onConfirm and closes dialog on Delete", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Fixture label="Item" onConfirm={onConfirm} />)
    await user.click(screen.getByRole("button", { name: "open" }))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("closes dialog on Cancel without calling onConfirm", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Fixture label="Item" onConfirm={onConfirm} />)
    await user.click(screen.getByRole("button", { name: "open" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
