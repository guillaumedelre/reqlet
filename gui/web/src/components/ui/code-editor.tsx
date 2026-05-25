import Editor, { type OnMount } from "@monaco-editor/react"

import { useTheme } from "@/hooks/use-theme"

interface Props {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  height?: number | string
  wordWrap?: "on" | "off"
  onMount?: OnMount
}

export function CodeEditor({
  value,
  onChange,
  language = "plaintext",
  readOnly = false,
  height = "100%",
  wordWrap = "on",
  onMount,
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
      onMount={onMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 11,
        fontFamily: "monospace",
        lineNumbers: "off",
        folding: false,
        scrollBeyondLastLine: false,
        wordWrap,
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        automaticLayout: true,
        padding: { top: 8, bottom: 8 },
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
          useShadows: false,
        },
      }}
    />
  )
}
