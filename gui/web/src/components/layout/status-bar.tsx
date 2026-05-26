import { Circle, Wifi } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspace';
import { useUiStore } from '@/store/ui';
import { useTabsStore } from '@/store/tabs';

export function StatusBar() {
  const { environments } = useWorkspaceStore();
  const { activeEnvironmentId, response } = useUiStore();
  const { tabs, activeTabId } = useTabsStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  return (
    <div className="h-5 flex items-center gap-4 px-3 border-t border-border bg-card shrink-0 select-none">
      {/* Connected */}
      <div className="flex items-center gap-1">
        <Wifi className="h-2.5 w-2.5 text-emerald-500" />
        <span className="text-[10px] text-muted-foreground">Connected</span>
      </div>

      <div className="h-3 w-px bg-border" />

      {/* Environment */}
      <div className="flex items-center gap-1">
        <Circle className="h-1.5 w-1.5 fill-current text-primary" />
        <span className="text-[10px] text-muted-foreground">
          {activeEnv ? activeEnv.name : 'No Environment'}
        </span>
      </div>

      {activeTab && (
        <>
          <div className="h-3 w-px bg-border" />
          <span className="text-[10px] text-muted-foreground truncate max-w-48">
            {activeTab.title}
          </span>
        </>
      )}

      <div className="flex-1" />

      {response && (
        <span className="text-[10px] text-muted-foreground font-mono">
          {response.status} · {response.time}ms
        </span>
      )}

      <span className="text-[10px] text-muted-foreground">Reqlet v0.1.0</span>
    </div>
  );
}
