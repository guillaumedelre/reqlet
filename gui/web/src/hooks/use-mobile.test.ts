import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIsMobile } from "./use-mobile"

interface MockMql {
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

let mockMql: MockMql

beforeEach(() => {
  mockMql = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mockMql),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useIsMobile", () => {
  it("returns false when innerWidth >= 768", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("returns true when innerWidth < 768", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 375 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("updates when matchMedia change event fires with new innerWidth", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    Object.defineProperty(window, "innerWidth", { writable: true, value: 375 })
    const changeCallback = mockMql.addEventListener.mock.calls[0][1] as () => void
    act(() => changeCallback())
    expect(result.current).toBe(true)
  })

  it("removes the event listener on unmount", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 })
    const { unmount } = renderHook(() => useIsMobile())
    unmount()
    expect(mockMql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function))
  })

  it("calls matchMedia with the 767px breakpoint query", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 })
    renderHook(() => useIsMobile())
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)")
  })
})
