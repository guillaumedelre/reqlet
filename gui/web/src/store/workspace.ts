import { create } from 'zustand';
import type { Collection, Environment, KeyValuePair } from '@/types';

let _id = 0;
function uid(): string { return `id-${++_id}`; }
function kv(key: string, value: string): KeyValuePair {
  return { id: uid(), enabled: true, key, value, description: '' };
}

const MOCK_COLLECTIONS: Collection[] = [
  {
    id: 'col-1',
    name: 'Reqlet API',
    description: 'Core Reqlet workspace API',
    auth: { type: 'bearer', bearer: { token: '{{accessToken}}' } },
    variables: [kv('baseUrl', 'http://localhost:3001'), kv('apiVersion', 'v1')],
    items: [
      {
        id: 'f-auth',
        name: 'Authentication',
        auth: { type: 'inherit' },
        preRequestScript: '',
        testScript: '',
        items: [
          {
            id: 'r-login',
            name: 'Login',
            method: 'POST',
            url: '{{baseUrl}}/api/auth/login',
            params: [],
            headers: [kv('Content-Type', 'application/json')],
            body: {
              type: 'raw',
              raw: '{\n  "email": "user@example.com",\n  "password": "secret"\n}',
              rawContentType: 'application/json',
              formData: [],
              urlencoded: [],
            },
            auth: { type: 'none' },
            preRequestScript: '',
            testScript: 'pm.test("Status 200", () => pm.response.to.have.status(200));\npm.test("Token present", () => {\n  const body = pm.response.json();\n  pm.expect(body.token).to.be.a("string");\n  pm.environment.set("accessToken", body.token);\n});',
          },
          {
            id: 'r-refresh',
            name: 'Refresh Token',
            method: 'POST',
            url: '{{baseUrl}}/api/auth/refresh',
            params: [],
            headers: [],
            body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
          {
            id: 'r-logout',
            name: 'Logout',
            method: 'DELETE',
            url: '{{baseUrl}}/api/auth/session',
            params: [],
            headers: [],
            body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
        ],
      },
      {
        id: 'f-collections',
        name: 'Collections',
        auth: { type: 'inherit' },
        preRequestScript: '',
        testScript: '',
        items: [
          {
            id: 'r-list-cols',
            name: 'List Collections',
            method: 'GET',
            url: '{{baseUrl}}/api/collections',
            params: [
              kv('page', '1'),
              { id: uid(), enabled: false, key: 'limit', value: '20', description: 'Page size' },
            ],
            headers: [],
            body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: 'pm.test("Status 200", () => pm.response.to.have.status(200));',
          },
          {
            id: 'r-create-col',
            name: 'Create Collection',
            method: 'POST',
            url: '{{baseUrl}}/api/collections',
            params: [],
            headers: [],
            body: {
              type: 'raw',
              raw: '{\n  "name": "My New Collection",\n  "description": ""\n}',
              rawContentType: 'application/json',
              formData: [],
              urlencoded: [],
            },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
          {
            id: 'r-get-col',
            name: 'Get Collection',
            method: 'GET',
            url: '{{baseUrl}}/api/collections/:id',
            params: [],
            headers: [],
            body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
          {
            id: 'r-update-col',
            name: 'Update Collection',
            method: 'PUT',
            url: '{{baseUrl}}/api/collections/:id',
            params: [],
            headers: [],
            body: { type: 'raw', raw: '{\n  "name": "Updated Name"\n}', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
          {
            id: 'r-delete-col',
            name: 'Delete Collection',
            method: 'DELETE',
            url: '{{baseUrl}}/api/collections/:id',
            params: [],
            headers: [],
            body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
        ],
      },
      {
        id: 'f-environments',
        name: 'Environments',
        auth: { type: 'inherit' },
        preRequestScript: '',
        testScript: '',
        items: [
          {
            id: 'r-list-envs',
            name: 'List Environments',
            method: 'GET',
            url: '{{baseUrl}}/api/environments',
            params: [],
            headers: [],
            body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
          {
            id: 'r-create-env',
            name: 'Create Environment',
            method: 'POST',
            url: '{{baseUrl}}/api/environments',
            params: [],
            headers: [],
            body: { type: 'raw', raw: '{\n  "name": "Production"\n}', rawContentType: 'application/json', formData: [], urlencoded: [] },
            auth: { type: 'inherit' },
            preRequestScript: '',
            testScript: '',
          },
        ],
      },
    ],
  },
  {
    id: 'col-2',
    name: 'GitHub API',
    description: 'GitHub REST API v3',
    auth: { type: 'bearer', bearer: { token: '{{githubToken}}' } },
    variables: [kv('baseUrl', 'https://api.github.com'), kv('owner', 'reqlet'), kv('repo', 'reqlet')],
    items: [
      {
        id: 'r-gh-user',
        name: 'Get Authenticated User',
        method: 'GET',
        url: '{{baseUrl}}/user',
        params: [],
        headers: [kv('Accept', 'application/vnd.github.v3+json')],
        body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
        auth: { type: 'inherit' },
        preRequestScript: '',
        testScript: '',
      },
      {
        id: 'r-gh-repos',
        name: 'List Repositories',
        method: 'GET',
        url: '{{baseUrl}}/user/repos',
        params: [kv('sort', 'updated'), kv('per_page', '30'), kv('visibility', 'all')],
        headers: [kv('Accept', 'application/vnd.github.v3+json')],
        body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
        auth: { type: 'inherit' },
        preRequestScript: '',
        testScript: '',
      },
      {
        id: 'r-gh-create-issue',
        name: 'Create Issue',
        method: 'POST',
        url: '{{baseUrl}}/repos/{{owner}}/{{repo}}/issues',
        params: [],
        headers: [kv('Accept', 'application/vnd.github.v3+json')],
        body: {
          type: 'raw',
          raw: '{\n  "title": "Bug: unexpected behavior",\n  "body": "## Description\\n\\nSteps to reproduce:",\n  "labels": ["bug"]\n}',
          rawContentType: 'application/json',
          formData: [],
          urlencoded: [],
        },
        auth: { type: 'inherit' },
        preRequestScript: '',
        testScript: '',
      },
    ],
  },
];

const MOCK_ENVIRONMENTS: Environment[] = [
  {
    id: 'env-dev',
    name: 'Development',
    variables: [
      kv('baseUrl', 'http://localhost:3001'),
      { id: uid(), enabled: true, key: 'accessToken', value: '', description: 'JWT access token' },
      kv('apiVersion', 'v1'),
    ],
  },
  {
    id: 'env-staging',
    name: 'Staging',
    variables: [
      kv('baseUrl', 'https://staging.reqlet.dev'),
      { id: uid(), enabled: true, key: 'accessToken', value: '', description: '' },
    ],
  },
  {
    id: 'env-prod',
    name: 'Production',
    variables: [
      kv('baseUrl', 'https://api.reqlet.dev'),
      { id: uid(), enabled: true, key: 'accessToken', value: '', description: '' },
    ],
  },
];

interface WorkspaceState {
  collections: Collection[];
  environments: Environment[];
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  isExpanded: (id: string) => boolean;
  findRequest: (id: string) => RequestWithCollection | null;
}

interface RequestWithCollection {
  request: import('@/types').RequestItem;
  collectionId: string;
}

function findRequestInItems(
  items: import('@/types').CollectionItem[],
  id: string,
  collectionId: string,
): RequestWithCollection | null {
  for (const item of items) {
    if ('method' in item) {
      if (item.id === id) return { request: item, collectionId };
    } else {
      const found = findRequestInItems(item.items, id, collectionId);
      if (found) return found;
    }
  }
  return null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  collections: MOCK_COLLECTIONS,
  environments: MOCK_ENVIRONMENTS,
  expandedIds: new Set(['col-1', 'f-auth', 'f-collections']),

  toggleExpand: (id) =>
    set((state) => {
      const next = new Set(state.expandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedIds: next };
    }),

  isExpanded: (id) => get().expandedIds.has(id),

  findRequest: (id) => {
    for (const col of get().collections) {
      const found = findRequestInItems(col.items, id, col.id);
      if (found) return found;
    }
    return null;
  },
}));
