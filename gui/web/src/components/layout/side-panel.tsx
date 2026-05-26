import { useState } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  Trash2,
  Pencil,
  Copy,
  Download,
  Upload,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MethodBadge } from '@/components/method-badge';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/store/workspace';
import { useTabsStore } from '@/store/tabs';
import { useUiStore } from '@/store/ui';
import type { Collection, CollectionItem, FolderItem, RequestItem } from '@/types';
import { isRequest } from '@/types';

// ---------- Tree nodes ----------

interface RequestNodeProps {
  item: RequestItem;
  depth: number;
}

function RequestNode({ item, depth }: RequestNodeProps) {
  const { openRequestTab } = useTabsStore();

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 h-7 pr-1 rounded cursor-pointer select-none transition-colors',
        'hover:bg-accent/60',
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={() => openRequestTab(item)}
    >
      <MethodBadge method={item.method} className="w-[46px]" />
      <span className="flex-1 text-[12px] text-foreground truncate leading-none">{item.name}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 text-xs">
          <DropdownMenuItem className="text-xs gap-2">
            <Pencil className="h-3 w-3" />Rename
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs gap-2">
            <Copy className="h-3 w-3" />Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-3 w-3" />Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface FolderNodeProps {
  item: FolderItem;
  depth: number;
}

function FolderNode({ item, depth }: FolderNodeProps) {
  const { isExpanded, toggleExpand } = useWorkspaceStore();
  const expanded = isExpanded(item.id);

  return (
    <div>
      <div
        className="group flex items-center gap-1 h-7 pr-1 rounded cursor-pointer select-none transition-colors hover:bg-accent/60"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => toggleExpand(item.id)}
      >
        <ChevronRight
          className={cn('h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-150', expanded && 'rotate-90')}
        />
        {expanded ? (
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="flex-1 text-[12px] text-foreground truncate leading-none">{item.name}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem className="text-xs gap-2">
              <FileText className="h-3 w-3" />Add Request
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2">
              <Folder className="h-3 w-3" />Add Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs gap-2">
              <Pencil className="h-3 w-3" />Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2">
              <Copy className="h-3 w-3" />Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-3 w-3" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div>
          {item.items.map((child) => (
            <TreeNode key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({ item, depth }: { item: CollectionItem; depth: number }) {
  if (isRequest(item)) return <RequestNode item={item} depth={depth} />;
  return <FolderNode item={item} depth={depth} />;
}

// ---------- Collection card ----------

function CollectionCard({ collection }: { collection: Collection }) {
  const { isExpanded, toggleExpand } = useWorkspaceStore();
  const expanded = isExpanded(collection.id);

  const requestCount = (items: CollectionItem[]): number =>
    items.reduce((acc, item) => {
      if (isRequest(item)) return acc + 1;
      return acc + requestCount(item.items);
    }, 0);

  return (
    <div className="mb-0.5">
      <div
        className="group flex items-center gap-1.5 h-8 px-2 rounded cursor-pointer select-none transition-colors hover:bg-accent/60"
        onClick={() => toggleExpand(collection.id)}
      >
        <ChevronRight
          className={cn('h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-150', expanded && 'rotate-90')}
        />
        <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="flex-1 text-[12px] font-medium text-foreground truncate leading-none">
          {collection.name}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">{requestCount(collection.items)}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem className="text-xs gap-2">
              <FileText className="h-3 w-3" />Add Request
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2">
              <Folder className="h-3 w-3" />Add Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs gap-2">
              <Pencil className="h-3 w-3" />Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2">
              <Copy className="h-3 w-3" />Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2">
              <Download className="h-3 w-3" />Export
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-3 w-3" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="pb-0.5">
          {collection.items.map((item) => (
            <TreeNode key={item.id} item={item} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Panel views ----------

function CollectionsPanel() {
  const { collections } = useWorkspaceStore();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? collections.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : collections;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Collections</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">New Collection</TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search collections…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-6 pl-6 text-xs bg-muted/40 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Import */}
      <div className="px-2 py-1 border-b border-border shrink-0">
        <button className="flex items-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5">
          <Upload className="h-3 w-3" />
          Import collection
        </button>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1 px-1 py-1">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No collections found</div>
        ) : (
          filtered.map((col) => <CollectionCard key={col.id} collection={col} />)
        )}
      </ScrollArea>
    </div>
  );
}

function EnvironmentsPanel() {
  const { environments } = useWorkspaceStore();
  const { activeEnvironmentId, setActiveEnvironment } = useUiStore();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-2 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Environments</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-0.5">
          {environments.map((env) => (
            <div
              key={env.id}
              onClick={() => setActiveEnvironment(env.id)}
              className={cn(
                'flex items-center gap-2 h-8 px-2 rounded cursor-pointer transition-colors',
                activeEnvironmentId === env.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent/60 text-foreground',
              )}
            >
              <div
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  activeEnvironmentId === env.id ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
              />
              <span className="text-[12px] truncate">{env.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{env.variables.length} vars</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function HistoryPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-2 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">History</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center px-4">
          Requests sent during this session will appear here
        </p>
      </div>
    </div>
  );
}

// ---------- Main export ----------

export function SidePanel() {
  const { activePanel } = useUiStore();

  if (!activePanel) return null;

  return (
    <div className="flex flex-col h-full border-r border-border bg-sidebar text-sidebar-foreground overflow-hidden">
      {activePanel === 'collections' && <CollectionsPanel />}
      {activePanel === 'environments' && <EnvironmentsPanel />}
      {activePanel === 'history' && <HistoryPanel />}
    </div>
  );
}
