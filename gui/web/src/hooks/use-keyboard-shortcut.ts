import { useEffect, useRef } from "react"

interface Options {
  ctrlOrMeta?: boolean
  shift?: boolean
}

export function useKeyboardShortcut(key: string, handler: () => void, options: Options = {}) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const { ctrlOrMeta, shift } = options

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const modOk = ctrlOrMeta ? e.ctrlKey || e.metaKey : true
      const shiftOk = shift !== undefined ? e.shiftKey === shift : true
      if (e.key.toLowerCase() === key.toLowerCase() && modOk && shiftOk) {
        e.preventDefault()
        handlerRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [key, ctrlOrMeta, shift])
}
