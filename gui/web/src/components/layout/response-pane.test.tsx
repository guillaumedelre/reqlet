import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value: string }) => (
    <textarea data-testid="monaco-editor" defaultValue={value} readOnly />
  ),
}))

import { guessExt } from "@/lib/response"
import { useTabsStore, type HttpTimings, type ResponseData } from "@/store/tabs"
import { ResponsePane } from "./response-pane"

const makeResponse = (patch: Partial<ResponseData> = {}): ResponseData => ({
  status: 200,
  statusText: "OK",
  time: 142,
  size: 512,
  headers: { "content-type": "application/json" },
  body: '{"hello":"world"}',
  contentType: "application/json",
  ...patch,
})

beforeEach(() => {
  const tab = {
    id: "t1",
    method: "GET" as const,
    url: "https://api.example.com/data",
    params: [],
    headers: [],
    pathVars: [],
    bodyType: "none" as const,
    bodyRaw: "",
    bodyRawContentType: "JSON" as const,
    bodyFormData: [],
    bodyUrlencoded: [],
    response: null,
    dirty: false,
    activeSubTab: "Params" as const,
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
    httpVersion: "http1" as const,
    timeout: 0,
    ignoreProxy: false,
  }
  useTabsStore.setState({ tabs: [tab], activeTabId: tab.id, closedTabHistory: [] })
})

function setResponse(patch: Partial<ResponseData> = {}) {
  const state = useTabsStore.getState()
  const tab = state.tabs[0]
  useTabsStore.setState({
    tabs: [{ ...tab, response: makeResponse(patch) }],
    activeTabId: tab.id,
    closedTabHistory: [],
  })
}

describe("ResponsePane — empty state", () => {
  it("shows 'Hit Send' when there is no response", () => {
    render(<ResponsePane />)
    expect(screen.getByText(/Hit/)).toBeInTheDocument()
    expect(screen.getByText("Send")).toBeInTheDocument()
  })
})

describe("ResponsePane — status bar", () => {
  it("shows status code, status text, time and size", () => {
    setResponse({ status: 201, statusText: "Created", time: 88, size: 256 })
    render(<ResponsePane />)
    expect(screen.getByText("201")).toBeInTheDocument()
    expect(screen.getByText("Created")).toBeInTheDocument()
    expect(screen.getByText("88 ms")).toBeInTheDocument()
    expect(screen.getByText("256 B")).toBeInTheDocument()
  })

  it("renders a 3xx redirect status without crashing", () => {
    setResponse({ status: 301, statusText: "Moved Permanently" })
    render(<ResponsePane />)
    expect(screen.getByText("301")).toBeInTheDocument()
  })

  it("renders a 4xx client error status without crashing", () => {
    setResponse({ status: 404, statusText: "Not Found" })
    render(<ResponsePane />)
    expect(screen.getByText("404")).toBeInTheDocument()
  })

  it("renders a 5xx server error status without crashing", () => {
    setResponse({ status: 500, statusText: "Internal Server Error" })
    render(<ResponsePane />)
    expect(screen.getByText("500")).toBeInTheDocument()
  })

  it("formats size in KB when >= 1000 bytes", () => {
    setResponse({ size: 2048 })
    render(<ResponsePane />)
    expect(screen.getByText("2.05 KB")).toBeInTheDocument()
  })

  it("formats size in MB when >= 1 000 000 bytes", () => {
    setResponse({ size: 1_500_000 })
    render(<ResponsePane />)
    expect(screen.getByText("1.50 MB")).toBeInTheDocument()
  })
})

