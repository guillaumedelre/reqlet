import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ThemeContext } from "@/hooks/use-theme"
import { StatusBar } from "./status-bar"

function renderWithTheme(theme = "system" as "light" | "dark" | "system", setTheme = vi.fn()) {
  return render(
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <StatusBar />
    </ThemeContext.Provider>,
  )
}

describe("StatusBar", () => {
  it("shows No environment label", () => {
    renderWithTheme()
    expect(screen.getByText("No environment")).toBeInTheDocument()
  })

  it("shows version string", () => {
    renderWithTheme()
    expect(screen.getByText(/Reqlet v0\.1\.0/)).toBeInTheDocument()
  })

  it("shows current theme label in selector button", () => {
    renderWithTheme("light")
    expect(screen.getByText("Light")).toBeInTheDocument()
  })

  it("opens theme dropdown on button click", () => {
    renderWithTheme("dark")
    fireEvent.click(screen.getByText("Dark"))
    expect(screen.getByText("Light")).toBeInTheDocument()
    expect(screen.getByText("System")).toBeInTheDocument()
  })

  it("calls setTheme when a theme option is selected", () => {
    const setTheme = vi.fn()
    renderWithTheme("dark", setTheme)
    fireEvent.click(screen.getByText("Dark"))
    fireEvent.click(screen.getAllByText("Light")[0])
    expect(setTheme).toHaveBeenCalledWith("light")
  })

  it("closes dropdown after selecting a theme", () => {
    renderWithTheme("system")
    fireEvent.click(screen.getByText("System"))
    fireEvent.click(screen.getAllByText("Light")[0])
    expect(screen.queryByText("Dark")).not.toBeInTheDocument()
  })
})
