import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { tokenizeVariables, VariableInput } from "./variable-input"
import { TooltipProvider } from "@/components/ui/tooltip"

// ---------------------------------------------------------------------------
// tokenizeVariables — pure function
// ---------------------------------------------------------------------------

describe("tokenizeVariables", () => {
  const empty = new Map<string, string>()

  it("returns a single text token for plain text", () => {
    expect(tokenizeVariables("hello", empty)).toEqual([{ type: "text", text: "hello" }])
  })

  it("returns empty array for empty string", () => {
    expect(tokenizeVariables("", empty)).toEqual([])
  })

  it("returns a single unresolved var token", () => {
    const result = tokenizeVariables("{{foo}}", empty)
    expect(result).toEqual([{ type: "var", name: "foo", resolved: false, text: "{{foo}}" }])
  })

  it("returns a resolved var token when key is in resolvedMap", () => {
    const map = new Map([["foo", "bar"]])
    const result = tokenizeVariables("{{foo}}", map)
    expect(result).toEqual([{ type: "var", name: "foo", resolved: true, text: "{{foo}}" }])
  })

  it("splits text and var tokens correctly", () => {
    const result = tokenizeVariables("https://{{host}}/api", empty)
    expect(result).toEqual([
      { type: "text", text: "https://" },
      { type: "var", name: "host", resolved: false, text: "{{host}}" },
      { type: "text", text: "/api" },
    ])
  })

  it("handles multiple variables in the same string", () => {
    const map = new Map([["a", "1"]])
    const result = tokenizeVariables("{{a}}-{{b}}", map)
    expect(result).toEqual([
      { type: "var", name: "a", resolved: true, text: "{{a}}" },
      { type: "text", text: "-" },
      { type: "var", name: "b", resolved: false, text: "{{b}}" },
    ])
  })

  it("handles adjacent variables with no separator", () => {
    const result = tokenizeVariables("{{a}}{{b}}", empty)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ type: "var", name: "a" })
    expect(result[1]).toMatchObject({ type: "var", name: "b" })
  })

  it("returns plain text token when {{ has no closing }}", () => {
    const result = tokenizeVariables("{{unclosed", empty)
    expect(result).toEqual([{ type: "text", text: "{{unclosed" }])
  })
})

// ---------------------------------------------------------------------------
// VariableInput component
// ---------------------------------------------------------------------------

function renderInput(
  value: string,
  onChange = (_v: string) => {},
  props: Partial<React.ComponentProps<typeof VariableInput>> = {},
) {
  return render(
    <TooltipProvider>
      <VariableInput value={value} onChange={onChange} {...props} />
    </TooltipProvider>,
  )
}

describe("VariableInput — rendering", () => {
  it("renders the input with the given value", () => {
    renderInput("hello")
    expect(screen.getByRole("textbox")).toHaveValue("hello")
  })

  it("renders placeholder text", () => {
    renderInput("", undefined, { placeholder: "Enter URL" })
    expect(screen.getByPlaceholderText("Enter URL")).toBeInTheDocument()
  })

  it("does not show autocomplete dropdown when no suggestions", async () => {
    const user = userEvent.setup()
    renderInput("")
    await user.type(screen.getByRole("textbox"), "{{")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("VariableInput — autocomplete dropdown", () => {
  it("shows dropdown items when value matches suggestions", async () => {
    const user = userEvent.setup()
    let val = "{{base"
    const { rerender } = render(
      <TooltipProvider>
        <VariableInput
          value={val}
          onChange={(v) => {
            val = v
          }}
          suggestions={["baseUrl", "token"]}
        />
      </TooltipProvider>,
    )

    const input = screen.getByRole("textbox")
    await user.click(input)
    // Simulate typing a character to trigger dropdown update via handleChange
    await user.keyboard("U")
    rerender(
      <TooltipProvider>
        <VariableInput
          value="{{baseU"
          onChange={(v) => (val = v)}
          suggestions={["baseUrl", "token"]}
        />
      </TooltipProvider>,
    )

    // The dropdown should show "baseUrl" as a match
    expect(screen.queryByText("baseUrl")).toBeInTheDocument()
  })
})

describe("VariableInput — cell mode", () => {
  it("renders without border/bg container class when cell=true", () => {
    const { container } = renderInput("", undefined, { cell: true })
    expect(container.querySelector(".rounded-md")).not.toBeInTheDocument()
  })

  it("renders with border/bg container class when cell=false", () => {
    const { container } = renderInput("")
    expect(container.querySelector(".rounded-md")).toBeInTheDocument()
  })
})