describe("ResponsePane — sub-tabs", () => {
  it("renders all five sub-tab buttons", () => {
    setResponse()
    render(<ResponsePane />)
    expect(screen.getByRole("button", { name: "Pretty" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Raw" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Headers" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Visualize" })).toBeInTheDocument()
  })

  it("defaults to Pretty tab", () => {
    setResponse()
    render(<ResponsePane />)
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument()
  })

  it("Raw tab shows pre-formatted body", () => {
    setResponse({ body: "plain text body", contentType: "text/plain" })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Raw" }))
    expect(screen.getByText("plain text body")).toBeInTheDocument()
  })

  it("Raw tab shows empty message when body is empty", () => {
    setResponse({ body: "" })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Raw" }))
    expect(screen.getByText("Empty response body.")).toBeInTheDocument()
  })

  it("Headers tab shows response headers", () => {
    setResponse({ headers: { "x-request-id": "abc-123", "content-type": "application/json" } })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Headers" }))
    expect(screen.getByText("x-request-id")).toBeInTheDocument()
    expect(screen.getByText("abc-123")).toBeInTheDocument()
  })

  it("Headers tab shows empty message when there are no headers", () => {
    setResponse({ headers: {} })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Headers" }))
    expect(screen.getByText("No response headers.")).toBeInTheDocument()
  })
})

describe("ResponsePane — Pretty tab", () => {
  it("pretty-prints JSON body", () => {
    setResponse({ body: '{"a":1}', contentType: "application/json" })
    render(<ResponsePane />)
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.defaultValue).toBe('{\n  "a": 1\n}')
  })

  it("shows raw body when JSON parsing fails", () => {
    setResponse({ body: "not json", contentType: "application/json" })
    render(<ResponsePane />)
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.defaultValue).toBe("not json")
  })

  it("shows raw body for non-JSON content types", () => {
    setResponse({ body: "<p>hello</p>", contentType: "text/html" })
    render(<ResponsePane />)
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.defaultValue).toBe("<p>hello</p>")
  })

  it("shows empty message when body is empty", () => {
    setResponse({ body: "", contentType: "application/json" })
    render(<ResponsePane />)
    expect(screen.getByText("Empty response body.")).toBeInTheDocument()
  })
})

describe("ResponsePane — Preview tab", () => {
  it("shows a sandboxed iframe with the response body as srcDoc", () => {
    setResponse({ body: "<h1>Hello</h1>", contentType: "text/html" })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    const iframe = document.querySelector("iframe")
    expect(iframe).toBeInTheDocument()
    expect(iframe?.getAttribute("sandbox")).toBe("")
    expect(iframe?.getAttribute("srcdoc")).toBe("<h1>Hello</h1>")
  })

  it("shows empty message when body is empty", () => {
    setResponse({ body: "", contentType: "text/html" })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(document.querySelector("iframe")).not.toBeInTheDocument()
    expect(screen.getByText("Empty response body.")).toBeInTheDocument()
  })

  it("renders iframe for non-HTML content too (developer can inspect any response)", () => {
    setResponse({ body: '{"a":1}', contentType: "application/json" })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(document.querySelector("iframe")).toBeInTheDocument()
  })
})

describe("ResponsePane — Visualize tab", () => {
  it("shows the pm.visualizer.set placeholder message", () => {
    setResponse()
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }))
    expect(screen.getByText(/pm\.visualizer\.set/)).toBeInTheDocument()
  })
})

