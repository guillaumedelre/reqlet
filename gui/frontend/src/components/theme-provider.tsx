import { useEffect, useState } from "react"
import { ThemeContext, type Theme } from "@/hooks/use-theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("reqlet-theme") as Theme) ?? "system",
  )

  useEffect(() => {
    const root = window.document.documentElement
    if (theme === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.setAttribute("data-theme", systemDark ? "dark" : "light")
    } else {
      root.setAttribute("data-theme", theme)
    }
    localStorage.setItem("reqlet-theme", theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
