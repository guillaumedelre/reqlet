import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useTabsStore, type Tab } from "@/store/tabs"
import { RequestPane } from "./request-pane"

function makeTab(): Tab {
  return {
    id: crypto.randomUUID(),
    method: "GET",
    url: "",
    params: [],
    headers: [],
    pathVars: [],
    bodyType: "none",
    bodyRaw: "",
    bodyRawContentType: "JSON",
    bodyFormData: [],
    bodyUrlencoded: [],
    response: null,
    dirty: false,
    activeSubTab: "Params",
  }
}

beforeEach(() => {
  const tab = makeTab()
  useTabsStore.setState({ tabs: [tab], activeTabId: tab.id, closedTabHistory: [] })
})

function goToSubTab(name: string) {
  fireEvent.click(screen.getByRole("button", { name }))
}

describe("RequestPane — bulk edit state preservation across sub-tabs", () => {
  it("Params starts in key-value mode", () => {
    render(<RequestPane />)
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/key: value/)).not.toBeInTheDocument()
  })

  it("preserves Params bulk mode when switching to Headers and back", () => {
    render(<RequestPane />)

    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()

    goToSubTab("Headers")
    // Headers should be in key-value mode independently
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()

    goToSubTab("Params")
    // Params should still be in bulk mode
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()
  })

  it("preserves Headers bulk mode when switching to Params and back", () => {
    render(<RequestPane />)

    goToSubTab("Headers")
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()

    goToSubTab("Params")
    // Params should be in key-value mode independently
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()

    goToSubTab("Headers")
    // Headers should still be in bulk mode
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()
  })

  it("maintains independent modes: Params=bulk and Headers=key-value simultaneously", () => {
    render(<RequestPane />)

    // Set Params to bulk
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))

    // Headers is in key-value mode
    goToSubTab("Headers")
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()

    // Enable bulk on Headers too
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))

    // Go back to Params: still bulk
    goToSubTab("Params")
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()

    // Go to Headers: still bulk
    goToSubTab("Headers")
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()
  })

  it("resets all bulk modes when switching to a different tab", () => {
    render(<RequestPane />)

    // Set Params to bulk mode
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()

    // Open and activate a new tab
    act(() => {
      useTabsStore.getState().openTab()
    })

    // New tab's Params should be in key-value mode
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()
  })

  it("does not bleed bulk state from Body form-data to urlencoded", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "form-data" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)

    goToSubTab("Body")
    // Enable bulk on form-data
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()

    // Switch to urlencoded
    fireEvent.click(screen.getByRole("button", { name: "x-www-form-urlencoded" }))
    // urlencoded should be in key-value mode
    expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeInTheDocument()

    // Switch back to form-data
    fireEvent.click(screen.getByRole("button", { name: "form-data" }))
    // form-data should still be in bulk mode
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()
  })
})
