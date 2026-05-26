import { useEffect, useState, useCallback } from 'react';
import { Send, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MethodBadge } from '@/components/method-badge';
import { cn } from '@/lib/utils';
import { HTTP_METHODS } from '@/lib/http';
import { useTabsStore } from '@/store/tabs';
import { useUiStore } from '@/store/ui';
import { useWorkspaceStore } from '@/store/workspace';
import type { HttpMethod, KeyValuePair, RequestBody, AuthConfig, RawContentType } from '@/types';

// ---------- Key-Value Table ----------

interface KVRow {
  kv: KeyValuePair;
  onChange: (id: string, field: keyof KeyValuePair, value: string | boolean) => void;
  onDelete: (id: string) => void;
}

function KVRow({ kv, onChange, onDelete }: KVRow) {
  return (
    <div className="group flex items-center gap-1 px-2 py-0.5 hover:bg-muted/30 rounded transition-colors">
      <Checkbox
        checked={kv.enabled}
        onCheckedChange={(v) => onChange(kv.id, 'enabled', !!v)}
        className="h-3 w-3 shrink-0"
      />
      <Input
        value={kv.key}
        onChange={(e) => onChange(kv.id, 'key', e.target.value)}
        placeholder="Key"
        className="h-6 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary/40 rounded-none px-1"
      />
      <Input
        value={kv.value}
        onChange={(e) => onChange(kv.id, 'value', e.target.value)}
        placeholder="Value"
        className="h-6 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary/40 rounded-none px-1"
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
}: {
  pairs: KeyValuePair[];
  onChange: (id: string, field: keyof KeyValuePair, value: string | boolean) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border text-[10px] text-muted-foreground font-medium uppercase tracking-wider shrink-0">
        <span className="w-4 shrink-0" />
        <span className="flex-1">Key</span>
        <span className="flex-1">Value</span>
        <span className="w-5 shrink-0" />
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {pairs.map((kv) => (
            <KVRow key={kv.id} kv={kv} onChange={onChange} onDelete={onDelete} />
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

function BodyTab({ body, onChange }: { body: RequestBody; onChange: (b: RequestBody) => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Type selector */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border shrink-0">
        {(['none', 'raw', 'form-data', 'x-www-form-urlencoded'] as const).map((t) => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="body-type"
              checked={body.type === t}
              onChange={() => onChange({ ...body, type: t })}
              className="accent-primary h-3 w-3"
            />
            <span className={cn('text-xs', body.type === t ? 'text-foreground' : 'text-muted-foreground')}>
              {t}
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {body.type === 'none' && (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">This request does not have a body</p>
          </div>
        )}
        {body.type === 'raw' && (
          <textarea
            value={body.raw}
            onChange={(e) => onChange({ ...body, raw: e.target.value })}
            className="w-full h-full resize-none bg-transparent text-[12px] font-mono text-foreground p-3 focus:outline-none leading-relaxed"
            spellCheck={false}
            placeholder={body.rawContentType === 'application/json' ? '{\n  \n}' : ''}
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
      <textarea
        value={active === 'pre-request' ? preScript : testScript}
        onChange={(e) => active === 'pre-request' ? onPreChange(e.target.value) : onTestChange(e.target.value)}
        className="flex-1 resize-none bg-transparent text-[12px] font-mono text-foreground p-3 focus:outline-none leading-relaxed"
        spellCheck={false}
        placeholder={active === 'pre-request'
          ? '// Runs before the request is sent\npm.environment.set("token", "value");'
          : '// Runs after the response is received\npm.test("Status is 200", () => {\n  pm.response.to.have.status(200);\n});'}
      />
    </div>
  );
}

// ---------- Request state ----------

interface RequestState {
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  preRequestScript: string;
  testScript: string;
}

const DEFAULT_STATE: RequestState = {
  method: 'GET',
  url: '',
  params: [],
  headers: [],
  body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [] },
  auth: { type: 'inherit' },
  preRequestScript: '',
  testScript: '',
};

function makeKV(): KeyValuePair {
  return { id: crypto.randomUUID(), enabled: true, key: '', value: '', description: '' };
}

// ---------- Main component ----------

export function RequestPane() {
  const { tabs, activeTabId, updateTab } = useTabsStore();
  const { requestSubTab, setRequestSubTab, isSending, setSending, setResponse } = useUiStore();
  const { findRequest } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [state, setState] = useState<RequestState>(DEFAULT_STATE);

  // Load request data when active tab changes
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab.requestId) {
      const found = findRequest(activeTab.requestId);
      if (found) {
        const r = found.request;
        setState({
          method: r.method,
          url: r.url,
          params: r.params.length ? r.params : [],
          headers: r.headers.length ? r.headers : [],
          body: r.body,
          auth: r.auth,
          preRequestScript: r.preRequestScript,
          testScript: r.testScript,
        });
        return;
      }
    }
    setState({ ...DEFAULT_STATE, method: (activeTab.method ?? 'GET') as HttpMethod });
  }, [activeTab?.id, activeTab?.requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKVChange = useCallback(
    (field: 'params' | 'headers') =>
      (id: string, key: keyof KeyValuePair, value: string | boolean) => {
        setState((s) => ({
          ...s,
          [field]: s[field].map((kv) => (kv.id === id ? { ...kv, [key]: value } : kv)),
        }));
        updateTab(activeTabId, { dirty: true });
      },
    [activeTabId, updateTab],
  );

  const handleKVDelete = useCallback(
    (field: 'params' | 'headers') => (id: string) => {
      setState((s) => ({ ...s, [field]: s[field].filter((kv) => kv.id !== id) }));
    },
    [],
  );

  const handleKVAdd = useCallback(
    (field: 'params' | 'headers') => () => {
      setState((s) => ({ ...s, [field]: [...s[field], makeKV()] }));
    },
    [],
  );

  const enabledParamCount = state.params.filter((p) => p.enabled && p.key).length;
  const enabledHeaderCount = state.headers.filter((h) => h.enabled && h.key).length;
  const hasBody = state.body.type !== 'none';

  const handleSend = async () => {
    setSending(true);
    setResponse(null);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

    const status = state.method === 'DELETE' ? 204 : state.method === 'POST' ? 201 : 200;
    const bodyMap: Record<string, unknown> = {
      GET: { data: [{ id: 1, name: 'Item One', createdAt: '2025-01-15T10:30:00Z' }, { id: 2, name: 'Item Two', createdAt: '2025-02-20T14:22:00Z' }], meta: { total: 2, page: 1 } },
      POST: { id: Math.floor(Math.random() * 9000 + 1000), name: 'Created Resource', createdAt: new Date().toISOString() },
      PUT: { id: 42, name: 'Updated Resource', updatedAt: new Date().toISOString() },
      PATCH: { id: 42, patched: true, updatedAt: new Date().toISOString() },
      DELETE: null,
      OPTIONS: { allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
      HEAD: null,
    };
    const responseBody = bodyMap[state.method] ? JSON.stringify(bodyMap[state.method], null, 2) : '';
    const ms = Math.floor(280 + Math.random() * 320);

    setResponse({
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
    });
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* URL Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        {/* Method selector */}
        <Select
          value={state.method}
          onValueChange={(v) => {
            setState((s) => ({ ...s, method: v as HttpMethod }));
            updateTab(activeTabId, { method: v as HttpMethod });
          }}
        >
          <SelectTrigger className="h-8 w-28 text-xs border-border/60 shrink-0 px-2">
            <MethodBadge method={state.method} size="sm" />
          </SelectTrigger>
          <SelectContent position="popper">
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                <MethodBadge method={m} size="sm" />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* URL input */}
        <Input
          value={state.url}
          onChange={(e) => {
            setState((s) => ({ ...s, url: e.target.value }));
            updateTab(activeTabId, { title: e.target.value || 'New Request', dirty: true });
          }}
          placeholder="Enter URL or paste text"
          className="h-8 flex-1 text-[13px] font-mono bg-muted/30 border-border/60"
          spellCheck={false}
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={isSending || !state.url.trim()}
          className="h-8 px-4 text-xs font-semibold shrink-0"
        >
          {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
          Send
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs value={requestSubTab} onValueChange={(v) => setRequestSubTab(v as typeof requestSubTab)} className="flex flex-col flex-1 overflow-hidden">
        <div className="border-b border-border shrink-0 px-1">
          <TabsList className="h-8 bg-transparent gap-0 rounded-none p-0">
            {[
              { value: 'params', label: 'Params', badge: enabledParamCount > 0 ? enabledParamCount : null },
              { value: 'auth', label: 'Auth', badge: state.auth.type !== 'inherit' && state.auth.type !== 'none' ? '●' : null },
              { value: 'headers', label: 'Headers', badge: enabledHeaderCount > 0 ? enabledHeaderCount : null },
              { value: 'body', label: 'Body', badge: hasBody ? '●' : null },
              { value: 'scripts', label: 'Scripts', badge: (state.preRequestScript || state.testScript) ? '●' : null },
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
          <KVTable
            pairs={state.params}
            onChange={handleKVChange('params')}
            onDelete={handleKVDelete('params')}
            onAdd={handleKVAdd('params')}
          />
        </TabsContent>

        <TabsContent value="auth" className="flex-1 overflow-auto mt-0">
          <AuthTab auth={state.auth} onChange={(a) => setState((s) => ({ ...s, auth: a }))} />
        </TabsContent>

        <TabsContent value="headers" className="flex-1 overflow-hidden mt-0">
          <KVTable
            pairs={state.headers}
            onChange={handleKVChange('headers')}
            onDelete={handleKVDelete('headers')}
            onAdd={handleKVAdd('headers')}
          />
        </TabsContent>

        <TabsContent value="body" className="flex-1 overflow-hidden mt-0">
          <BodyTab body={state.body} onChange={(b) => setState((s) => ({ ...s, body: b }))} />
        </TabsContent>

        <TabsContent value="scripts" className="flex-1 overflow-hidden mt-0">
          <ScriptsTab
            preScript={state.preRequestScript}
            testScript={state.testScript}
            onPreChange={(v) => setState((s) => ({ ...s, preRequestScript: v }))}
            onTestChange={(v) => setState((s) => ({ ...s, testScript: v }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
