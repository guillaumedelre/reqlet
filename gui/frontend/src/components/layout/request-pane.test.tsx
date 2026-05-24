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
    followRedirects: true,
    sslVerification: true,
    timeout: 0,
  }
}

beforeEach(() => {
  const tab = makeTab()
  useTabsStore.setState({ tabs: [tab], activeTabId: tab.id, closedTabHistory: [] })
})

function goToSubTab(name: string) {
  fireEvent.click(screen.getByRole("button", { name }))
}

describe("RequestPane — Code tab", () => {
  it("Code tab is present in the sub-tab bar", () => {
    render(<RequestPane />)
    expect(screen.getByRole("button", { name: "Code" })).toBeInTheDocument()
  })

  it("navigating to Code tab shows language buttons and Copy", () => {
    render(<RequestPane />)
    goToSubTab("Code")
    expect(screen.getByRole("button", { name: "cURL" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Python" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "JavaScript" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
  })

  it("shows cURL snippet by default", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, url: "https://api.example.com" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Code")
    expect(screen.getByText(/curl -X GET/)).toBeInTheDocument()
  })

  it("switching to Python updates the snippet", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, url: "https://api.example.com" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Code")
    fireEvent.click(screen.getByRole("button", { name: "Python" }))
    expect(screen.getByText(/import requests/)).toBeInTheDocument()
  })

  it("switching to Go updates the snippet", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, url: "https://api.example.com" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Code")
    fireEvent.click(screen.getByRole("button", { name: "Go" }))
    expect(screen.getByText(/package main/)).toBeInTheDocument()
  })
})

describe("RequestPane — auto-generated headers", () => {
  it("shows Content-Type for raw JSON body", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "raw", bodyRawContentType: "JSON" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Headers")
    expect(screen.getByText("Content-Type")).toBeInTheDocument()
    expect(screen.getByText("application/json")).toBeInTheDocument()
  })

  it("shows application/xml for raw XML body", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "raw", bodyRawContentType: "XML" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Headers")
    expect(screen.getByText("application/xml")).toBeInTheDocument()
  })

  it("shows urlencoded Content-Type for urlencoded body", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "urlencoded" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Headers")
    expect(screen.getByText("application/x-www-form-urlencoded")).toBeInTheDocument()
  })

  it("shows multipart/form-data Content-Type for form-data body", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "form-data" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Headers")
    expect(screen.getByText(/multipart\/form-data/)).toBeInTheDocument()
  })

  it("shows no auto-generated section for bodyType none", () => {
    render(<RequestPane />)
    goToSubTab("Headers")
    expect(screen.queryByText("Auto-generated")).not.toBeInTheDocument()
    expect(screen.queryByText("Content-Type")).not.toBeInTheDocument()
  })

  it("shows no auto-generated section for bodyType binary", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "binary" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Headers")
    expect(screen.queryByText("Auto-generated")).not.toBeInTheDocument()
  })
})

describe("RequestPane — Settings tab", () => {
  it("shows all three setting controls", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    expect(screen.getByText("Follow Redirects")).toBeInTheDocument()
    expect(screen.getByText("SSL Certificate Verification")).toBeInTheDocument()
    expect(screen.getByText("Request Timeout")).toBeInTheDocument()
  })

  it("clicking Follow Redirects row toggles the store value", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, followRedirects: true }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("Follow Redirects"))
    expect(useTabsStore.getState().tabs[0].followRedirects).toBe(false)
  })

  it("clicking SSL Verification row toggles the store value", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, sslVerification: true }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("SSL Certificate Verification"))
    expect(useTabsStore.getState().tabs[0].sslVerification).toBe(false)
  })

  it("timeout input filters non-numeric characters and updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    const input = screen.getByDisplayValue("0")
    fireEvent.change(input, { target: { value: "3000" } })
    expect(useTabsStore.getState().tabs[0].timeout).toBe(3000)
  })

  it("timeout input ignores non-numeric characters", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    const input = screen.getByDisplayValue("0")
    fireEvent.change(input, { target: { value: "abc" } })
    expect(useTabsStore.getState().tabs[0].timeout).toBe(0)
  })
})

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
