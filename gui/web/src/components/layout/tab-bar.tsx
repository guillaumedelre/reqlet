import { useRef, useState } from 'react';
import { X, Plus, FolderOpen, Folder, Globe2, Copy, XCircle } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MethodBadge } from '@/components/method-badge';
import { cn } from '@/lib/utils';
import { useTabsStore } from '@/store/tabs';
import type { Tab } from '@/types';

interface PendingClose {
  count: number;
  title: string;
  onConfirm: () => void;
}

interface TabItemProps {
  tab: Tab;
  active: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onDuplicate: () => void;
  onCloseOthers: () => void;
  onCloseRight: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function TabItem({
  tab, active, isDragOver,
  onSelect, onClose,
  onDuplicate, onCloseOthers, onCloseRight,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: TabItemProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          className={cn(
            'group relative flex items-center gap-1.5 h-full pl-2.5 pr-1.5 border-r border-border cursor-pointer select-none shrink-0 transition-colors max-w-[180px]',
            active
              ? 'bg-background text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-primary'
              : 'bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            isDragOver && 'before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-full',
          )}
          onClick={onSelect}
        >
          {tab.type === 'request' && <MethodBadge method={tab.request.method} className="shrink-0" />}
          {tab.type === 'collection' && <FolderOpen className="h-3 w-3 text-primary shrink-0" />}
          {tab.type === 'folder' && <Folder className="h-3 w-3 text-muted-foreground shrink-0" />}
          {tab.type === 'environment' && <Globe2 className="h-3 w-3 text-primary shrink-0" />}
          {tab.type === 'globals' && <Globe2 className="h-3 w-3 text-primary shrink-0" />}

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
      </ContextMenuTrigger>
      <ContextMenuContent className="text-xs">
        <ContextMenuItem className="text-xs gap-2" onSelect={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
          Duplicate Tab
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-xs gap-2" onSelect={onCloseOthers}>
          <XCircle className="h-3.5 w-3.5" />
          Close Other Tabs
        </ContextMenuItem>
        <ContextMenuItem className="text-xs gap-2" onSelect={onCloseRight}>
          <XCircle className="h-3.5 w-3.5" />
          Close Tabs to the Right
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-xs gap-2" variant="destructive" onSelect={() => onClose({ stopPropagation: () => {} } as React.MouseEvent)}>
          <X className="h-3.5 w-3.5" />
          Close Tab
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, openNewTab,
    duplicateTab, closeOtherTabs, closeTabsToRight, reorderTabs } = useTabsStore();

  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSrcIdRef = useRef<string | null>(null);
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);

  const requestClose = (count: number, title: string, onConfirm: () => void) =>
    setPendingClose({ count, title, onConfirm });

  const handleClose = (tab: Tab) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.dirty) {
      requestClose(1, tab.title, () => closeTab(tab.id));
    } else {
      closeTab(tab.id);
    }
  };

  const handleCloseOthers = (tab: Tab) => () => {
    const dirty = tabs.filter((t) => t.id !== tab.id && t.dirty);
    if (dirty.length > 0) {
      requestClose(dirty.length, dirty[0].title, () => closeOtherTabs(tab.id));
    } else {
      closeOtherTabs(tab.id);
    }
  };

  const handleCloseRight = (tab: Tab) => () => {
    const idx = tabs.findIndex((t) => t.id === tab.id);
    const dirty = idx === -1 ? [] : tabs.slice(idx + 1).filter((t) => t.dirty);
    if (dirty.length > 0) {
      requestClose(dirty.length, dirty[0].title, () => closeTabsToRight(tab.id));
    } else {
      closeTabsToRight(tab.id);
    }
  };

  const handleDragStart = (tab: Tab) => (e: React.DragEvent) => {
    setDragSrcId(tab.id);
    dragSrcIdRef.current = tab.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
  };

  const handleDragOver = (tab: Tab) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrcIdRef.current !== tab.id) {
      setDragOverId(tab.id);
    }
  };

  const handleDragLeave = (tab: Tab) => () => {
    setDragOverId((prev) => (prev === tab.id ? null : prev));
  };

  const handleDrop = (tab: Tab) => (e: React.DragEvent) => {
    e.preventDefault();
    const srcId = e.dataTransfer.getData('text/plain') || dragSrcIdRef.current;
    if (!srcId || srcId === tab.id) return;
    const fromIdx = tabs.findIndex((t) => t.id === srcId);
    const toIdx = tabs.findIndex((t) => t.id === tab.id);
    if (fromIdx !== -1 && toIdx !== -1) reorderTabs(fromIdx, toIdx);
    setDragSrcId(null);
    setDragOverId(null);
    dragSrcIdRef.current = null;
  };

  const handleDragEnd = () => {
    setDragSrcId(null);
    setDragOverId(null);
    dragSrcIdRef.current = null;
  };

  return (
    <div className="h-8 flex items-stretch border-b border-border bg-card shrink-0 overflow-hidden">
      {pendingClose && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setPendingClose(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fermer sans enregistrer ?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingClose.count === 1
                  ? `« ${pendingClose.title} » a des modifications non enregistrées. Elles seront perdues.`
                  : `${pendingClose.count} onglets ont des modifications non enregistrées. Elles seront perdues.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingClose(null)}>Continuer l'édition</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { pendingClose.onConfirm(); setPendingClose(null); }}
              >
                Fermer quand même
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <ScrollArea className="flex-1 h-full" type="scroll">
        <div className="flex items-stretch h-8">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              isDragOver={dragOverId === tab.id && dragSrcId !== tab.id}
              onSelect={() => setActiveTab(tab.id)}
              onClose={handleClose(tab)}
              onDuplicate={() => duplicateTab(tab.id)}
              onCloseOthers={handleCloseOthers(tab)}
              onCloseRight={handleCloseRight(tab)}
              onDragStart={handleDragStart(tab)}
              onDragOver={handleDragOver(tab)}
              onDragLeave={handleDragLeave(tab)}
              onDrop={handleDrop(tab)}
              onDragEnd={handleDragEnd}
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
