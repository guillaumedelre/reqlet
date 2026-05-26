import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeContext } from "@/hooks/use-theme"
import { useEnvironmentsStore } from "@/store/environments"
import { StatusBar } from "./status-bar"

function renderWithTheme(theme = "system" as "light" | "dark" | "system", setTheme = vi.fn()) {
  return render(
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <StatusBar />
    </ThemeContext.Provider>,
  )
}

beforeEach(() => {
  useEnvironmentsStore.setState({ environments: [], globals: [], activeEnvironmentId: null })
})

describe("StatusBar", () => {
  it("shows No environment when no env is active", () => {
    renderWithTheme()
    expect(screen.getByText("No environment")).toBeInTheDocument()
  })

  it("shows active environment name when one is selected", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Staging")
    useEnvironmentsStore.getState().setActiveEnvironment(id)
    renderWithTheme()
    expect(screen.getByText("Staging")).toBeInTheDocument()
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
    expect(screen.getByText("System")).toBeInTheDocument()
  })

  it("calls setTheme when a theme option is selected", () => {
    const setTheme = vi.fn()
    renderWithTheme("dark", setTheme)
    fireEvent.click(screen.getByText("Dark"))
    fireEvent.click(screen.getAllByText("Light")[0])
    expect(setTheme).toHaveBeenCalledWith("light")
  })

  it("opens env dropdown and shows environments", () => {
    useEnvironmentsStore.getState().addEnvironment("Production")
    renderWithTheme()
    fireEvent.click(screen.getByText("No environment"))
    expect(screen.getByText("Production")).toBeInTheDocument()
    expect(screen.getByText("Manage environments...")).toBeInTheDocument()
  })

  it("switches active environment from dropdown", () => {
    const id = useEnvironmentsStore.getState().addEnvironment("Dev")
    renderWithTheme()
    fireEvent.click(screen.getByText("No environment"))
    fireEvent.click(screen.getByText("Dev"))
    expect(useEnvironmentsStore.getState().activeEnvironmentId).toBe(id)
  })

  it("opens environment editor modal on manage click", () => {
    renderWithTheme()
    fireEvent.click(screen.getByText("No environment"))
    fireEvent.click(screen.getByText("Manage environments..."))
    expect(screen.getByText("Environments")).toBeInTheDocument()
  })

  it("closes environment editor via close button", () => {
    renderWithTheme()
    fireEvent.click(screen.getByText("No environment"))
    fireEvent.click(screen.getByText("Manage environments..."))
    expect(screen.getByText("Global Variables")).toBeInTheDocument()
    const closeBtn = screen.getAllByRole("button").find((b) => b.textContent === "×")!
    fireEvent.click(closeBtn)
    expect(screen.queryByText("Global Variables")).not.toBeInTheDocument()
  })
})
