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
    ignoreProxy: false,
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

  it("switching body type to binary updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "binary" }))
    expect(useTabsStore.getState().tabs[0].bodyType).toBe("binary")
  })

  it("switching body type to GraphQL updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "GraphQL" }))
    expect(useTabsStore.getState().tabs[0].bodyType).toBe("GraphQL")
  })

  it("enabling bulk mode on urlencoded body is tracked independently", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, bodyType: "urlencoded" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "Bulk Edit" }))
    expect(screen.getByRole("button", { name: "Key-Value Edit" })).toBeInTheDocument()
  })
})

describe("RequestPane — Params tab key-value changes", () => {
  it("adding a param row via + Add updates the store", () => {
    render(<RequestPane />)
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    expect(useTabsStore.getState().tabs[0].params).toHaveLength(1)
  })

  it("typing a param key marks the tab dirty", () => {
    render(<RequestPane />)
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    fireEvent.change(screen.getAllByPlaceholderText("Key")[0], { target: { value: "page" } })
    expect(useTabsStore.getState().tabs[0].params[0].key).toBe("page")
    expect(useTabsStore.getState().tabs[0].dirty).toBe(true)
  })
})

describe("RequestPane — Headers tab key-value changes", () => {
  it("adding a header row via + Add updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Headers")
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    expect(useTabsStore.getState().tabs[0].headers).toHaveLength(1)
  })

  it("typing a header key marks the tab dirty", () => {
    render(<RequestPane />)
    goToSubTab("Headers")
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    fireEvent.change(screen.getAllByPlaceholderText("Key")[0], {
      target: { value: "Authorization" },
    })
    expect(useTabsStore.getState().tabs[0].headers[0].key).toBe("Authorization")
    expect(useTabsStore.getState().tabs[0].dirty).toBe(true)
  })
})

describe("RequestPane — Path variables key-value changes", () => {
  it("changing a path variable value updates the store", () => {
    const tab = makeTab()
    const pathVar = { id: "pv1", key: "id", value: "", enabled: true }
    useTabsStore.setState({
      tabs: [{ ...tab, url: "https://api.example.com/users/:id", pathVars: [pathVar] }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    fireEvent.change(screen.getAllByPlaceholderText("Value")[0], { target: { value: "42" } })
    expect(useTabsStore.getState().tabs[0].pathVars[0].value).toBe("42")
  })
})

describe("RequestPane — Body form-data key-value changes", () => {
  it("adding a form-data row updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "form-data" }))
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    expect(useTabsStore.getState().tabs[0].bodyFormData).toHaveLength(1)
  })

  it("typing a form-data key marks the tab dirty", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "form-data" }))
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    fireEvent.change(screen.getAllByPlaceholderText("Key")[0], { target: { value: "file" } })
    expect(useTabsStore.getState().tabs[0].bodyFormData[0].key).toBe("file")
    expect(useTabsStore.getState().tabs[0].dirty).toBe(true)
  })
})

describe("RequestPane — Body urlencoded key-value changes", () => {
  it("adding a urlencoded row updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "x-www-form-urlencoded" }))
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    expect(useTabsStore.getState().tabs[0].bodyUrlencoded).toHaveLength(1)
  })

  it("typing a urlencoded key marks the tab dirty", () => {
    render(<RequestPane />)
    goToSubTab("Body")
    fireEvent.click(screen.getByRole("button", { name: "x-www-form-urlencoded" }))
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }))
    fireEvent.change(screen.getAllByPlaceholderText("Key")[0], { target: { value: "grant_type" } })
    expect(useTabsStore.getState().tabs[0].bodyUrlencoded[0].key).toBe("grant_type")
    expect(useTabsStore.getState().tabs[0].dirty).toBe(true)
  })
})

describe("RequestPane — Pre-request Script tab", () => {
  it("navigating to Pre-request Script tab shows a Monaco editor", () => {
    render(<RequestPane />)
    goToSubTab("Pre-request Script")
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument()
  })

  it("typing in Pre-request Script editor updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Pre-request Script")
    fireEvent.change(screen.getByTestId("monaco-editor"), {
      target: { value: "pm.environment.set('token', 'abc')" },
    })
    expect(useTabsStore.getState().tabs[0].preRequestScript).toBe(
      "pm.environment.set('token', 'abc')",
    )
  })

  it("pre-populates with existing preRequestScript value", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, preRequestScript: "pm.globals.set('x', 1)" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Pre-request Script")
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.value).toBe("pm.globals.set('x', 1)")
  })
})

