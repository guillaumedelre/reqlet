import type { AuthConfig } from "@/types"

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
}

export interface SendResponse {
  status: number
  statusText: string
  time: number
  size: number
  headers: Record<string, string>
  body: string
  contentType: string
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

function isWailsContext(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { go?: unknown }).go === "object" &&
    (window as Window & { go?: unknown }).go !== null
  )
}
