import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SettingsDialog } from "./settings-dialog"
import { useUiStore } from "@/store/ui"
import { useSettingsStore } from "@/store/settings"
import * as backend from "@/lib/backend"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/backend", () => ({
  getSettings: vi.fn(),
  putSettings: vi.fn(),
  BackendError: class BackendError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
      this.name = "BackendError"
    }
  },
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_BACKEND: backend.AppSettings = {
  proxyUrl: "",
  proxyUsername: "",
  proxyPassword: "",
  noProxy: "",
  sslVerification: true,
  useSystemProxy: false,
  respectEnvProxy: false,
  maxResponseSizeMB: 50,
  scriptTimeoutMs: 5000,
}

function openDialog() {
  act(() => {
    useUiStore.setState((s) => ({ ...s, settingsOpen: true }))
  })
}

function closeDialog() {
  act(() => {
    useUiStore.setState((s) => ({ ...s, settingsOpen: false }))
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(backend.getSettings).mockResolvedValue({ ...DEFAULT_BACKEND })
  vi.mocked(backend.putSettings).mockResolvedValue({ ...DEFAULT_BACKEND })
  useUiStore.setState((s) => ({ ...s, settingsOpen: false }))
  useSettingsStore.getState().reset()
  localStorage.clear()
  // Radix pointer capture — not implemented in jsdom
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  closeDialog()
})

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe("loading", () => {
  it("calls getSettings when the dialog opens", async () => {
    render(<SettingsDialog />)
    openDialog()
    await waitFor(() => {
      expect(backend.getSettings).toHaveBeenCalledTimes(1)
    })
  })

  it("shows a loading indicator while getSettings is in flight", async () => {
    let resolve!: (v: backend.AppSettings) => void
    vi.mocked(backend.getSettings).mockReturnValue(new Promise((r) => (resolve = r)))

    render(<SettingsDialog />)
    openDialog()

    expect(await screen.findByText(/loading/i)).toBeInTheDocument()

    act(() => resolve({ ...DEFAULT_BACKEND }))
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })
  })

  it("shows a toast when getSettings fails", async () => {
    vi.mocked(backend.getSettings).mockRejectedValue(new Error("network error"))
    render(<SettingsDialog />)
    openDialog()
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load settings")
    })
  })
})

// ---------------------------------------------------------------------------
// Form population
// ---------------------------------------------------------------------------

describe("form population", () => {
  it("populates SSL toggle from backend value", async () => {
    vi.mocked(backend.getSettings).mockResolvedValue({
      ...DEFAULT_BACKEND,
      sslVerification: false,
    })
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /ssl certificate verification/i })
    expect(toggle).toHaveAttribute("data-state", "unchecked")
  })

  it("populates proxy URL from backend value", async () => {
    vi.mocked(backend.getSettings).mockResolvedValue({
      ...DEFAULT_BACKEND,
      proxyUrl: "http://proxy:3128",
    })
    render(<SettingsDialog />)
    openDialog()

    // Switch to Proxy section
    const proxyNav = await screen.findByRole("button", { name: /^proxy$/i })
    act(() => fireEvent.click(proxyNav))

    const input = await screen.findByPlaceholderText(/proxy\.example\.com/i)
    expect(input).toHaveValue("http://proxy:3128")
  })

  it("populates follow-redirects from local store", async () => {
    useSettingsStore.getState().update({ followRedirectsDefault: false })
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /follow redirects/i })
    expect(toggle).toHaveAttribute("data-state", "unchecked")
  })

  it("populates timeout from local store", async () => {
    useSettingsStore.getState().update({ timeoutDefault: 5000 })
    render(<SettingsDialog />)
    openDialog()

    const input = await screen.findByPlaceholderText("30000")
    expect(input).toHaveValue(5000)
  })
})

// ---------------------------------------------------------------------------
// Buffering — changes do not persist before Save
// ---------------------------------------------------------------------------

describe("buffering", () => {
  it("toggling SSL does not call putSettings before Save", async () => {
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /ssl certificate verification/i })
    act(() => fireEvent.click(toggle))

    expect(backend.putSettings).not.toHaveBeenCalled()
  })

  it("toggling follow-redirects does not update the local store before Save", async () => {
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /follow redirects/i })
    act(() => fireEvent.click(toggle))

    // Store should still hold the default (true)
    expect(useSettingsStore.getState().followRedirectsDefault).toBe(true)
  })

  it("cancel closes the dialog without calling putSettings", async () => {
    render(<SettingsDialog />)
    openDialog()

    await screen.findByRole("switch", { name: /ssl certificate verification/i })

    const cancel = screen.getByRole("button", { name: /^cancel$/i })
    act(() => fireEvent.click(cancel))

    expect(backend.putSettings).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(false)
    })
  })

  it("cancel discards local field changes", async () => {
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /follow redirects/i })
    act(() => fireEvent.click(toggle))

    const cancel = screen.getByRole("button", { name: /^cancel$/i })
    act(() => fireEvent.click(cancel))

    // Local store unchanged
    expect(useSettingsStore.getState().followRedirectsDefault).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Save — happy path
