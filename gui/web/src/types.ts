export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export type BodyType = 'none' | 'raw' | 'form-data' | 'x-www-form-urlencoded';
export type RawContentType =
  | 'application/json'
  | 'application/xml'
  | 'text/plain'
  | 'text/html'
  | 'application/javascript';

export interface KeyValuePair {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description: string;
}

export interface RequestBody {
  type: BodyType;
  raw: string;
  rawContentType: RawContentType;
  formData: KeyValuePair[];
  urlencoded: KeyValuePair[];
}

export type AuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'api-key';

export interface AuthConfig {
  type: AuthType;
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
}

export interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  preRequestScript: string;
  testScript: string;
}

export interface FolderItem {
  id: string;
  name: string;
  auth: AuthConfig;
  preRequestScript: string;
  testScript: string;
  items: CollectionItem[];
}

export type CollectionItem = RequestItem | FolderItem;

export interface Collection {
  id: string;
  name: string;
  description: string;
  auth: AuthConfig;
  variables: KeyValuePair[];
  items: CollectionItem[];
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
}

export interface ResponseData {
  status: number;
  statusText: string;
  time: number;
  size: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
}

export type TabType = 'request' | 'collection' | 'folder' | 'environment';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  method?: HttpMethod;
  dirty: boolean;
  requestId?: string;
  collectionId?: string;
  environmentId?: string;
}

export function isFolder(item: CollectionItem): item is FolderItem {
  return !('method' in item);
}

export function isRequest(item: CollectionItem): item is RequestItem {
  return 'method' in item;
}
