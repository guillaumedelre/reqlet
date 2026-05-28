import type { AuthConfig, TestResult, Timings, VariableMutations } from "@/types"

export interface SendRequest {
  method: string
  url: string
  headers: Array<{ key: string; value: string; enabled: boolean }>
  bodyType: string
  bodyRaw: string
  bodyRawContentType: string
  bodyFormData: Array<{
    key: string
    value: string
    enabled: boolean
    valueType?: string
    fileName?: string
    fileContent?: string
  }>
  bodyUrlencoded: Array<{ key: string; value: string; enabled: boolean }>
  bodyGraphQLQuery?: string
  bodyGraphQLVariables?: string
  auth?: AuthConfig
  followRedirects: boolean
  sslVerification: boolean
  timeout: number
  ignoreProxy: boolean
  preRequestScript?: string
  testScript?: string
  variables?: {
    globals?: Record<string, string>
    environment?: Record<string, string>
    collectionVariables?: Record<string, string>
  }
  requestName?: string
  requestId?: string
}

export interface SendResponse {
  status: number
  statusText: string
  time: number
  size: number
  headers: Record<string, string>
  body: string
  contentType: string
  timings?: Timings
  testResults?: TestResult[]
  preRequestError?: string
  testError?: string
  mutations?: VariableMutations
}

export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "BackendError"
  }
}

export async function sendRequest(req: SendRequest): Promise<SendResponse> {
  if (isWailsContext()) {
    // Wails bindings — implemented in Bloc D
    throw new BackendError("not_implemented", "Wails bindings not yet implemented")
  }
  const response = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!response.ok) {
    const err = (await response.json()) as { error: string; code: string }
    throw new BackendError(err.code ?? "request_failed", err.error ?? "Request failed")
  }
  return response.json() as Promise<SendResponse>
}

export async function cancelRequest(id: string): Promise<void> {
  if (isWailsContext()) {
    throw new BackendError("not_implemented", "Wails bindings not yet implemented")
  }
  const response = await fetch(`/api/send/${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!response.ok && response.status !== 404) {
    const err = (await response.json()) as { error: string; code: string }
    throw new BackendError(err.code ?? "cancel_failed", err.error ?? "Cancel failed")
  }
}

export interface RunScriptRequest {
  script: string
  event?: "prerequest" | "test"
  variables?: {
    globals?: Record<string, string>
    environment?: Record<string, string>
    collectionVariables?: Record<string, string>
  }
  request?: { url: string; method: string; headers: Record<string, string>; body: string }
  response?: {
    status: string
    code: number
    responseTime: number
    responseSize: number
    headers: Record<string, string>
    body: string
  }
}

export interface RunScriptResponse {
  tests: TestResult[]
  mutations?: VariableMutations
  error?: string
}

export async function runScript(req: RunScriptRequest): Promise<RunScriptResponse> {
  if (isWailsContext()) {
    throw new BackendError("not_implemented", "Wails bindings not yet implemented")
  }
  const response = await fetch("/api/sandbox/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!response.ok) {
    const err = (await response.json()) as { error: string; code: string }
    throw new BackendError(err.code ?? "sandbox_failed", err.error ?? "Script execution failed")
  }
  return response.json() as Promise<RunScriptResponse>
}

export interface VariableEntry {
  id: string
  key: string
  initialValue: string
  currentValue: string
  enabled: boolean
}

export interface VariablesResponse {
  globals: VariableEntry[]
  environment: VariableEntry[]
  collection: VariableEntry[]
}

export async function getVariables(
  collectionId?: string,
  environmentId?: string,
): Promise<VariablesResponse> {
  if (isWailsContext()) {
    throw new BackendError("not_implemented", "Wails bindings not yet implemented")
  }
  const params = new URLSearchParams()
  if (collectionId) params.set("collectionId", collectionId)
  if (environmentId) params.set("environmentId", environmentId)
  const qs = params.toString()
  const response = await fetch(`/api/variables${qs ? `?${qs}` : ""}`)
  if (!response.ok) {
    const err = (await response.json()) as { error: string; code: string }
    throw new BackendError(err.code ?? "request_failed", err.error ?? "Request failed")
  }
  return response.json() as Promise<VariablesResponse>
}

export interface AppSettings {
  proxyUrl: string
  proxyUsername: string
  proxyPassword: string
  noProxy: string
  sslVerification: boolean
}

export async function getSettings(): Promise<AppSettings> {
  if (isWailsContext()) {
    throw new BackendError("not_implemented", "Wails bindings not yet implemented")
  }
  const response = await fetch("/api/settings")
  if (!response.ok) {
    const err = (await response.json()) as { error: string; code: string }
    throw new BackendError(err.code ?? "request_failed", err.error ?? "Request failed")
  }
  return response.json() as Promise<AppSettings>
}

export async function putSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  if (isWailsContext()) {
    throw new BackendError("not_implemented", "Wails bindings not yet implemented")
  }
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  })
  if (!response.ok) {
    const err = (await response.json()) as { error: string; code: string }
    throw new BackendError(err.code ?? "request_failed", err.error ?? "Request failed")
  }
  return response.json() as Promise<AppSettings>
}

function isWailsContext(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { go?: unknown }).go === "object" &&
    (window as Window & { go?: unknown }).go !== null
  )
}
