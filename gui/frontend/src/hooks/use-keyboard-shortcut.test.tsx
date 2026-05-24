import { renderHook } from "@testing-library/react"
import { fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useKeyboardShortcut } from "./use-keyboard-shortcut"

describe("useKeyboardShortcut", () => {
  it("calls handler on matching key", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut("k", handler, { ctrlOrMeta: true }))

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })

    expect(handler).toHaveBeenCalledOnce()
  })

  it("ignores key without required modifier", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut("k", handler, { ctrlOrMeta: true }))

    fireEvent.keyDown(window, { key: "k" })

    expect(handler).not.toHaveBeenCalled()
  })

  it("is case-insensitive", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut("k", handler))

    fireEvent.keyDown(window, { key: "K" })

    expect(handler).toHaveBeenCalledOnce()
  })

  it("removes listener on unmount", () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcut("k", handler))

    unmount()
    fireEvent.keyDown(window, { key: "k" })

    expect(handler).not.toHaveBeenCalled()
  })
})
