import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useSettingsStore } from '@/store/settings';
import { useUiStore } from '@/store/ui';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useUiStore();
  const s = useSettingsStore();

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
        </DialogHeader>
        <Separator />
        <ScrollArea className="max-h-[70vh]">
          <div className="px-5 py-4 space-y-5">

            <Section title="Network defaults">
              <Row label="SSL Verification" hint="Verify SSL certificates by default">
                <Switch checked={s.sslVerifyDefault} onCheckedChange={(v) => s.update({ sslVerifyDefault: v })} />
              </Row>
              <Row label="Follow Redirects">
                <Switch checked={s.followRedirectsDefault} onCheckedChange={(v) => s.update({ followRedirectsDefault: v })} />
              </Row>
              <Row label="Timeout (ms)" hint="0 = no timeout">
                <Input
                  type="number"
                  value={s.timeoutDefault}
                  min={0}
                  onChange={(e) => s.update({ timeoutDefault: parseInt(e.target.value) || 0 })}
                  className="h-6 w-24 text-xs"
                />
              </Row>
            </Section>

            <Section title="Proxy">
              <Row label="Enable Proxy">
                <Switch
                  checked={s.proxy.enabled}
                  onCheckedChange={(v) => s.update({ proxy: { ...s.proxy, enabled: v } })}
                />
              </Row>
              {s.proxy.enabled && (
                <div className="py-2 space-y-2">
                  <Input
                    value={s.proxy.url}
                    placeholder="http://proxy.example.com:8080"
                    onChange={(e) => s.update({ proxy: { ...s.proxy, url: e.target.value } })}
                    className="h-7 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={s.proxy.username}
                      placeholder="Username"
                      onChange={(e) => s.update({ proxy: { ...s.proxy, username: e.target.value } })}
                      className="h-7 text-xs"
                    />
                    <Input
                      type="password"
                      value={s.proxy.password}
                      placeholder="Password"
                      onChange={(e) => s.update({ proxy: { ...s.proxy, password: e.target.value } })}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              )}
            </Section>

            <Section title="Editor">
              <Row label="Font size" hint={`${s.editorFontSize}px`}>
                <Slider
                  value={[s.editorFontSize]}
                  min={10}
                  max={18}
                  step={1}
                  onValueChange={([v]) => s.update({ editorFontSize: v })}
                  className="w-28"
                />
              </Row>
              <Row label="Word wrap by default">
                <Switch
                  checked={s.editorWordWrap}
                  onCheckedChange={(v) => s.update({ editorWordWrap: v })}
                />
              </Row>
            </Section>

          </div>
        </ScrollArea>
        <Separator />
        <div className="flex justify-between items-center px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => s.reset()}
          >
            Reset to defaults
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => setSettingsOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
