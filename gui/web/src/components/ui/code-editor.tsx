import Editor from "@monaco-editor/react"

import { useTheme } from "@/hooks/use-theme"

interface Props {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  height?: number | string
}

export function CodeEditor({
  value,
  onChange,
  language = "plaintext",
  readOnly = false,
  height = "100%",
}: Props) {
  const { theme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={isDark ? "vs-dark" : "vs"}
      loading={null}
      onChange={readOnly ? undefined : (v) => onChange?.(v ?? "")}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 11,
        fontFamily: "monospace",
        lineNumbers: "off",
        folding: false,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        automaticLayout: true,
        padding: { top: 8, bottom: 8 },
      }}
    />
  )
}