// ---------------------------------------------------------------------------

describe("save — happy path", () => {
  it("calls putSettings with the current backend form state", async () => {
    vi.mocked(backend.putSettings).mockResolvedValue({ ...DEFAULT_BACKEND, sslVerification: false })
    render(<SettingsDialog />)
    openDialog()

    const sslToggle = await screen.findByRole("switch", { name: /ssl certificate verification/i })
    act(() => fireEvent.click(sslToggle))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ sslVerification: false }),
    )
  })

  it("persists local fields to the store on save", async () => {
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /follow redirects/i })
    act(() => fireEvent.click(toggle))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    await waitFor(() => {
      expect(useSettingsStore.getState().followRedirectsDefault).toBe(false)
    })
  })

  it("shows success toast and closes the dialog on save", async () => {
    render(<SettingsDialog />)
    openDialog()

    await screen.findByRole("switch", { name: /ssl certificate verification/i })

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Settings saved")
      expect(useUiStore.getState().settingsOpen).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Save — error path
// ---------------------------------------------------------------------------

describe("save — error path", () => {
  it("shows BackendError message when putSettings fails with BackendError", async () => {
    const Err = (backend as unknown as { BackendError: new (c: string, m: string) => Error })
      .BackendError
    vi.mocked(backend.putSettings).mockRejectedValue(new Err("network", "Connection refused"))
    render(<SettingsDialog />)
    openDialog()

    await screen.findByRole("switch", { name: /ssl certificate verification/i })

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Connection refused")
    })
  })

  it("shows an error toast when putSettings fails", async () => {
    vi.mocked(backend.putSettings).mockRejectedValue(new Error("network error"))
    render(<SettingsDialog />)
    openDialog()

    await screen.findByRole("switch", { name: /ssl certificate verification/i })

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings")
    })
  })

  it("does not update the local store when putSettings fails", async () => {
    vi.mocked(backend.putSettings).mockRejectedValue(new Error("network error"))
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /follow redirects/i })
    act(() => fireEvent.click(toggle))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())

    // Local store must be unchanged — the backend failed, nothing was committed
    expect(useSettingsStore.getState().followRedirectsDefault).toBe(true)
  })

  it("keeps the dialog open when putSettings fails", async () => {
    vi.mocked(backend.putSettings).mockRejectedValue(new Error("network error"))
    render(<SettingsDialog />)
    openDialog()

    await screen.findByRole("switch", { name: /ssl certificate verification/i })

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(useUiStore.getState().settingsOpen).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Section navigation
// ---------------------------------------------------------------------------

describe("section navigation", () => {
  it("shows the General section by default", async () => {
    render(<SettingsDialog />)
    openDialog()

    await screen.findByRole("switch", { name: /ssl certificate verification/i })
    expect(
      screen.getByRole("switch", { name: /ssl certificate verification/i }),
    ).toBeInTheDocument()
  })

  it("shows the Proxy section when Proxy nav item is clicked", async () => {
    render(<SettingsDialog />)
    openDialog()

    const proxyNav = await screen.findByRole("button", { name: /^proxy$/i })
    act(() => fireEvent.click(proxyNav))

    expect(await screen.findByPlaceholderText(/proxy\.example\.com/i)).toBeInTheDocument()
  })

  it("shows the Certificates section when Certificates nav item is clicked", async () => {
    render(<SettingsDialog />)
    openDialog()

    const certNav = await screen.findByRole("button", { name: /^certificates$/i })
    act(() => fireEvent.click(certNav))

    expect(await screen.findByText(/not yet available/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Proxy section
// ---------------------------------------------------------------------------

describe("proxy section", () => {
  async function openProxySection() {
    const proxyNav = await screen.findByRole("button", { name: /^proxy$/i })
    act(() => fireEvent.click(proxyNav))
  }

  it("populates useSystemProxy toggle from backend value", async () => {
    vi.mocked(backend.getSettings).mockResolvedValue({
      ...DEFAULT_BACKEND,
      useSystemProxy: true,
    })
    render(<SettingsDialog />)
    openDialog()

    await openProxySection()

    const toggle = await screen.findByRole("switch", { name: /use system proxy/i })
    expect(toggle).toHaveAttribute("data-state", "checked")
  })

  it("populates respectEnvProxy toggle from backend value", async () => {
    vi.mocked(backend.getSettings).mockResolvedValue({
      ...DEFAULT_BACKEND,
      respectEnvProxy: true,
    })
    render(<SettingsDialog />)
    openDialog()

    await openProxySection()

    const toggle = await screen.findByRole("switch", { name: /respect http_proxy/i })
    expect(toggle).toHaveAttribute("data-state", "checked")
  })

  it("toggling useSystemProxy patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    await openProxySection()

    const toggle = await screen.findByRole("switch", { name: /use system proxy/i })
    act(() => fireEvent.click(toggle))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ useSystemProxy: true }),
    )
  })

  it("toggling respectEnvProxy patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    await openProxySection()

    const toggle = await screen.findByRole("switch", { name: /respect http_proxy/i })
    act(() => fireEvent.click(toggle))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ respectEnvProxy: true }),
    )
  })

  it("changing proxyUrl patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    await openProxySection()

    const input = await screen.findByPlaceholderText(/proxy\.example\.com/i)
    act(() => fireEvent.change(input, { target: { value: "http://new-proxy:8080" } }))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ proxyUrl: "http://new-proxy:8080" }),
    )
  })

  it("changing proxyUsername and proxyPassword patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    await openProxySection()

    const usernameInput = await screen.findByPlaceholderText("username")
    act(() => fireEvent.change(usernameInput, { target: { value: "proxyuser" } }))

    const passwordInput = await screen.findByPlaceholderText("password")
    act(() => fireEvent.change(passwordInput, { target: { value: "s3cret" } }))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ proxyUsername: "proxyuser", proxyPassword: "s3cret" }),
    )
  })

  it("changing noProxy patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    await openProxySection()

    const input = await screen.findByPlaceholderText(/localhost,127\.0\.0\.1/i)
    act(() => fireEvent.change(input, { target: { value: "localhost,internal.corp" } }))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ noProxy: "localhost,internal.corp" }),
    )
  })
})

