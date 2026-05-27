import { cn } from "@/lib/utils"
import { METHOD_COLORS } from "@/lib/http"
import type { HttpMethod } from "@/types"

interface MethodBadgeProps {
  method: HttpMethod
  size?: "xs" | "sm"
  className?: string
}

export function MethodBadge({ method, size = "xs", className }: MethodBadgeProps) {
  const { text, dark } = METHOD_COLORS[method]
  return (
    <span
      className={cn(
        "font-mono font-bold tracking-wider shrink-0 inline-block text-center",
        size === "xs" ? "text-[10px]" : "text-[11px]",
        text,
        dark,
        className,
      )}
    >
      {method}
    </span>
  )
}
