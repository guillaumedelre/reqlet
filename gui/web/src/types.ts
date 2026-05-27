export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD"

export type BodyType = "none" | "raw" | "form-data" | "x-www-form-urlencoded" | "binary" | "graphql"
export type RawContentType =
  | "application/json"
  | "application/xml"
  | "text/plain"
  | "text/html"
  | "application/javascript"

export type RequestSubTab = "params" | "auth" | "headers" | "body" | "scripts" | "settings" | "code"
export type ResponseSubTab = "body" | "headers" | "cookies" | "timeline"
export type CollectionSubTab = "overview" | "authorization" | "variables" | "scripts" | "runs"
export type FolderSubTab = "overview" | "authorization" | "scripts"

export interface KeyValuePair {
  id: string
  enabled: boolean
  key: string
  value: string
  description: string
}

export interface RequestBody {
  type: BodyType
  raw: string
  rawContentType: RawContentType
  formData: KeyValuePair[]
  urlencoded: KeyValuePair[]
  graphqlQuery: string
  graphqlVariables: string
}

export interface RequestSettings {
  followRedirects: boolean
  maxRedirects: number
  followOriginalMethod: boolean
  followAuthHeader: boolean
  removeReferer: boolean
  sslVerify: boolean
  timeout: number
  httpVersion: "auto" | "http1" | "http2"
  encodeUrl: boolean
  cookieJar: boolean
  proxy: { enabled: boolean; url: string; username: string; password: string }
}

export const DEFAULT_REQUEST_SETTINGS: RequestSettings = {
  followRedirects: true,
  maxRedirects: 10,
  followOriginalMethod: false,
  followAuthHeader: true,
  removeReferer: false,
  sslVerify: true,
  timeout: 30000,
  httpVersion: "auto",
  encodeUrl: true,
  cookieJar: true,
  proxy: { enabled: false, url: "", username: "", password: "" },
}

export type AuthType = "inherit" | "none" | "bearer" | "basic" | "api-key"

export interface AuthConfig {
  type: AuthType
  bearer?: { token: string }
  basic?: { username: string; password: string }
  apiKey?: { key: string; value: string; addTo: "header" | "query" }
}

export interface RequestState {
  method: HttpMethod
  url: string
  params: KeyValuePair[]
  headers: KeyValuePair[]
  body: RequestBody
  auth: AuthConfig
  preRequestScript: string
  testScript: string
  pathVariables?: KeyValuePair[]
  settings?: RequestSettings
}

export const DEFAULT_REQUEST: RequestState = {
  method: "GET",
  url: "",
  params: [],
  headers: [],
  body: {
    type: "none",
    raw: "",
    rawContentType: "application/json",
    formData: [],
    urlencoded: [],
    graphqlQuery: "",
    graphqlVariables: "",
  },
  auth: { type: "inherit" },
  preRequestScript: "",
  testScript: "",
  pathVariables: [],
  settings: { ...DEFAULT_REQUEST_SETTINGS },
}

export interface RequestItem {
  id: string
  name: string
  method: HttpMethod
  url: string
  params: KeyValuePair[]
  headers: KeyValuePair[]
  body: RequestBody
  auth: AuthConfig
  preRequestScript: string
  testScript: string
}

export interface FolderItem {
  id: string
  name: string
  auth: AuthConfig
  preRequestScript: string
  testScript: string
  items: CollectionItem[]
}

export type CollectionItem = RequestItem | FolderItem

export interface Collection {
  id: string
  name: string
  description: string
  auth: AuthConfig
  variables: EnvVariable[]
  preRequestScript: string
  testScript: string
  items: CollectionItem[]
}

export interface EnvVariable {
  id: string
  enabled: boolean
  key: string
  initialValue: string
  currentValue: string
}

export interface Environment {
  id: string
  name: string
  variables: EnvVariable[]
}

export interface ResponseData {
  status: number
  statusText: string
  time: number
  size: number
  headers: Record<string, string>
  body: string
  contentType: string
}

export type TabType = "request" | "collection" | "folder" | "environment" | "globals"

export interface Tab {
  id: string
  type: TabType
  title: string
  dirty: boolean
  requestId?: string
  collectionId?: string
  folderId?: string
  environmentId?: string
  request: RequestState
  isSending: boolean
  response: ResponseData | null
  requestSubTab: RequestSubTab
  responseSubTab: ResponseSubTab
  collectionSubTab: CollectionSubTab | FolderSubTab
}

export function isFolder(item: CollectionItem): item is FolderItem {
  return !("method" in item)
}

export function isRequest(item: CollectionItem): item is RequestItem {
  return "method" in item
}
