import { useCallback, useState } from 'react';
import { Send, Plus, Trash2, Loader2 } from 'lucide-react';
import { CodeSnippets } from '@/components/code-gen-dialog';
import { CodeEditor } from '@/components/ui/code-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MethodBadge } from '@/components/method-badge';
import { cn } from '@/lib/utils';
import { HTTP_METHODS, COMMON_REQUEST_HEADERS } from '@/lib/http';
import { useTabsStore } from '@/store/tabs';
import { DEFAULT_REQUEST_SETTINGS } from '@/types';
import type { HttpMethod, KeyValuePair, RequestBody, AuthConfig, RawContentType, RequestSettings } from '@/types';

// ---------- Key-Value Table ----------

interface KVRow {
  kv: KeyValuePair;
  onChange: (id: string, field: keyof KeyValuePair, value: string | boolean) => void;
  onDelete: (id: string) => void;
  keyListId?: string;
}

function KVRow({ kv, onChange, onDelete, keyListId }: KVRow) {
  return (
    <div className="group flex items-center gap-1 px-2 py-0.5 hover:bg-muted/30 rounded transition-colors">
      <Checkbox
        checked={kv.enabled}
        onCheckedChange={(v) => onChange(kv.id, 'enabled', !!v)}
        className="h-3 w-3 shrink-0"
      />
      <input
        value={kv.key}
        onChange={(e) => onChange(kv.id, 'key', e.target.value)}
        placeholder="Key"
        list={keyListId}
        className="flex-1 h-6 text-xs border-0 bg-transparent outline-none focus:border-b focus:border-primary/40 rounded-none px-1 min-w-0"
      />
      <Input
        value={kv.value}
        onChange={(e) => onChange(kv.id, 'value', e.target.value)}
        placeholder="Value"
        className="flex-1 h-6 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary/40 rounded-none px-1"
      />
      <button
        onClick={() => onDelete(kv.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5 rounded"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function KVTable({
  pairs,
  onChange,
  onDelete,
  onAdd,
  keySuggestions,
}: {
  pairs: KeyValuePair[];
  onChange: (id: string, field: keyof KeyValuePair, value: string | boolean) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  keySuggestions?: string[];
}) {
  const listId = keySuggestions ? 'kv-key-suggestions' : undefined;
  return (
    <div className="flex flex-col h-full">
      {listId && (
        <datalist id={listId}>
          {keySuggestions!.map((h) => <option key={h} value={h} />)}
        </datalist>
      )}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border text-[10px] text-muted-foreground font-medium uppercase tracking-wider shrink-0">
        <span className="w-4 shrink-0" />
        <span className="flex-1">Key</span>
        <span className="flex-1">Value</span>
        <span className="w-5 shrink-0" />
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {pairs.map((kv) => (
            <KVRow key={kv.id} kv={kv} onChange={onChange} onDelete={onDelete} keyListId={listId} />
          ))}
          <div className="px-2 pt-1">
            <button
              onClick={onAdd}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add row
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------- Auth Tab ----------

function AuthTab({ auth, onChange }: { auth: AuthConfig; onChange: (a: AuthConfig) => void }) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16 shrink-0">Type</span>
        <Select value={auth.type} onValueChange={(v) => onChange({ ...auth, type: v as AuthConfig['type'] })}>
          <SelectTrigger className="h-7 text-xs w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit" className="text-xs">Inherit from parent</SelectItem>
            <SelectItem value="none" className="text-xs">No Auth</SelectItem>
            <SelectItem value="bearer" className="text-xs">Bearer Token</SelectItem>
            <SelectItem value="basic" className="text-xs">Basic Auth</SelectItem>
            <SelectItem value="api-key" className="text-xs">API Key</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {auth.type === 'bearer' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0">Token</span>
          <Input
            value={auth.bearer?.token ?? ''}
            onChange={(e) => onChange({ ...auth, bearer: { token: e.target.value } })}
            placeholder="{{accessToken}}"
            className="h-7 text-xs flex-1"
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Username</span>
            <Input
              value={auth.basic?.username ?? ''}
              onChange={(e) => onChange({ ...auth, basic: { ...auth.basic, username: e.target.value, password: auth.basic?.password ?? '' } })}
              className="h-7 text-xs flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Password</span>
            <Input
              type="password"
              value={auth.basic?.password ?? ''}
              onChange={(e) => onChange({ ...auth, basic: { ...auth.basic, password: e.target.value, username: auth.basic?.username ?? '' } })}
              className="h-7 text-xs flex-1"
            />
          </div>
        </>
      )}

      {auth.type === 'api-key' && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Key</span>
            <Input value={auth.apiKey?.key ?? ''} placeholder="X-API-Key" className="h-7 text-xs flex-1" onChange={(e) => onChange({ ...auth, apiKey: { ...auth.apiKey!, key: e.target.value } })} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Value</span>
            <Input value={auth.apiKey?.value ?? ''} className="h-7 text-xs flex-1" onChange={(e) => onChange({ ...auth, apiKey: { ...auth.apiKey!, value: e.target.value } })} />
          </div>
        </>
      )}

      {(auth.type === 'inherit' || auth.type === 'none') && (
        <p className="text-xs text-muted-foreground">
          {auth.type === 'inherit'
            ? 'Authorization will be inherited from the parent collection or folder.'
            : 'No authorization will be sent with this request.'}
        </p>
      )}
    </div>
  );
}

