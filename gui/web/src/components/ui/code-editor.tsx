import { useEffect, useState } from "react"
import Editor, { type BeforeMount } from "@monaco-editor/react"
import { cn } from "@/lib/utils"

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

const defineThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("reqlet-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#1d2130",
      "editorGutter.background": "#1d2130",
      "editor.lineHighlightBackground": "#00000000",
    },
  })
  monaco.editor.defineTheme("reqlet-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editorGutter.background": "#f8fafc",
      "editor.lineHighlightBackground": "#00000000",
    },
  })
}

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  wordWrap?: boolean
  className?: string
}

export function CodeEditor({
  value,
  onChange,
  language = "plaintext",
  readOnly = false,
  wordWrap = true,
  className,
}: CodeEditorProps) {
  const isDark = useIsDark()

  return (
    <div className={cn("h-full w-full overflow-hidden", className)}>
      <Editor
        value={value}
        language={language}
        theme={isDark ? "reqlet-dark" : "reqlet-light"}
        onChange={(v) => onChange?.(v ?? "")}
        beforeMount={defineThemes}
        loading={
          <div className="h-full flex items-center justify-center">
            <span className="text-xs text-muted-foreground animate-pulse">Loading editor…</span>
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          wordWrap: wordWrap ? "on" : "off",
          folding: false,
          lineDecorationsWidth: 4,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { vertical: "auto", horizontal: "auto", alwaysConsumeMouseWheel: false },
          padding: { top: 8, bottom: 8 },
          contextmenu: !readOnly,
          automaticLayout: true,
          glyphMargin: false,
          ...(readOnly ? { cursorStyle: "block", cursorBlinking: "solid", domReadOnly: true } : {}),
        }}
      />
    </div>
  )
}
