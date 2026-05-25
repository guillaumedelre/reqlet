import type { KeyValueItem, Tab } from "@/store/tabs"
import { assembleUrl } from "./url"

export type CodeLanguage = "cURL" | "Python" | "JavaScript" | "Go"

function enabledPairs(items: KeyValueItem[]): Array<[string, string]> {
  return items.filter((i) => i.enabled && i.key).map((i) => [i.key, i.value])
}

function rawBody(tab: Tab): string | null {
  if (tab.bodyType === "raw") return tab.bodyRaw || null
  if (tab.bodyType === "urlencoded") {
    const pairs = enabledPairs(tab.bodyUrlencoded)
    if (!pairs.length) return null
    return pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
  }
  return null
}

function escSingleQuote(s: string): string {
  return s.replace(/'/g, "'\\''")
}

function escDoubleQuote(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function generateCurl(tab: Tab): string {
  const url = assembleUrl(tab.url, tab.params)
  const headers = enabledPairs(tab.headers)
  const body = rawBody(tab)
  const isFormData = tab.bodyType === "form-data"
  const formPairs = isFormData ? enabledPairs(tab.bodyFormData) : []

  const lines: string[] = [`curl -X ${tab.method} '${escSingleQuote(url)}'`]

  for (const [k, v] of headers) {
    lines.push(`  -H '${escSingleQuote(k)}: ${escSingleQuote(v)}'`)
  }

  if (body) {
    lines.push(`  --data '${escSingleQuote(body)}'`)
  } else if (isFormData) {
    for (const [k, v] of formPairs) {
      lines.push(`  -F '${escSingleQuote(k)}=${escSingleQuote(v)}'`)
    }
  }

  return lines.join(" \\\n")
}

export function generatePython(tab: Tab): string {
  const url = assembleUrl(tab.url, tab.params)
  const headers = enabledPairs(tab.headers)
  const body = rawBody(tab)
  const isFormData = tab.bodyType === "form-data"
  const formPairs = isFormData ? enabledPairs(tab.bodyFormData) : []
  const hasParams = tab.params.filter((p) => p.enabled && p.key).length > 0

  const lines: string[] = ["import requests", ""]

  const baseUrl = hasParams ? tab.url || '""' : url
  lines.push(`url = "${escDoubleQuote(baseUrl)}"`)

  if (hasParams) {
    const params = enabledPairs(tab.params)
    lines.push("params = {")
    for (const [k, v] of params) {
      lines.push(`    "${escDoubleQuote(k)}": "${escDoubleQuote(v)}",`)
    }
    lines.push("}")
  }

  if (headers.length) {
    lines.push("headers = {")
    for (const [k, v] of headers) {
      lines.push(`    "${escDoubleQuote(k)}": "${escDoubleQuote(v)}",`)
    }
    lines.push("}")
  }

  if (body) {
    lines.push(`data = "${escDoubleQuote(body)}"`)
  } else if (isFormData && formPairs.length) {
    lines.push("files = {")
    for (const [k, v] of formPairs) {
      lines.push(`    "${escDoubleQuote(k)}": (None, "${escDoubleQuote(v)}"),`)
    }
    lines.push("}")
  }

  lines.push("")
  const method = tab.method.toLowerCase()
  const args = ["url"]
  if (hasParams) args.push("params=params")
  if (headers.length) args.push("headers=headers")
  if (body) args.push("data=data")
  else if (isFormData && formPairs.length) args.push("files=files")
  lines.push(`response = requests.${method}(${args.join(", ")})`)
  lines.push("print(response.json())")

  return lines.join("\n")
}

export function generateJavaScript(tab: Tab): string {
  const url = assembleUrl(tab.url, tab.params)
  const headers = enabledPairs(tab.headers)
  const body = rawBody(tab)
  const isFormData = tab.bodyType === "form-data"
  const formPairs = isFormData ? enabledPairs(tab.bodyFormData) : []

  const lines: string[] = []

  if (isFormData && formPairs.length) {
    lines.push("const formData = new FormData();")
    for (const [k, v] of formPairs) {
      lines.push(`formData.append("${escDoubleQuote(k)}", "${escDoubleQuote(v)}");`)
    }
    lines.push("")
  }

  const opts: string[] = [`  method: "${tab.method}"`]

  if (headers.length) {
    opts.push("  headers: {")
    for (const [k, v] of headers) {
      opts.push(`    "${escDoubleQuote(k)}": "${escDoubleQuote(v)}",`)
    }
    opts.push("  }")
  }

  if (body) {
    opts.push(`  body: "${escDoubleQuote(body)}"`)
  } else if (isFormData && formPairs.length) {
    opts.push("  body: formData")
  }

  lines.push(`const response = await fetch("${escDoubleQuote(url)}", {`)
  lines.push(opts.join(",\n"))
  lines.push("});")
  lines.push("const data = await response.json();")
  lines.push("console.log(data);")

  return lines.join("\n")
}

export function generateGo(tab: Tab): string {
  const url = assembleUrl(tab.url, tab.params)
  const headers = enabledPairs(tab.headers)
  const body = rawBody(tab)
  const isFormData = tab.bodyType === "form-data"
  const formPairs = isFormData ? enabledPairs(tab.bodyFormData) : []

  const imports = ["fmt", "io", "net/http"]
  const lines: string[] = ["package main", "", `import (`]

  if (body || (isFormData && formPairs.length)) {
    imports.push("strings")
  }
  if (isFormData && formPairs.length) {
    imports.push("mime/multipart")
    imports.push("bytes")
    imports.splice(imports.indexOf("strings"), 1)
  }

  for (const imp of imports.sort()) {
    lines.push(`\t"${imp}"`)
  }
  lines.push(")", "")
  lines.push("func main() {")

  if (body) {
    lines.push(`\tbody := strings.NewReader("${escDoubleQuote(body)}")`)
    lines.push(`\treq, _ := http.NewRequest("${tab.method}", "${escDoubleQuote(url)}", body)`)
  } else if (isFormData && formPairs.length) {
    lines.push("\tvar buf bytes.Buffer")
    lines.push("\tw := multipart.NewWriter(&buf)")
    for (const [k, v] of formPairs) {
      lines.push(`\t_ = w.WriteField("${escDoubleQuote(k)}", "${escDoubleQuote(v)}")`)
    }
    lines.push("\tw.Close()")
    lines.push(`\treq, _ := http.NewRequest("${tab.method}", "${escDoubleQuote(url)}", &buf)`)
    lines.push('\treq.Header.Set("Content-Type", w.FormDataContentType())')
  } else {
    lines.push(`\treq, _ := http.NewRequest("${tab.method}", "${escDoubleQuote(url)}", nil)`)
  }

  for (const [k, v] of headers) {
    lines.push(`\treq.Header.Set("${escDoubleQuote(k)}", "${escDoubleQuote(v)}")`)
  }

  lines.push("")
  lines.push("\tclient := &http.Client{}")
  lines.push("\tresp, _ := client.Do(req)")
  lines.push("\tdefer resp.Body.Close()")
  lines.push("")
  lines.push("\tbody2, _ := io.ReadAll(resp.Body)")
  lines.push("\tfmt.Println(string(body2))")
  lines.push("}")

  return lines.join("\n")
}

export function generateCode(tab: Tab, lang: CodeLanguage): string {
  switch (lang) {
    case "cURL":
      return generateCurl(tab)
    case "Python":
      return generatePython(tab)
    case "JavaScript":
      return generateJavaScript(tab)
    case "Go":
      return generateGo(tab)
  }
}
