import { X, Plus } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MethodBadge } from '@/components/method-badge';
import { cn } from '@/lib/utils';
import { useTabsStore } from '@/store/tabs';
import type { Tab } from '@/types';

interface TabItemProps {
  tab: Tab;
  active: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}

function TabItem({ tab, active, onSelect, onClose }: TabItemProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-1.5 h-full pl-2.5 pr-1.5 border-r border-border cursor-pointer select-none shrink-0 transition-colors max-w-[180px]',
        active
          ? 'bg-background text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-primary'
          : 'bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
      onClick={onSelect}
    >
      {tab.method && <MethodBadge method={tab.method} className="shrink-0" />}

      <span className="text-[12px] truncate leading-none max-w-[100px]">{tab.title}</span>

      {tab.dirty && (
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
      )}

      <button
        onClick={onClose}
        className={cn(
          'h-4 w-4 flex items-center justify-center rounded shrink-0 transition-opacity',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          active ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100',
        )}
        aria-label="Close tab"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, openNewTab } = useTabsStore();

  return (
    <div className="h-8 flex items-stretch border-b border-border bg-card shrink-0 overflow-hidden">
      <ScrollArea className="flex-1 h-full" type="scroll">
        <div className="flex items-stretch h-8">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              onSelect={() => setActiveTab(tab.id)}
              onClose={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-0.5" />
      </ScrollArea>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={openNewTab}
            className="h-8 w-8 flex items-center justify-center shrink-0 border-l border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="New tab"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">New Request (⌘T)</TooltipContent>
      </Tooltip>
    </div>
  );
}