// ---------- Body Tab ----------

const RAW_TYPES: RawContentType[] = [
  'application/json',
  'application/xml',
  'text/plain',
  'text/html',
  'application/javascript',
];

const RAW_TYPE_LABELS: Record<RawContentType, string> = {
  'application/json': 'JSON',
  'application/xml': 'XML',
  'text/plain': 'Text',
  'text/html': 'HTML',
  'application/javascript': 'JavaScript',
};

const RAW_TYPE_LANG: Record<RawContentType, string> = {
  'application/json': 'json',
  'application/xml': 'xml',
  'text/plain': 'plaintext',
  'text/html': 'html',
  'application/javascript': 'javascript',
};

const BODY_TYPE_LABELS: Record<string, string> = {
  none: 'none',
  raw: 'raw',
  'form-data': 'form-data',
  'x-www-form-urlencoded': 'x-www-form-urlencoded',
  binary: 'binary',
  graphql: 'GraphQL',
};

function BodyTab({ body, onChange }: { body: RequestBody; onChange: (b: RequestBody) => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border shrink-0 flex-wrap">
        {(['none', 'raw', 'form-data', 'x-www-form-urlencoded', 'binary', 'graphql'] as const).map((t) => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="body-type"
              checked={body.type === t}
              onChange={() => onChange({ ...body, type: t })}
              className="accent-primary h-3 w-3"
            />
            <span className={cn('text-xs', body.type === t ? 'text-foreground' : 'text-muted-foreground')}>
              {BODY_TYPE_LABELS[t]}
            </span>
          </label>
        ))}

        {body.type === 'raw' && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <Select
              value={body.rawContentType}
              onValueChange={(v) => onChange({ ...body, rawContentType: v as RawContentType })}
            >
              <SelectTrigger className="h-5 w-28 text-[11px] border-0 bg-transparent p-0 gap-1 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RAW_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{RAW_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {body.type === 'none' && (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">This request does not have a body</p>
          </div>
        )}
        {body.type === 'raw' && (
          <CodeEditor
            value={body.raw}
            onChange={(v) => onChange({ ...body, raw: v })}
            language={RAW_TYPE_LANG[body.rawContentType] ?? 'plaintext'}
          />
        )}
        {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
          <KVTable
            pairs={body.type === 'form-data' ? body.formData : body.urlencoded}
            onChange={(id, field, value) => {
              const key = body.type === 'form-data' ? 'formData' : 'urlencoded';
              onChange({
                ...body,
                [key]: body[key].map((kv) => (kv.id === id ? { ...kv, [field]: value } : kv)),
              });
            }}
            onDelete={(id) => {
              const key = body.type === 'form-data' ? 'formData' : 'urlencoded';
              onChange({ ...body, [key]: body[key].filter((kv) => kv.id !== id) });
            }}
            onAdd={() => {
              const key = body.type === 'form-data' ? 'formData' : 'urlencoded';
              onChange({
                ...body,
                [key]: [...body[key], { id: crypto.randomUUID(), enabled: true, key: '', value: '', description: '' }],
              });
            }}
          />
        )}
        {body.type === 'binary' && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <label className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="border-2 border-dashed border-border rounded-lg px-8 py-6 text-center group-hover:border-primary/40 transition-colors">
                <p className="text-xs text-muted-foreground">Click to select a file</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Any file type</p>
              </div>
              <input type="file" className="hidden" onChange={() => {}} />
            </label>
          </div>
        )}
        {body.type === 'graphql' && (
          <div className="flex flex-col h-full">
            <div className="flex-[2] overflow-hidden border-b border-border">
              <div className="flex items-center px-3 h-6 border-b border-border/50 bg-muted/20">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Query</span>
              </div>
              <div className="h-[calc(100%-1.5rem)]">
                <CodeEditor
                  value={body.graphqlQuery}
                  onChange={(v) => onChange({ ...body, graphqlQuery: v })}
                  language="graphql"
                />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center px-3 h-6 border-b border-border/50 bg-muted/20">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Variables</span>
              </div>
              <div className="h-[calc(100%-1.5rem)]">
                <CodeEditor
                  value={body.graphqlVariables}
                  onChange={(v) => onChange({ ...body, graphqlVariables: v })}
                  language="json"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Scripts Tab ----------

function ScriptsTab({
  preScript,
  testScript,
  onPreChange,
  onTestChange,
}: {
  preScript: string;
  testScript: string;
  onPreChange: (v: string) => void;
  onTestChange: (v: string) => void;
}) {
  const [active, setActive] = useState<'pre-request' | 'test'>('pre-request');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-0 border-b border-border px-3 shrink-0">
        {(['pre-request', 'test'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={cn(
              'px-3 py-1.5 text-xs border-b-2 transition-colors',
              active === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'pre-request' ? 'Pre-request Script' : 'Tests'}
            {t === 'test' && testScript && (
              <Badge variant="secondary" className="ml-1.5 h-4 text-[9px] px-1">JS</Badge>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          value={active === 'pre-request' ? preScript : testScript}
          onChange={(v) => (active === 'pre-request' ? onPreChange(v) : onTestChange(v))}
          language="javascript"
        />
      </div>
    </div>
  );
}

// ---------- Request settings ----------

function SRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <div>
        <p className="text-xs text-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 pt-1">{title}</p>
      {children}
    </div>
  );
}

function SettingsTab({ settings, onChange }: { settings: RequestSettings; onChange: (s: RequestSettings) => void }) {
  const set = <K extends keyof RequestSettings>(key: K, value: RequestSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <SSection title="General">
          <SRow label="Follow Redirects">
            <Switch checked={settings.followRedirects} onCheckedChange={(v) => set('followRedirects', v)} />
          </SRow>
          <SRow label="Max Redirects" hint="Only when Follow Redirects is on">
            <Input type="number" value={settings.maxRedirects} min={0} max={30}
              disabled={!settings.followRedirects}
              onChange={(e) => set('maxRedirects', parseInt(e.target.value) || 0)}
              className="h-6 w-16 text-xs" />
          </SRow>
          <SRow label="Timeout (ms)" hint="0 = no timeout">
            <Input type="number" value={settings.timeout} min={0}
              onChange={(e) => set('timeout', parseInt(e.target.value) || 0)}
              className="h-6 w-20 text-xs" />
          </SRow>
          <SRow label="Encode URL">
            <Switch checked={settings.encodeUrl} onCheckedChange={(v) => set('encodeUrl', v)} />
          </SRow>
          <SRow label="Cookie Jar">
            <Switch checked={settings.cookieJar} onCheckedChange={(v) => set('cookieJar', v)} />
          </SRow>
        </SSection>

        <SSection title="SSL / TLS">
          <SRow label="Verify SSL Certificate" hint="Disable only for local/self-signed certs">
            <Switch checked={settings.sslVerify} onCheckedChange={(v) => set('sslVerify', v)} />
          </SRow>
        </SSection>

        <SSection title="HTTP">
          <SRow label="HTTP Version">
            <Select value={settings.httpVersion} onValueChange={(v) => set('httpVersion', v as RequestSettings['httpVersion'])}>
              <SelectTrigger className="h-6 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                <SelectItem value="http1" className="text-xs">HTTP/1.x</SelectItem>
                <SelectItem value="http2" className="text-xs">HTTP/2</SelectItem>
              </SelectContent>
            </Select>
          </SRow>
        </SSection>

        <SSection title="Redirect Behavior">
          <SRow label="Follow Original Method" hint="Preserve GET/POST on 301/302">
            <Switch checked={settings.followOriginalMethod} onCheckedChange={(v) => set('followOriginalMethod', v)} />
          </SRow>
          <SRow label="Send Auth on Redirect">
            <Switch checked={settings.followAuthHeader} onCheckedChange={(v) => set('followAuthHeader', v)} />
          </SRow>
          <SRow label="Remove Referer on Redirect">
            <Switch checked={settings.removeReferer} onCheckedChange={(v) => set('removeReferer', v)} />
          </SRow>
        </SSection>

        <SSection title="Proxy">
          <SRow label="Use Proxy">
            <Switch checked={settings.proxy.enabled}
              onCheckedChange={(v) => set('proxy', { ...settings.proxy, enabled: v })} />
          </SRow>
          {settings.proxy.enabled && (
            <div className="space-y-2 pt-2 pb-1">
              <Input value={settings.proxy.url} placeholder="http://proxy.example.com:8080"
                onChange={(e) => set('proxy', { ...settings.proxy, url: e.target.value })}
                className="h-7 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={settings.proxy.username} placeholder="Username"
                  onChange={(e) => set('proxy', { ...settings.proxy, username: e.target.value })}
                  className="h-7 text-xs" />
                <Input type="password" value={settings.proxy.password} placeholder="Password"
                  onChange={(e) => set('proxy', { ...settings.proxy, password: e.target.value })}
                  className="h-7 text-xs" />
              </div>
            </div>
          )}
        </SSection>

        <div className="pt-1">
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onChange({ ...DEFAULT_REQUEST_SETTINGS })}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </ScrollArea>
  );
}

// ---------- Path variables ----------

function extractPathVarKeys(url: string): string[] {
  const pathPart = url.split('?')[0];
  // Remove protocol://host:port
  let path = pathPart.replace(/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^/]*/, '');
  // Remove {{variable}} base URL prefix (Postman-style)
  path = path.replace(/^\{\{[^}]+\}\}/, '');
  const keys = [...path.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]);
  return [...new Set(keys)];
}

function PathVarsSection({
  url,
  stored,
  onChange,
}: {
  url: string;
  stored: KeyValuePair[];
  onChange: (id: string, value: string) => void;
}) {
  const keys = extractPathVarKeys(url);
  if (!keys.length) return null;

  const rows = keys.map((key) => stored.find((p) => p.key === key) ?? { id: key, enabled: true, key, value: '', description: '' });

  return (
    <div className="border-t border-border mt-1">
      <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
        Path Variables
      </div>
      <div className="flex items-center gap-1 px-2 py-0.5 border-b border-border text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
        <span className="w-4 shrink-0" />
        <span className="flex-1">Variable</span>
        <span className="flex-1">Value</span>
        <span className="w-5 shrink-0" />
      </div>
      {rows.map((v) => (
        <div key={v.key} className="flex items-center gap-1 px-2 py-0.5 hover:bg-muted/30 rounded transition-colors">
          <span className="w-4 shrink-0" />
          <span className="flex-1 text-xs font-mono text-primary/80 px-1">:{v.key}</span>
          <Input
            value={v.value}
            onChange={(e) => onChange(v.id !== v.key ? v.id : v.key, e.target.value)}
            placeholder="Value"
            className="h-6 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary/40 rounded-none px-1 flex-1"
          />
          <span className="w-5 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------- URL ↔ Params sync ----------

function parseQueryParams(url: string): KeyValuePair[] {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return [];
  const qs = url.slice(qIdx + 1);
  return qs.split('&').filter(Boolean).map((pair) => {
    const eqIdx = pair.indexOf('=');
    return {
      id: crypto.randomUUID(),
      enabled: true,
      key: eqIdx === -1 ? pair : pair.slice(0, eqIdx),
      value: eqIdx === -1 ? '' : pair.slice(eqIdx + 1),
      description: '',
    };
  });
}

function buildUrlWithParams(url: string, params: KeyValuePair[]): string {
  const qIdx = url.indexOf('?');
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const enabled = params.filter((p) => p.enabled && p.key);
  if (enabled.length === 0) return base;
  return `${base}?${enabled.map((p) => `${p.key}=${p.value}`).join('&')}`;
}

// ---------- Main component ----------

function makeKV(): KeyValuePair {
  return { id: crypto.randomUUID(), enabled: true, key: '', value: '', description: '' };
}

export function RequestPane() {
  const { tabs, activeTabId, updateTab, updateTabRequest, setTabSubTab } = useTabsStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;
  const isSending = activeTab?.isSending ?? false;
  const requestSubTab = activeTab?.requestSubTab ?? 'params';

  const handleKVChange = useCallback(
    (field: 'params' | 'headers') =>
      (id: string, key: keyof KeyValuePair, value: string | boolean) => {
        updateTabRequest(activeTabId, (r) => {
          const newPairs = r[field].map((kv) => (kv.id === id ? { ...kv, [key]: value } : kv));
          if (field === 'params') return { ...r, params: newPairs, url: buildUrlWithParams(r.url, newPairs) };
          return { ...r, [field]: newPairs };
        });
      },
    [activeTabId, updateTabRequest],
  );

  const handleKVDelete = useCallback(
    (field: 'params' | 'headers') => (id: string) => {
      updateTabRequest(activeTabId, (r) => {
        const newPairs = r[field].filter((kv) => kv.id !== id);
        if (field === 'params') return { ...r, params: newPairs, url: buildUrlWithParams(r.url, newPairs) };
        return { ...r, [field]: newPairs };
      });
    },
    [activeTabId, updateTabRequest],
  );

  const handleKVAdd = useCallback(
    (field: 'params' | 'headers') => () => {
      updateTabRequest(activeTabId, (r) => ({ ...r, [field]: [...r[field], makeKV()] }));
    },
    [activeTabId, updateTabRequest],
  );

  const handleSend = async () => {
    if (!request) return;
    updateTab(activeTabId, { isSending: true, response: null });
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

    const status = request.method === 'DELETE' ? 204 : request.method === 'POST' ? 201 : 200;
    const bodyMap: Record<string, unknown> = {
      GET: { data: [{ id: 1, name: 'Item One', createdAt: '2025-01-15T10:30:00Z' }, { id: 2, name: 'Item Two', createdAt: '2025-02-20T14:22:00Z' }], meta: { total: 2, page: 1 } },
      POST: { id: Math.floor(Math.random() * 9000 + 1000), name: 'Created Resource', createdAt: new Date().toISOString() },
      PUT: { id: 42, name: 'Updated Resource', updatedAt: new Date().toISOString() },
      PATCH: { id: 42, patched: true, updatedAt: new Date().toISOString() },
      DELETE: null,
      OPTIONS: { allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
      HEAD: null,
    };
    const responseBody = bodyMap[request.method] ? JSON.stringify(bodyMap[request.method], null, 2) : '';
    const ms = Math.floor(280 + Math.random() * 320);

    updateTab(activeTabId, {
      isSending: false,
      response: {
        status,
        statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : 'No Content',
        time: ms,
        size: responseBody.length,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-request-id': crypto.randomUUID().slice(0, 8),
          'x-response-time': `${ms}ms`,
          'cache-control': 'no-cache',
          'access-control-allow-origin': '*',
        },
        body: responseBody,
        contentType: 'application/json',
      },
    });
  };

  if (!request) return null;

  const enabledParamCount = request.params.filter((p) => p.enabled && p.key).length;
  const enabledHeaderCount = request.headers.filter((h) => h.enabled && h.key).length;
  const hasBody = request.body.type !== 'none';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* URL Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Select
          value={request.method}
          onValueChange={(v) => {
            updateTabRequest(activeTabId, (r) => ({ ...r, method: v as HttpMethod }));
          }}
        >
          <SelectTrigger className="h-8 w-28 text-xs border-border/60 shrink-0 px-2">
            <MethodBadge method={request.method} size="sm" />
          </SelectTrigger>
          <SelectContent position="popper">
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                <MethodBadge method={m} size="sm" />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={request.url}
          onChange={(e) => {
            const newUrl = e.target.value;
            const parsed = parseQueryParams(newUrl);
            updateTab(activeTabId, { title: newUrl || 'New Request', dirty: true });
            updateTabRequest(activeTabId, (r) => ({
              ...r,
              url: newUrl,
              params: parsed.length > 0 ? parsed : newUrl.includes('?') ? [] : r.params,
            }));
          }}
          placeholder="Enter URL or paste text"
          className="h-8 flex-1 text-[13px] font-mono bg-muted/30 border-border/60"
          spellCheck={false}
        />

        <Button
          onClick={handleSend}
          disabled={isSending || !request.url.trim()}
          className="h-8 px-4 text-xs font-semibold shrink-0"
        >
          {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
          Send
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs
        value={requestSubTab}
        onValueChange={(v) => setTabSubTab(activeTabId, v as typeof requestSubTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="border-b border-border shrink-0 px-1">
          <TabsList className="h-8 bg-transparent gap-0 rounded-none p-0">
            {[
              { value: 'params', label: 'Params', badge: enabledParamCount > 0 ? enabledParamCount : null },
              { value: 'auth', label: 'Auth', badge: request.auth.type !== 'inherit' && request.auth.type !== 'none' ? '●' : null },
              { value: 'headers', label: 'Headers', badge: enabledHeaderCount > 0 ? enabledHeaderCount : null },
              { value: 'body', label: 'Body', badge: hasBody ? '●' : null },
              { value: 'scripts', label: 'Scripts', badge: (request.preRequestScript || request.testScript) ? '●' : null },
              { value: 'settings', label: 'Settings', badge: null },
              { value: 'code', label: 'Code', badge: null },
            ].map(({ value, label, badge }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-8 px-3 text-xs rounded-none border-0 border-b-2 border-transparent !bg-transparent !shadow-none data-active:border-primary data-active:text-foreground dark:data-active:!bg-transparent gap-1"
              >
                {label}
                {badge !== null && (
                  <Badge variant="secondary" className="h-3.5 min-w-3.5 px-1 text-[9px] font-bold">
                    {badge}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="params" className="flex-1 overflow-hidden mt-0">
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
              <KVTable
                pairs={request.params}
                onChange={handleKVChange('params')}
                onDelete={handleKVDelete('params')}
                onAdd={handleKVAdd('params')}
              />
            </div>
            <PathVarsSection
              url={request.url}
              stored={request.pathVariables ?? []}
              onChange={(id, value) =>
                updateTabRequest(activeTabId, (r) => {
                  const existing = r.pathVariables ?? [];
                  const updated = existing.some((p) => p.id === id || p.key === id)
                    ? existing.map((p) => (p.id === id || p.key === id ? { ...p, value } : p))
                    : [...existing, { id, enabled: true, key: id, value, description: '' }];
                  return { ...r, pathVariables: updated };
                })
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="auth" className="flex-1 overflow-auto mt-0">
          <AuthTab
            auth={request.auth}
            onChange={(a) => updateTabRequest(activeTabId, (r) => ({ ...r, auth: a }))}
          />
        </TabsContent>

        <TabsContent value="headers" className="flex-1 overflow-hidden mt-0">
          <KVTable
            pairs={request.headers}
            onChange={handleKVChange('headers')}
            onDelete={handleKVDelete('headers')}
            onAdd={handleKVAdd('headers')}
            keySuggestions={COMMON_REQUEST_HEADERS}
          />
        </TabsContent>

        <TabsContent value="body" className="flex-1 overflow-hidden mt-0">
          <BodyTab
            body={request.body}
            onChange={(b) => updateTabRequest(activeTabId, (r) => ({ ...r, body: b }))}
          />
        </TabsContent>

        <TabsContent value="scripts" className="flex-1 overflow-hidden mt-0">
          <ScriptsTab
            preScript={request.preRequestScript}
            testScript={request.testScript}
            onPreChange={(v) => updateTabRequest(activeTabId, (r) => ({ ...r, preRequestScript: v }))}
            onTestChange={(v) => updateTabRequest(activeTabId, (r) => ({ ...r, testScript: v }))}
          />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-hidden mt-0">
          <SettingsTab
            settings={request.settings ?? DEFAULT_REQUEST_SETTINGS}
            onChange={(s) => updateTabRequest(activeTabId, (r) => ({ ...r, settings: s }))}
          />
        </TabsContent>

        <TabsContent value="code" className="flex-1 overflow-hidden mt-0">
          <CodeSnippets request={request} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
