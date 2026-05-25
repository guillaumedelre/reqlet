import { assembleUrl } from "@/lib/url"
import type { ResponseData, Tab } from "@/store/tabs"

export function isWails(): boolean {
  return typeof (window as Window & { go?: unknown }).go !== "undefined"
}

export class SendError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = "SendError"
  }
}

export async function sendRequest(tab: Tab): Promise<ResponseData> {
  if (isWails()) {
    // Wails binding — implemented in Bloc D
    throw new SendError("Wails send not yet implemented", "not_implemented")
  }

  const url = assembleUrl(tab.url, tab.params)

  let res: Response
  try {
    res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: tab.method,
        url,
        headers: tab.headers,
        bodyType: tab.bodyType,
        bodyRaw: tab.bodyRaw,
        bodyRawContentType: tab.bodyRawContentType,
        bodyFormData: tab.bodyFormData,
        bodyUrlencoded: tab.bodyUrlencoded,
        followRedirects: tab.followRedirects,
        sslVerification: tab.sslVerification,
        timeout: tab.timeout,
        ignoreProxy: tab.ignoreProxy,
      }),
    })
  } catch {
    throw new SendError("Agent unreachable — is reqlet-agent running?", "agent_unreachable")
  }

  const data = (await res.json()) as { error?: string; code?: string } & ResponseData

  if (!res.ok) {
    throw new SendError(data.error ?? "Request failed", data.code ?? "network_error")
  }

  return data
}