describe("ResponsePane — timing popover", () => {
  it("does not show popover on hover when timings are absent", () => {
    setResponse({ time: 50 })
    render(<ResponsePane />)
    fireEvent.mouseEnter(screen.getByText("50 ms"))
    expect(screen.queryByText("DNS Lookup")).not.toBeInTheDocument()
  })

  it("shows all waterfall phases on hover when timings are present", () => {
    const timings: HttpTimings = { dns: 3, tcp: 6, tls: 12, ttfb: 29, download: 0 }
    setResponse({ time: 50, timings })
    render(<ResponsePane />)
    fireEvent.mouseEnter(screen.getByText("50 ms"))
    expect(screen.getByText("DNS Lookup")).toBeInTheDocument()
    expect(screen.getByText("TCP Handshake")).toBeInTheDocument()
    expect(screen.getByText("TLS Handshake")).toBeInTheDocument()
    expect(screen.getByText(/TTFB/)).toBeInTheDocument()
    expect(screen.getByText("Download")).toBeInTheDocument()
  })

  it("shows phase durations formatted to 2 decimal places", () => {
    const timings: HttpTimings = { dns: 3, tcp: 6, tls: 12, ttfb: 29, download: 0 }
    setResponse({ time: 50, timings })
    render(<ResponsePane />)
    fireEvent.mouseEnter(screen.getByText("50 ms"))
    expect(screen.getByText("3.00 ms")).toBeInTheDocument()
    expect(screen.getByText("6.00 ms")).toBeInTheDocument()
    expect(screen.getByText("12.00 ms")).toBeInTheDocument()
    expect(screen.getByText("29.00 ms")).toBeInTheDocument()
  })

  it("shows the correct total in the popover", () => {
    const timings: HttpTimings = { dns: 3, tcp: 6, tls: 12, ttfb: 29, download: 0 }
    setResponse({ time: 50, timings })
    render(<ResponsePane />)
    fireEvent.mouseEnter(screen.getByText("50 ms"))
    expect(screen.getByText("50.00 ms")).toBeInTheDocument()
  })

  it("hides the popover on mouse leave", () => {
    const timings: HttpTimings = { dns: 3, tcp: 6, tls: 12, ttfb: 29, download: 0 }
    setResponse({ time: 50, timings })
    render(<ResponsePane />)
    const timeEl = screen.getByText("50 ms")
    fireEvent.mouseEnter(timeEl)
    expect(screen.getByText("DNS Lookup")).toBeInTheDocument()
    fireEvent.mouseLeave(timeEl)
    expect(screen.queryByText("DNS Lookup")).not.toBeInTheDocument()
  })
})

describe("ResponsePane — Copy button", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  it("Copy button is present in the status bar", () => {
    setResponse()
    render(<ResponsePane />)
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
  })

  it("clicking Copy writes the response body to clipboard", async () => {
    setResponse({ body: '{"x":1}', contentType: "application/json" })
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    await Promise.resolve()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"x":1}')
  })
})

describe("ResponsePane — Word wrap toggle", () => {
  it("shows Wrap toggle button on Pretty tab", () => {
    setResponse()
    render(<ResponsePane />)
    expect(
      screen.getByRole("button", { name: /disable word wrap|enable word wrap/i }),
    ).toBeInTheDocument()
  })

  it("hides Wrap toggle on non-Pretty tabs", () => {
    setResponse()
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Raw" }))
    expect(
      screen.queryByRole("button", { name: /disable word wrap|enable word wrap/i }),
    ).not.toBeInTheDocument()
  })

  it("toggling Wrap changes its title", () => {
    setResponse()
    render(<ResponsePane />)
    const btn = screen.getByRole("button", { name: "Disable word wrap" })
    fireEvent.click(btn)
    expect(screen.getByRole("button", { name: "Enable word wrap" })).toBeInTheDocument()
  })
})

describe("ResponsePane — Search button", () => {
  it("shows Search button on Pretty tab", () => {
    setResponse()
    render(<ResponsePane />)
    expect(screen.getByRole("button", { name: "Search in response (Ctrl+F)" })).toBeInTheDocument()
  })

  it("hides Search button on non-Pretty tabs", () => {
    setResponse()
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Raw" }))
    expect(
      screen.queryByRole("button", { name: "Search in response (Ctrl+F)" }),
    ).not.toBeInTheDocument()
  })

  it("clicking Search does not throw when editor is not mounted", () => {
    setResponse()
    render(<ResponsePane />)
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Search in response (Ctrl+F)" })),
    ).not.toThrow()
  })
})

describe("ResponsePane — Save (download)", () => {
  it("Save button is enabled when a response is present", () => {
    setResponse()
    render(<ResponsePane />)
    const btn = screen.getByRole("button", { name: "Save" })
    expect(btn).not.toBeDisabled()
  })

  it("clicking Save triggers a Blob download and cleans up the object URL", () => {
    setResponse({ body: '{"x":1}', contentType: "application/json" })
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url")
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, writable: true })
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, writable: true })
    const mockAnchor = { href: "", download: "", click: vi.fn() }
    const original = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string, ...args: unknown[]) => {
      if (tag === "a") return mockAnchor as unknown as HTMLElement
      return original(tag, ...(args as [ElementCreationOptions?]))
    })

    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(mockAnchor.download).toBe("response.json")
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
  })
})

