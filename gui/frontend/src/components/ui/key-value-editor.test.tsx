import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
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

// Stateful wrapper needed because autocomplete depends on items prop being updated
function AutocompleteEditor({ completions }: { completions: string[] }) {
  const [items, setItems] = useState<KeyValueItem[]>([
    { id: "row-1", key: "", value: "", enabled: true },
  ])
  return <KeyValueEditor items={items} onChange={setItems} keyAutocomplete={completions} />
}

const COMPLETIONS = [
  "Authorization",
  "Accept",
  "Accept-Encoding",
  "Content-Type",
  "Content-Length",
  "X-Auth-Token",
]

describe("KeyValueEditor — row operations", () => {
  it("adds a new empty row when clicking + Add", () => {
    const onChange = vi.fn()
    render(<KeyValueEditor items={[item("key", "val")]} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: "key", value: "val" }),
        expect.objectContaining({ key: "", value: "" }),
      ]),
    )
  })

  it("removes a row when clicking ×", () => {
    const onChange = vi.fn()
    render(
      <KeyValueEditor items={[item("keep", "this"), item("remove", "me")]} onChange={onChange} />,
    )
    fireEvent.click(screen.getAllByTitle("Remove")[1])
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: "keep" })])
  })

  it("toggles enabled state via checkbox", () => {
    const onChange = vi.fn()
    render(<KeyValueEditor items={[item("key", "val")]} onChange={onChange} />)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ enabled: false })])
  })

  it("shows TYPE column when allowFileType is true", () => {
    render(<KeyValueEditor items={[item("key", "val")]} onChange={() => {}} allowFileType />)
    expect(screen.getByText("TYPE")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Text" })).toBeInTheDocument()
  })

  it("toggles item type from Text to File", () => {
    const onChange = vi.fn()
    render(<KeyValueEditor items={[item("key", "")]} onChange={onChange} allowFileType />)
    fireEvent.click(screen.getByRole("button", { name: "Text" }))
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: "file", value: "" })])
  })

  it("does not show + Add or × when readOnlyKeys is true", () => {
    render(<KeyValueEditor items={[item("key", "val")]} onChange={() => {}} readOnlyKeys />)
    expect(screen.queryByRole("button", { name: "+ Add" })).not.toBeInTheDocument()
    expect(screen.queryByTitle("Remove")).not.toBeInTheDocument()
  })

  it("parses bulk text back to items when exiting bulk mode", () => {
    const onChange = vi.fn()
    render(<KeyValueEditor items={[]} onChange={onChange} allowBulkEdit defaultBulkMode />)
    fireEvent.change(screen.getByPlaceholderText(/key: value/), {
      target: { value: "Authorization: Bearer tok\nContent-Type: application/json" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Key-Value Edit" }))
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: "Authorization", value: "Bearer tok" }),
        expect.objectContaining({ key: "Content-Type", value: "application/json" }),
      ]),
    )
  })

  it("updates the key field when typing", () => {
    const onChange = vi.fn()
    render(<KeyValueEditor items={[item("old", "val")]} onChange={onChange} />)
    fireEvent.change(screen.getAllByPlaceholderText("Key")[0], { target: { value: "new" } })
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: "new" })])
  })

  it("updates the value field when typing", () => {
    const onChange = vi.fn()
    render(<KeyValueEditor items={[item("key", "old")]} onChange={onChange} />)
    fireEvent.change(screen.getAllByPlaceholderText("Value")[0], { target: { value: "new" } })
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ value: "new" })])
  })
})

