import { Circle, Layers } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspace';
import { useUiStore } from '@/store/ui';
import { useTabsStore } from '@/store/tabs';
import { getStatusClasses, formatSize, formatTime } from '@/lib/http';
import { cn } from '@/lib/utils';

export function StatusBar() {
  const { environments } = useWorkspaceStore();
  const { activeEnvironmentId } = useUiStore();
  const { tabs, activeTabId } = useTabsStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const response = activeTab?.response ?? null;
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
  const dirtyCount = tabs.filter((t) => t.dirty).length;

  return (
    <div className="h-5 flex items-center gap-3 px-3 border-t border-border bg-card shrink-0 select-none">
      {/* Environment */}
      <div className="flex items-center gap-1">
        <Circle className="h-1.5 w-1.5 fill-current text-primary" />
        <span className="text-[10px] text-muted-foreground">
          {activeEnv ? activeEnv.name : 'No Environment'}
        </span>
      </div>

      <div className="h-3 w-px bg-border" />

      {/* Tab count */}
      <div className="flex items-center gap-1">
        <Layers className="h-2.5 w-2.5 text-muted-foreground/60" />
        <span className="text-[10px] text-muted-foreground">
          {tabs.length} tab{tabs.length !== 1 ? 's' : ''}
          {dirtyCount > 0 && <span className="text-amber-500 ml-1">· {dirtyCount} unsaved</span>}
        </span>
      </div>

      <div className="flex-1" />

      {/* Response stats */}
      {response && (
        <>
          <span className={cn('text-[10px] font-mono font-medium', getStatusClasses(response.status))}>
            {response.status} {response.statusText}
          </span>
          <div className="h-3 w-px bg-border" />
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatTime(response.time)}
          </span>
          <div className="h-3 w-px bg-border" />
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatSize(response.size)}
          </span>
          <div className="h-3 w-px bg-border" />
        </>
      )}

      <span className="text-[10px] text-muted-foreground/50">Reqlet v0.1.0</span>
    </div>
  );
}
