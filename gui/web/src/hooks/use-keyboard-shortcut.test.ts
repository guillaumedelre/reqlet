import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useKeyboardShortcut } from "./use-keyboard-shortcut"

function fireKey(
  key: string,
  opts: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {},
) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }))
}

describe("useKeyboardShortcut", () => {
  let handler: () => void

  beforeEach(() => {
    handler = vi.fn() as () => void
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("calls the handler on the matching key", () => {
    renderHook(() => useKeyboardShortcut("k", handler))
    fireKey("k")
    expect(handler).toHaveBeenCalledOnce()
  })

  it("is case-insensitive for the key", () => {
    renderHook(() => useKeyboardShortcut("k", handler))
    fireKey("K")
    expect(handler).toHaveBeenCalledOnce()
  })

  it("does not fire when a different key is pressed", () => {
    renderHook(() => useKeyboardShortcut("k", handler))
    fireKey("j")
    expect(handler).not.toHaveBeenCalled()
  })

  it("requires ctrl/meta when ctrl=true", () => {
    renderHook(() => useKeyboardShortcut("k", handler, true))
    fireKey("k")
    expect(handler).not.toHaveBeenCalled()
    fireKey("k", { ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("accepts metaKey as equivalent to ctrlKey", () => {
    renderHook(() => useKeyboardShortcut("k", handler, true))
    fireKey("k", { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("does not fire with ctrl pressed when ctrl=false", () => {
    renderHook(() => useKeyboardShortcut("k", handler))
    fireKey("k", { ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it("requires shift when shift=true", () => {
    renderHook(() => useKeyboardShortcut("k", handler, false, true))
    fireKey("k")
    expect(handler).not.toHaveBeenCalled()
    fireKey("k", { shiftKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("does not fire with shift pressed when shift=false", () => {
    renderHook(() => useKeyboardShortcut("k", handler))
    fireKey("k", { shiftKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it("requires alt when alt=true", () => {
    renderHook(() => useKeyboardShortcut("k", handler, false, false, true))
    fireKey("k")
    expect(handler).not.toHaveBeenCalled()
    fireKey("k", { altKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("matches ctrl+shift+key when both are required", () => {
    renderHook(() => useKeyboardShortcut("p", handler, true, true))
    fireKey("p", { ctrlKey: true, shiftKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useKeyboardShortcut("k", handler))
    unmount()
    fireKey("k")
    expect(handler).not.toHaveBeenCalled()
  })

  it("always uses the latest handler reference", () => {
    const first = vi.fn() as () => void
    const second = vi.fn() as () => void
    const { rerender } = renderHook(({ h }: { h: () => void }) => useKeyboardShortcut("k", h), {
      initialProps: { h: first },
    })
    rerender({ h: second })
    fireKey("k")
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