describe("RequestPane — Tests tab", () => {
  it("navigating to Tests tab shows a Monaco editor", () => {
    render(<RequestPane />)
    goToSubTab("Tests")
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument()
  })

  it("typing in Tests editor updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Tests")
    fireEvent.change(screen.getByTestId("monaco-editor"), {
      target: { value: "pm.test('ok', () => pm.expect(pm.response.code).to.equal(200))" },
    })
    expect(useTabsStore.getState().tabs[0].testScript).toBe(
      "pm.test('ok', () => pm.expect(pm.response.code).to.equal(200))",
    )
  })

  it("pre-populates with existing testScript value", () => {
    const tab = makeTab()
    useTabsStore.setState({
      tabs: [{ ...tab, testScript: "pm.test('status', () => {})" }],
      activeTabId: tab.id,
      closedTabHistory: [],
    })
    render(<RequestPane />)
    goToSubTab("Tests")
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.value).toBe("pm.test('status', () => {})")
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

  it("HTTP version defaults to HTTP/1.x", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    // HTTP/1.x button should have the accent background (selected state)
    expect(screen.getByRole("button", { name: "HTTP/1.x" })).toBeInTheDocument()
    expect(useTabsStore.getState().tabs[0].httpVersion).toBe("http1")
  })

  it("clicking Auto HTTP version updates the store", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByRole("button", { name: "Auto" }))
    expect(useTabsStore.getState().tabs[0].httpVersion).toBe("auto")
  })

  it("max redirects ignores non-numeric characters", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.change(screen.getAllByDisplayValue("0")[0], { target: { value: "abc" } })
    expect(useTabsStore.getState().tabs[0].maxRedirects).toBe(0)
  })

  it("shows Ignore Proxy Settings toggle", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    expect(screen.getByText("Ignore Proxy Settings")).toBeInTheDocument()
  })

  it("clicking Ignore Proxy Settings row toggles the store value", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    fireEvent.click(screen.getByText("Ignore Proxy Settings"))
    expect(useTabsStore.getState().tabs[0].ignoreProxy).toBe(true)
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

describe("RequestPane — method selector click-outside", () => {
  it("closes the dropdown when clicking outside", () => {
    render(<RequestPane />)
    fireEvent.click(screen.getByRole("button", { name: /^GET/ }))
    expect(screen.getByRole("button", { name: "POST" })).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole("button", { name: "POST" })).not.toBeInTheDocument()
  })
})

describe("RequestPane — Code tab", () => {
  it("Copy button calls clipboard.writeText with generated code", () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true })
    render(<RequestPane />)
    goToSubTab("Code")
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    expect(writeText).toHaveBeenCalled()
  })
})

describe("RequestPane — Settings hover", () => {
  it("hovering over each settings row fires enter and leave handlers without crashing", () => {
    render(<RequestPane />)
    goToSubTab("Settings")
    const labels = [
      "Encode URL Automatically",
      "Follow Redirects",
      "Follow Original HTTP Method",
      "Follow Authorization Header",
      "Remove Referer Header on Redirect",
      "SSL Certificate Verification",
      "Disable Cookie Jar",
      "Ignore Proxy Settings",
    ]
    for (const label of labels) {
      const row = screen.getByText(label).closest("div")!.parentElement!.parentElement!
      fireEvent.mouseEnter(row)
      fireEvent.mouseLeave(row)
    }
    expect(screen.getByText("Encode URL Automatically")).toBeInTheDocument()
  })
})

describe("RequestPane — no active tab", () => {
  it("renders empty state when there is no active tab", () => {
    useTabsStore.setState({ tabs: [], activeTabId: null, closedTabHistory: [] })
    render(<RequestPane />)
    expect(screen.getByText("No tab open.")).toBeInTheDocument()
  })
})

describe("RequestPane — Auth tab placeholder", () => {
  it("shows coming soon message for the Auth sub-tab", () => {
    render(<RequestPane />)
    goToSubTab("Auth")
    expect(screen.getByText("Auth — coming soon.")).toBeInTheDocument()
  })
})
