import { useEffect, useId, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/store/ui"
import { useSettingsStore, type AppSettings as LocalSettings } from "@/store/settings"
import { getSettings, putSettings, BackendError } from "@/lib/backend"
import type { AppSettings as BackendSettings } from "@/lib/backend"
import { toast } from "sonner"

type Section = "general" | "proxy" | "certificates"

const NAV: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "proxy", label: "Proxy" },
  { id: "certificates", label: "Certificates" },
]

interface FormState {
  backend: BackendSettings
  local: Pick<LocalSettings, "followRedirectsDefault" | "timeoutDefault" | "noCacheHeader">
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: React.ReactNode
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  const labelId = useId()
  return (
    <div className={cn("flex items-start justify-between gap-4", disabled && "opacity-50")}>
      <div className="flex-1 min-w-0">
        <p id={labelId} className="text-xs font-medium leading-snug">
          {label}
        </p>
        {description && (
          <p className="text-[0.6875rem] text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-labelledby={labelId}
        className="shrink-0 mt-0.5"
      />
    </div>
  )
}

function Field({
  label,
  disabled,
  children,
}: {
  label: React.ReactNode
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-50")}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function GeneralSection({
  form,
  patch,
}: {
  form: FormState
  patch: (b?: Partial<BackendSettings>, l?: Partial<FormState["local"]>) => void
}) {
  return (
    <div className="space-y-6 py-1">
      <div className="space-y-3">
        <SectionTitle>Request</SectionTitle>
        <ToggleRow
          label="SSL Certificate Verification"
          description="Disable to allow self-signed or expired certificates"
          checked={form.backend.sslVerification}
          onCheckedChange={(v) => patch({ sslVerification: v })}
        />
        <ToggleRow
          label="Automatically follow redirects"
          checked={form.local.followRedirectsDefault}
          onCheckedChange={(v) => patch(undefined, { followRedirectsDefault: v })}
        />
        <Field label="Request timeout (ms)">
          <Input
            type="number"
            min={0}
            className="h-7 text-xs w-36"
            placeholder="30000"
            value={form.local.timeoutDefault}
            onChange={(e) => patch(undefined, { timeoutDefault: parseInt(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Max response size (MB)">
          <Input
            type="number"
            min={1}
            className="h-7 text-xs w-36"
            placeholder="50"
            value={form.backend.maxResponseSizeMB}
            onChange={(e) => patch({ maxResponseSizeMB: parseInt(e.target.value) || 50 })}
          />
        </Field>
        <Field label="Script timeout (ms)">
          <Input
            type="number"
            min={100}
            className="h-7 text-xs w-36"
            placeholder="5000"
            value={form.backend.scriptTimeoutMs}
            onChange={(e) => patch({ scriptTimeoutMs: parseInt(e.target.value) || 5000 })}
          />
        </Field>
      </div>

      <Separator />

      <div className="space-y-3">
        <SectionTitle>Headers</SectionTitle>
        <ToggleRow
          label="Send no-cache header"
          description="Adds Cache-Control: no-cache to every request"
          checked={form.local.noCacheHeader}
          onCheckedChange={(v) => patch(undefined, { noCacheHeader: v })}
        />
      </div>
    </div>
  )
}

function ProxySection({
  form,
  patch,
}: {
  form: FormState
  patch: (b?: Partial<BackendSettings>) => void
}) {
  return (
    <div className="space-y-6 py-1">
      <div className="space-y-3">
        <SectionTitle>System proxy</SectionTitle>
        <ToggleRow
          label="Use system proxy"
          description="Use the OS-level proxy configuration"
          checked={form.backend.useSystemProxy}
          onCheckedChange={(v) => patch({ useSystemProxy: v })}
        />
        <ToggleRow
          label="Respect HTTP_PROXY / HTTPS_PROXY / NO_PROXY"
          description="Read proxy settings from environment variables"
          checked={form.backend.respectEnvProxy}
          onCheckedChange={(v) => patch({ respectEnvProxy: v })}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <SectionTitle>Custom proxy server</SectionTitle>
        <Field label="URL">
          <Input
            className="h-7 text-xs font-mono"
            placeholder="http://proxy.example.com:3128"
            value={form.backend.proxyUrl}
            onChange={(e) => patch({ proxyUrl: e.target.value })}
          />
        </Field>
      </div>

      <Separator />

      <div className="space-y-3">
        <SectionTitle>Proxy authentication</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username">
            <Input
              className="h-7 text-xs"
              placeholder="username"
              value={form.backend.proxyUsername}
              onChange={(e) => patch({ proxyUsername: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <Input
              className="h-7 text-xs"
              type="password"
              placeholder="password"
              value={form.backend.proxyPassword}
              onChange={(e) => patch({ proxyPassword: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <SectionTitle>Bypass</SectionTitle>
        <Field label="No proxy (comma-separated hosts)">
          <Input
            className="h-7 text-xs font-mono"
            placeholder="localhost,127.0.0.1,.internal"
            value={form.backend.noProxy}
            onChange={(e) => patch({ noProxy: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

function CertificatesSection() {
  return (
    <div className="space-y-6 py-1">
      <div className="space-y-3">
        <SectionTitle>CA Certificates</SectionTitle>
        <p className="text-xs text-muted-foreground">
          Custom CA certificate and client certificate management is not yet available.
        </p>
      </div>
    </div>
  )
}

export function SettingsDialog() {
  const { settingsOpen, setSettingsOpen } = useUiStore()
  const localStore = useSettingsStore()
  const [section, setSection] = useState<Section>("general")
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settingsOpen) return
    getSettings()
      .then((backend) =>
        setForm({
          backend,
          local: {
            followRedirectsDefault: localStore.followRedirectsDefault,
            timeoutDefault: localStore.timeoutDefault,
            noCacheHeader: localStore.noCacheHeader,
          },
        }),
      )
      .catch(() => toast.error("Failed to load settings"))
  }, [settingsOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (b?: Partial<BackendSettings>, l?: Partial<FormState["local"]>) =>
    setForm((prev) =>
      prev
        ? {
            backend: b ? { ...prev.backend, ...b } : prev.backend,
            local: l ? { ...prev.local, ...l } : prev.local,
          }
        : prev,
    )

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const updated = await putSettings(form.backend)
      localStore.update(form.local)
      setForm((prev) => (prev ? { ...prev, backend: updated } : prev))
      toast.success("Settings saved")
      setSettingsOpen(false)
    } catch (err) {
      toast.error(err instanceof BackendError ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm(null)
    setSettingsOpen(false)
  }

  return (
    <Sheet
      open={settingsOpen}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
    >
      <SheetContent side="right" className="!w-[33vw] !max-w-none flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-3.5 border-b border-border shrink-0">
          <SheetTitle className="text-sm font-medium">Settings</SheetTitle>
        </SheetHeader>

        {!form ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <nav className="w-[140px] shrink-0 border-r border-border py-2 flex flex-col gap-0.5 px-2">
              {NAV.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors",
                    section === id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>

            <ScrollArea className="flex-1">
              <div className="px-5 py-4">
                {section === "general" && <GeneralSection form={form} patch={patch} />}
                {section === "proxy" && <ProxySection form={form} patch={patch} />}
                {section === "certificates" && <CertificatesSection />}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="px-4 py-3 border-t border-border shrink-0 flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!form || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
