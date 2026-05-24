import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { KeyValueItem } from "@/store/tabs"
import { KeyValueEditor } from "./key-value-editor"

const item = (key: string, value: string, enabled = true): KeyValueItem => ({
  id: crypto.randomUUID(),
  key,
  value,
  enabled,
})

describe("KeyValueEditor — bulk edit mode", () => {
  it("starts in key-value mode by default", () => {
    render(<KeyValueEditor items={[]} onChange={() => {}} allowBulkEdit />)
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/key: value/)).not.toBeInTheDocument()
  })

  it("starts in bulk mode when defaultBulkMode is true", () => {
    render(<KeyValueEditor items={[]} onChange={() => {}} allowBulkEdit defaultBulkMode />)
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/key: value/)).toBeInTheDocument()
  })

  it("switches to bulk mode on Bulk Edit click", () => {
    render(<KeyValueEditor items={[]} onChange={() => {}} allowBulkEdit />)
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/key: value/)).toBeInTheDocument()
  })

  it("switches back to key-value mode on Key-Value Edit click", () => {
    render(<KeyValueEditor items={[]} onChange={() => {}} allowBulkEdit defaultBulkMode />)
    fireEvent.click(screen.getByRole("button", { name: "Key-Value Edit" }))
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/key: value/)).not.toBeInTheDocument()
  })

  it("calls onBulkModeChange(true) when entering bulk mode", () => {
    const spy = vi.fn()
    render(<KeyValueEditor items={[]} onChange={() => {}} allowBulkEdit onBulkModeChange={spy} />)
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    expect(spy).toHaveBeenCalledWith(true)
  })

  it("calls onBulkModeChange(false) when exiting bulk mode", () => {
    const spy = vi.fn()
    render(
      <KeyValueEditor
        items={[]}
        onChange={() => {}}
        allowBulkEdit
        defaultBulkMode
        onBulkModeChange={spy}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Key-Value Edit" }))
    expect(spy).toHaveBeenCalledWith(false)
  })

  it("populates textarea with enabled items when entering bulk mode", () => {
    const items = [
      item("Authorization", "Bearer token"),
      item("Content-Type", "application/json"),
      { ...item("X-Disabled", "skip"), enabled: false },
    ]
    render(<KeyValueEditor items={items} onChange={() => {}} allowBulkEdit />)
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    const ta = screen.getByPlaceholderText(/key: value/) as HTMLTextAreaElement
    expect(ta.value).toBe("Authorization: Bearer token\nContent-Type: application/json")
  })

  it("pre-populates textarea when defaultBulkMode is true", () => {
    const items = [item("foo", "bar")]
    render(<KeyValueEditor items={items} onChange={() => {}} allowBulkEdit defaultBulkMode />)
    const ta = screen.getByPlaceholderText(/key: value/) as HTMLTextAreaElement
    expect(ta.value).toBe("foo: bar")
  })

  it("does not show the toggle button when allowBulkEdit is false", () => {
    render(<KeyValueEditor items={[]} onChange={() => {}} />)
    expect(screen.queryByRole("button", { name: "Bulk Edit" })).not.toBeInTheDocument()
  })
})