describe("guessExt", () => {
  it.each([
    ["application/json", "json"],
    ["application/xml", "xml"],
    ["text/html", "html"],
    ["text/css", "css"],
    ["application/javascript", "js"],
    ["text/csv", "csv"],
    ["text/plain", "txt"],
    ["", "txt"],
  ])("guessExt(%s) === %s", (ct, expected) => {
    expect(guessExt(ct)).toBe(expected)
  })
})

describe("ResponsePane — layout", () => {
  it("root element has height 100% in empty state to fill the resizable panel", () => {
    const { container } = render(<ResponsePane />)
    expect(container.firstChild).toHaveStyle({ height: "100%" })
  })

  it("root element has height 100% when a response is present", () => {
    setResponse()
    const { container } = render(<ResponsePane />)
    expect(container.firstChild).toHaveStyle({ height: "100%" })
  })
})

describe("ResponsePane — status bar (additional)", () => {
  it("renders a 1xx informational status without crashing", () => {
    setResponse({ status: 100, statusText: "Continue" })
    render(<ResponsePane />)
    expect(screen.getByText("100")).toBeInTheDocument()
  })

  it("formats size as B when exactly 999 bytes (boundary below KB)", () => {
    setResponse({ size: 999 })
    render(<ResponsePane />)
    expect(screen.getByText("999 B")).toBeInTheDocument()
  })

  it("formats size as KB at the exact 1 000-byte boundary", () => {
    setResponse({ size: 1000 })
    render(<ResponsePane />)
    expect(screen.getByText("1.00 KB")).toBeInTheDocument()
  })

  it("formats size as MB at the exact 1 000 000-byte boundary", () => {
    setResponse({ size: 1_000_000 })
    render(<ResponsePane />)
    expect(screen.getByText("1.00 MB")).toBeInTheDocument()
  })
})

describe("ResponsePane — Pretty tab (additional)", () => {
  it("pretty-prints application/ld+json (a +json media type variant)", () => {
    setResponse({ body: '{"@context":"https://schema.org"}', contentType: "application/ld+json" })
    render(<ResponsePane />)
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.defaultValue).toBe('{\n  "@context": "https://schema.org"\n}')
  })

  it("pretty-prints application/vnd.api+json (another +json variant)", () => {
    setResponse({ body: '{"data":null}', contentType: "application/vnd.api+json" })
    render(<ResponsePane />)
    const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement
    expect(editor.defaultValue).toBe('{\n  "data": null\n}')
  })
})

describe("ResponsePane — timing popover (additional)", () => {
  it("shows placeholder text referencing Bloc C on hover when timings are absent", () => {
    setResponse({ time: 50 })
    render(<ResponsePane />)
    fireEvent.mouseEnter(screen.getByText("50 ms"))
    expect(screen.getByText(/Bloc C/)).toBeInTheDocument()
  })

  it("popover shows 0.00 ms for every phase when all durations are zero", () => {
    const timings: HttpTimings = { dns: 0, tcp: 0, tls: 0, ttfb: 0, download: 0 }
    setResponse({ time: 0, timings })
    render(<ResponsePane />)
    fireEvent.mouseEnter(screen.getByText("0 ms"))
    const zeros = screen.getAllByText("0.00 ms")
    expect(zeros.length).toBeGreaterThanOrEqual(6)
  })
})

describe("ResponsePane — Copy button (additional)", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  it("shows 'Copied!' feedback immediately after click", async () => {
    setResponse()
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
  })

  it("reverts back to 'Copy' after 1500 ms", async () => {
    vi.useFakeTimers()
    setResponse()
    render(<ResponsePane />)
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
    vi.useRealTimers()
  })
})
