import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

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
    preRequestScript: "",
    testScript: "",
    followRedirects: true,
    followOriginalMethod: false,
    followAuthorizationHeader: false,
    removeRefererOnRedirect: false,
    maxRedirects: 0,
    sslVerification: true,
    encodeUrl: true,
    disableCookieJar: false,
    httpVersion: "http1",
    timeout: 0,
    proxyUrl: "",
    proxyUsername: "",
    proxyPassword: "",
  }
}

beforeEach(() => {
  const tab = makeTab()
  useTabsStore.setState({ tabs: [tab], activeTabId: tab.id, closedTabHistory: [] })
})

function goToSubTab(name: string) {
  fireEvent.click(screen.getByRole("button", { name }))
}

describe("RequestPane — URL bar", () => {
  it("typing in the URL input updates the store", () => {
    render(<RequestPane />)
    fireEvent.change(screen.getByPlaceholderText("Enter URL"), {
      target: { value: "https://api.example.com/users" },
    })
    expect(useTabsStore.getState().tabs[0].url).toBe("https://api.example.com/users")
  })

  it("parses query params from a pasted URL into the params table", () => {
    render(<RequestPane />)
    fireEvent.change(screen.getByPlaceholderText("Enter URL"), {
      target: { value: "https://api.example.com?page=1&limit=10" },
    })
    const params = useTabsStore.getState().tabs[0].params
    expect(params.some((p) => p.key === "page" && p.value === "1")).toBe(true)
    expect(params.some((p) => p.key === "limit" && p.value === "10")).toBe(true)
  })

  it("changes the HTTP method via the dropdown", () => {
    render(<RequestPane />)
    fireEvent.click(screen.getByRole("button", { name: /^GET/ }))
    fireEvent.click(screen.getByRole("button", { name: "POST" }))
    expect(useTabsStore.getState().tabs[0].method).toBe("POST")
  })
})

describe("RequestPane — Body tab", () => {
  it("shows 'no body' message for bodyType none", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    expect(screen.getByText("This request has no body.")).toBeInTheDocument()
  })

  it("switching body type to raw shows Monaco editor", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "raw" }))
    expect(useTabsStore.getState().tabs[0].bodyType).toBe("raw")
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument()
  })

  it("typing in raw body Monaco editor updates the store", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "raw" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.change(screen.getByTestId("monaco-editor"), {
      target: { value: '{"key":"value"}' },
    })
    expect(useTabsStore.getState().tabs[0].bodyRaw).toBe('{"key":"value"}')
  })

  it("switching raw content type updates the store", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "raw", bodyRawContentType: "JSON" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "XML" }))
    expect(useTabsStore.getState().tabs[0].bodyRawContentType).toBe("XML")
  })

  it("switching body type to form-data shows key-value editor", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "form-data" }))
    expect(useTabsStore.getState().tabs[0].bodyType).toBe("form-data")
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument()
  })

  it("switching body type to urlencoded shows key-value editor", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "x-www-form-urlencoded" }))
    expect(useTabsStore.getState().tabs[0].bodyType).toBe("urlencoded")
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument()
  })
})

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
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.value).toMatch(/curl -X GET/)
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
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.value).toMatch(/import requests/)
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
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.value).toMatch(/package main/)
  })
})

describe("RequestPane — Settings tab", () => {
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
    // timeout is the second "0"-valued input; maxRedirects is the first
    fireEvent.change(screen.getAllByDisplayValue("0")[1], { target: { value: "3000" } })
    expect(useTabsStore.getState().tabs[0].timeout).toBe(3000)
  })

  it("timeout input ignores non-numeric characters", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.change(screen.getAllByDisplayValue("0")[1], { target: { value: "abc" } })
    expect(useTabsStore.getState().tabs[0].timeout).toBe(0)
  })

  it("shows all three setting controls", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    expect(screen.getByText("Follow Redirects")).toBeInTheDocument()
    expect(screen.getByText("SSL Certificate Verification")).toBeInTheDocument()
    expect(screen.getByText("Request Timeout")).toBeInTheDocument()
  })

  it("shows HTTP version buttons", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "HTTP/1.x" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "HTTP/2" })).toBeInTheDocument()
  })

  it("clicking HTTP/2 updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByRole("button", { name: "HTTP/2" }))
    expect(useTabsStore.getState().tabs[0].httpVersion).toBe("http2")
  })

  it("clicking Encode URL Automatically row toggles the store value", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("Encode URL Automatically"))
    expect(useTabsStore.getState().tabs[0].encodeUrl).toBe(false)
  })

  it("clicking Follow Original HTTP Method row toggles the store value", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("Follow Original HTTP Method"))
    expect(useTabsStore.getState().tabs[0].followOriginalMethod).toBe(true)
  })

  it("clicking Follow Authorization Header row toggles the store value", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("Follow Authorization Header"))
    expect(useTabsStore.getState().tabs[0].followAuthorizationHeader).toBe(true)
  })

  it("clicking Remove Referer Header on Redirect row toggles the store value", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("Remove Referer Header on Redirect"))
    expect(useTabsStore.getState().tabs[0].removeRefererOnRedirect).toBe(true)
  })

  it("max redirects input updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    // maxRedirects is the first "0"-valued input; timeout is the second
    fireEvent.change(screen.getAllByDisplayValue("0")[0], { target: { value: "5" } })
    expect(useTabsStore.getState().tabs[0].maxRedirects).toBe(5)
  })

  it("clicking Disable Cookie Jar row toggles the store value", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("Disable Cookie Jar"))
    expect(useTabsStore.getState().tabs[0].disableCookieJar).toBe(true)
  })

  it("shows proxy URL, username and password inputs", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    expect(screen.getByPlaceholderText("http://proxy.example.com:8080")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
  })

  it("typing proxy URL updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.change(screen.getByPlaceholderText("http://proxy.example.com:8080"), {
      target: { value: "http://proxy.corp.com:3128" },
    })
    expect(useTabsStore.getState().tabs[0].proxyUrl).toBe("http://proxy.corp.com:3128")
  })

  it("typing proxy username updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "admin" },
    })
    expect(useTabsStore.getState().tabs[0].proxyUsername).toBe("admin")
  })

  it("typing proxy password updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "s3cr3t" },
    })
    expect(useTabsStore.getState().tabs[0].proxyPassword).toBe("s3cr3t")
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
