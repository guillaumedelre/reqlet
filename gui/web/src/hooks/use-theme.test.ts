import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useTheme } from "./use-theme"

function mockMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mq = {
    matches: prefersDark,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.push(cb),
    ),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    dispatchChange: (matches: boolean) => {
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
    },
  }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mq),
  })
  return mq
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("initial theme", () => {
  it("defaults to system when no stored value", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("system")
  })

  it("restores light from localStorage", () => {
    localStorage.setItem("reqlet-theme", "light")
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("light")
  })

  it("restores dark from localStorage", () => {
    localStorage.setItem("reqlet-theme", "dark")
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("dark")
  })

  it("falls back to system for an invalid stored value", () => {
    localStorage.setItem("reqlet-theme", "invalid")
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("system")
  })
})

describe("dark class on documentElement", () => {
  it("adds dark class when theme is dark", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme("dark"))
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("removes dark class when theme is light", () => {
    document.documentElement.classList.add("dark")
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme("light"))
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("adds dark class when system prefers dark", () => {
    mockMatchMedia(true)
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("does not add dark class when system prefers light", () => {
    mockMatchMedia(false)
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})

describe("localStorage persistence", () => {
  it("stores the theme setting in localStorage", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme("dark"))
    expect(localStorage.getItem("reqlet-theme")).toBe("dark")
  })
})

describe("toggleTheme", () => {
  it("cycles light → dark → system → light", () => {
    localStorage.setItem("reqlet-theme", "light")
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe("dark")

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe("system")

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe("light")
  })
})

describe("isDark", () => {
  it("is true when theme is dark", () => {
    localStorage.setItem("reqlet-theme", "dark")
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.isDark).toBe(true)
  })

  it("is false when theme is light", () => {
    localStorage.setItem("reqlet-theme", "light")
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.isDark).toBe(false)
  })

  it("reflects system preference when theme is system", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.isDark).toBe(true)
  })
})

describe("system theme reacts to matchMedia changes", () => {
  it("updates dark class when OS preference changes while on system", () => {
    const mq = mockMatchMedia(false)
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    act(() => {
      mq.matches = true
      mq.dispatchChange(true)
    })
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("removes the matchMedia listener when theme changes away from system", () => {
    const mq = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme("dark"))
    expect(mq.removeEventListener).toHaveBeenCalled()
  })
})
