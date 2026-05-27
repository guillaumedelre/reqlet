import "@testing-library/jest-dom"

// ResizeObserver is not implemented in jsdom — needed by Radix ScrollArea
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