// ---------------------------------------------------------------------------
// Dialog close
// ---------------------------------------------------------------------------

describe("dialog close", () => {
  it("handleCancel is called when sheet is closed via onOpenChange", async () => {
    render(<SettingsDialog />)
    openDialog()

    await screen.findByRole("switch", { name: /ssl certificate verification/i })

    act(() => {
      fireEvent.keyDown(document.body, { key: "Escape" })
    })

    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// General section — new fields
// ---------------------------------------------------------------------------

describe("general section — new fields", () => {
  it("populates maxResponseSizeMB from backend value", async () => {
    vi.mocked(backend.getSettings).mockResolvedValue({
      ...DEFAULT_BACKEND,
      maxResponseSizeMB: 75,
    })
    render(<SettingsDialog />)
    openDialog()

    const input = await screen.findByPlaceholderText("50")
    expect(input).toHaveValue(75)
  })

  it("populates scriptTimeoutMs from backend value", async () => {
    vi.mocked(backend.getSettings).mockResolvedValue({
      ...DEFAULT_BACKEND,
      scriptTimeoutMs: 3000,
    })
    render(<SettingsDialog />)
    openDialog()

    const input = await screen.findByPlaceholderText("5000")
    expect(input).toHaveValue(3000)
  })

  it("changing maxResponseSizeMB patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    const input = await screen.findByPlaceholderText("50")
    act(() => fireEvent.change(input, { target: { value: "25" } }))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ maxResponseSizeMB: 25 }),
    )
  })

  it("changing scriptTimeoutMs patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    const input = await screen.findByPlaceholderText("5000")
    act(() => fireEvent.change(input, { target: { value: "2000" } }))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(backend.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ scriptTimeoutMs: 2000 }),
    )
  })

  it("timeout input falls back to 0 when cleared", async () => {
    render(<SettingsDialog />)
    openDialog()

    const input = await screen.findByPlaceholderText("30000")
    act(() => fireEvent.change(input, { target: { value: "" } }))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(useSettingsStore.getState().timeoutDefault).toBe(0)
  })

  it("toggling no-cache header patches the form", async () => {
    render(<SettingsDialog />)
    openDialog()

    const toggle = await screen.findByRole("switch", { name: /send no-cache header/i })
    act(() => fireEvent.click(toggle))

    const save = screen.getByRole("button", { name: /^save$/i })
    await act(async () => fireEvent.click(save))

    expect(useSettingsStore.getState().noCacheHeader).toBe(true)
  })
})