describe("KeyValueEditor — autocomplete", () => {
  it("shows no dropdown without keyAutocomplete prop", () => {
    render(
      <KeyValueEditor
        items={[{ id: "r", key: "", value: "", enabled: true }]}
        onChange={() => {}}
      />,
    )
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "auth" } })
    expect(screen.queryByText("Authorization")).not.toBeInTheDocument()
  })

  it("shows no suggestions for an empty input", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.focus(input)
    expect(screen.queryByText("Authorization")).not.toBeInTheDocument()
  })

  it("shows filtered suggestions when typing", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "auth" } })
    expect(screen.getByText("Authorization")).toBeInTheDocument()
    expect(screen.getByText("X-Auth-Token")).toBeInTheDocument()
    expect(screen.queryByText("Accept")).not.toBeInTheDocument()
  })

  it("prioritizes starts-with matches over contains matches", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "auth" } })
    const items = screen.getAllByRole("generic").filter((el) => {
      const text = el.textContent
      return text === "Authorization" || text === "X-Auth-Token"
    })
    // Authorization (starts-with) must appear before X-Auth-Token (contains)
    expect(items[0].textContent).toBe("Authorization")
    expect(items[1].textContent).toBe("X-Auth-Token")
  })

  it("limits suggestions to 10", () => {
    const long = Array.from({ length: 15 }, (_, i) => `Accept-Custom-${i}`)
    render(<AutocompleteEditor completions={long} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "acc" } })
    const suggestions = screen.getAllByText(/Accept-Custom-/)
    expect(suggestions).toHaveLength(10)
  })

  it("Enter selects the first suggestion", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "auth" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect((input as HTMLInputElement).value).toBe("Authorization")
  })

  it("ArrowDown then Enter selects the second suggestion", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "acc" } })
    // suggestions: ["Accept", "Accept-Encoding"]
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect((input as HTMLInputElement).value).toBe("Accept-Encoding")
  })

  it("Escape closes the dropdown without changing the key", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "auth" } })
    expect(screen.getByText("Authorization")).toBeInTheDocument()
    fireEvent.keyDown(input, { key: "Escape" })
    expect(screen.queryByText("Authorization")).not.toBeInTheDocument()
    expect((input as HTMLInputElement).value).toBe("auth")
  })

  it("dropdown closes after a suggestion is selected", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "auth" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(screen.queryByText("X-Auth-Token")).not.toBeInTheDocument()
  })

  it("shows no suggestions when input matches nothing in the list", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "zzznomatch" } })
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    // None of our completions should appear
    COMPLETIONS.forEach((c) => expect(screen.queryByText(c)).not.toBeInTheDocument())
  })

  it("clicking a suggestion with mouseDown selects it", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "auth" } })
    const suggestion = screen.getByText("Authorization")
    fireEvent.mouseDown(suggestion)
    expect((input as HTMLInputElement).value).toBe("Authorization")
    expect(screen.queryByText("X-Auth-Token")).not.toBeInTheDocument()
  })

  it("focusing an input that already has a value reopens the dropdown", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    // Type something then close dropdown
    fireEvent.change(input, { target: { value: "acc" } })
    fireEvent.keyDown(input, { key: "Escape" })
    expect(screen.queryByText("Accept")).not.toBeInTheDocument()
    // Re-focus → dropdown should reopen
    fireEvent.focus(input)
    expect(screen.getByText("Accept")).toBeInTheDocument()
  })

  it("ArrowUp decrements the highlighted index (clamped at 0)", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "acc" } })
    // Suggestions: ["Accept", "Accept-Encoding"] — first is highlighted by default
    // ArrowDown to index 1 then ArrowUp back to index 0 → Enter selects "Accept"
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect((input as HTMLInputElement).value).toBe("Accept")
  })

  it("ArrowUp at index 0 stays at index 0", () => {
    render(<AutocompleteEditor completions={COMPLETIONS} />)
    const input = screen.getByPlaceholderText("Key")
    fireEvent.change(input, { target: { value: "acc" } })
    // Already at index 0; ArrowUp should not go below 0 → Enter still selects first
    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect((input as HTMLInputElement).value).toBe("Accept")
  })
})

describe("KeyValueEditor — file type", () => {
  it("toggles item type from File back to Text", () => {
    const onChange = vi.fn()
    const fileItem = { id: "r1", key: "upload", value: "", enabled: true, type: "file" as const }
    render(<KeyValueEditor items={[fileItem]} onChange={onChange} allowFileType />)
    fireEvent.click(screen.getByRole("button", { name: "File" }))
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: "text", value: "" })])
  })
})
