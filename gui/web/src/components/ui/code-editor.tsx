import { useEffect, useRef, useState } from "react"
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react"
import type * as Monaco from "monaco-editor"
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

const VAR_REGEX = /\{\{([^{}]*)\}\}/g

function computeVariableDecorations(
  model: Monaco.editor.ITextModel,
  monacoInstance: typeof Monaco,
  resolvedMap: Map<string, string>,
): Monaco.editor.IModelDeltaDecoration[] {
  const text = model.getValue()
  const decorations: Monaco.editor.IModelDeltaDecoration[] = []
  VAR_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = VAR_REGEX.exec(text)) !== null) {
    const start = model.getPositionAt(match.index)
    const end = model.getPositionAt(match.index + match[0].length)
    decorations.push({
      range: new monacoInstance.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName: resolvedMap.has(match[1])
          ? "monaco-var-resolved"
          : "monaco-var-unresolved",
      },
    })
  }
  return decorations
}

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  wordWrap?: boolean
  className?: string
  variableSuggestions?: string[]
  variableResolvedMap?: Map<string, string>
}

export function CodeEditor({
  value,
  onChange,
  language = "plaintext",
  readOnly = false,
  wordWrap = true,
  className,
  variableSuggestions,
  variableResolvedMap,
}: CodeEditorProps) {
  const isDark = useIsDark()

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const suggestionsRef = useRef(variableSuggestions ?? [])
  const resolvedMapRef = useRef(variableResolvedMap ?? new Map<string, string>())
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const completionDisposableRef = useRef<Monaco.IDisposable | null>(null)

  useEffect(() => {
    suggestionsRef.current = variableSuggestions ?? []
  }, [variableSuggestions])

  useEffect(() => {
    resolvedMapRef.current = variableResolvedMap ?? new Map()
    if (editorRef.current && monacoRef.current && decorationsRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        decorationsRef.current.set(
          computeVariableDecorations(model, monacoRef.current, resolvedMapRef.current),
        )
      }
    }
  }, [variableResolvedMap])

  useEffect(() => {
    return () => {
      completionDisposableRef.current?.dispose()
      decorationsRef.current?.clear()
    }
  }, [])

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    if (variableSuggestions !== undefined) {
      // Register per-editor completion provider; model check avoids cross-editor leakage
      completionDisposableRef.current = monaco.languages.registerCompletionItemProvider("*", {
        triggerCharacters: ["{"],
        provideCompletionItems: (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
          if (editor.getModel() !== model) return { suggestions: [] }
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          })
          const match = textUntilPosition.match(/\{\{([^}]*)$/)
          if (!match) return { suggestions: [] }
          const partial = match[1]
          return {
            suggestions: suggestionsRef.current
              .filter((k) => k.toLowerCase().startsWith(partial.toLowerCase()))
              .map((key) => ({
                label: `{{${key}}}`,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: `${key}}}`,
                detail: resolvedMapRef.current.has(key)
                  ? `= ${resolvedMapRef.current.get(key)}`
                  : "not defined",
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column - partial.length,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              })),
          }
        },
      })
    }

    if (variableResolvedMap !== undefined) {
      decorationsRef.current = editor.createDecorationsCollection([])
      const model = editor.getModel()
      if (model) {
        decorationsRef.current.set(
          computeVariableDecorations(model, monaco, resolvedMapRef.current),
        )
      }
      editor.onDidChangeModelContent(() => {
        const m = editor.getModel()
        if (m && decorationsRef.current && monacoRef.current) {
          decorationsRef.current.set(
            computeVariableDecorations(m, monacoRef.current, resolvedMapRef.current),
          )
        }
      })
    }
  }

  return (
    <div className={cn("h-full w-full overflow-hidden", className)}>
      <Editor
        value={value}
        language={language}
        theme={isDark ? "reqlet-dark" : "reqlet-light"}
        onChange={(v) => onChange?.(v ?? "")}
        beforeMount={defineThemes}
        onMount={handleMount}
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
