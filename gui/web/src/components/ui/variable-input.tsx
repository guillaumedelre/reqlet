import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Token =
  | { type: "text"; text: string }
  | { type: "var"; name: string; resolved: boolean; text: string }

export function tokenizeVariables(value: string, resolvedMap: Map<string, string>): Token[] {
  const regex = /\{\{([^{}]*)\}\}/g
  const tokens: Token[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: value.slice(lastIndex, match.index) })
    }
    tokens.push({
      type: "var",
      name: match[1],
      resolved: resolvedMap.has(match[1]),
      text: match[0],
    })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < value.length) {
    tokens.push({ type: "text", text: value.slice(lastIndex) })
  }
  return tokens
}

// Returns the `{{partial` context at the cursor position, or null if not applicable.
function getAutocompleteContext(
  value: string,
  cursorPos: number,
): { partial: string; start: number } | null {
  const before = value.slice(0, cursorPos)
  const lastOpen = before.lastIndexOf("{{")
  if (lastOpen === -1) return null
  const between = before.slice(lastOpen + 2)
  if (between.includes("}}")) return null
  return { partial: between, start: lastOpen }
}

export interface VariableInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string
  onChange: (value: string) => void
  resolvedMap?: Map<string, string>
  suggestions?: string[]
  /** Compact table-cell mode: no border, no background, smaller font */
  cell?: boolean
}

export function VariableInput({
  value,
  onChange,
  resolvedMap = new Map(),
  suggestions = [],
  cell = false,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder,
  ...props
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownItems, setDropdownItems] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const onScroll = () => setScrollLeft(input.scrollLeft)
    input.addEventListener("scroll", onScroll)
    return () => input.removeEventListener("scroll", onScroll)
  }, [])

  const tokens = tokenizeVariables(value, resolvedMap)
  const hasVars = tokens.some((t) => t.type === "var")

  const updateDropdown = useCallback(
    (val: string, cursorPos: number) => {
      const ctx = getAutocompleteContext(val, cursorPos)
      if (!ctx) {
        setDropdownOpen(false)
        return
      }
      const filtered = suggestions.filter(
        (k) => k.toLowerCase().startsWith(ctx.partial.toLowerCase()) && k !== ctx.partial,
      )
      if (filtered.length === 0) {
        setDropdownOpen(false)
        return
      }
      setDropdownItems(filtered)
      setActiveIndex(0)
      setDropdownOpen(true)
    },
    [suggestions],
  )

  const applyCompletion = useCallback(
    (key: string) => {
      const input = inputRef.current
      if (!input) return
      const cursorPos = input.selectionStart ?? value.length
      const ctx = getAutocompleteContext(value, cursorPos)
      if (!ctx) return
      const before = value.slice(0, ctx.start)
      const after = value.slice(cursorPos)
      const suffix = after.startsWith("}}") ? after.slice(2) : after
      const newValue = `${before}{{${key}}}${suffix}`
      onChange(newValue)
      setDropdownOpen(false)
      requestAnimationFrame(() => {
        const pos = before.length + 2 + key.length + 2
        input.setSelectionRange(pos, pos)
        input.focus()
      })
    },
    [value, onChange],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    updateDropdown(e.target.value, e.target.selectionStart ?? e.target.value.length)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdownOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, dropdownItems.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        applyCompletion(dropdownItems[activeIndex])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setDropdownOpen(false)
        return
      }
    }
    onKeyDown?.(e)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    setTimeout(() => setDropdownOpen(false), 150)
    onBlur?.(e)
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      {/* Visual container — overflow-hidden clips the mirror scroll */}
      <div
        className={cn(
          "h-full overflow-hidden relative",
          cell
            ? "border-b border-transparent focus-within:border-primary/40"
            : "rounded-md border border-border/60 bg-muted/30",
        )}
      >
        {/* Input first so it sits below the mirror in stacking order */}
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "reqlet-variable-input",
            "absolute inset-0 w-full h-full bg-transparent",
            "font-mono border-0 outline-none",
            "caret-foreground",
            cell ? "text-xs px-1" : "text-[0.8125rem] px-3",
            hasVars ? "text-transparent" : "text-foreground",
          )}
          spellCheck={false}
          {...props}
        />

        {/* Mirror rendered after input so it sits on top — pointer-events-none passes
            through to the input everywhere except resolved var spans (pointer-events-auto) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none flex items-center overflow-hidden"
        >
          <div
            className={cn(
              "whitespace-nowrap font-mono shrink-0",
              cell ? "text-xs" : "text-[0.8125rem]",
            )}
            style={{ paddingInline: cell ? 4 : 12, transform: `translateX(${-scrollLeft}px)` }}
          >
            {tokens.map((token, i) => {
              if (token.type !== "var") {
                return (
                  <span key={i} className="text-foreground">
                    {token.text}
                  </span>
                )
              }
              if (!token.resolved) {
                return (
                  <span key={i} className="text-amber-500 dark:text-amber-400">
                    {token.text}
                  </span>
                )
              }
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <span
                      className="text-emerald-500 dark:text-emerald-400 pointer-events-auto cursor-text"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        inputRef.current?.focus()
                      }}
                    >
                      {token.text}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="font-mono text-xs">
                    {resolvedMap.get(token.name)}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>

      {/* Focus ring — only in full (non-cell) mode */}
      {!cell && isFocused && (
        <div className="absolute inset-0 rounded-md ring-1 ring-ring pointer-events-none" />
      )}

      {/* Autocomplete dropdown */}
      {dropdownOpen && dropdownItems.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md py-1">
          {dropdownItems.map((key, i) => (
            <button
              key={key}
              type="button"
              className={cn(
                "w-full text-left flex items-center gap-0 px-3 py-1.5 text-xs font-mono",
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-popover-foreground hover:bg-accent/50",
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                applyCompletion(key)
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="text-muted-foreground">{"{{"}</span>
              <span>{key}</span>
              <span className="text-muted-foreground">{"}}"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
