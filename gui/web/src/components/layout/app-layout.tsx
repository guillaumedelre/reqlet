import { useState, useRef, useCallback } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { HeaderBar } from './header-bar';
import { IconRail } from './icon-rail';
import { SidePanel } from './side-panel';
import { TabBar } from './tab-bar';
import { RequestPane } from './request-pane';
import { ResponsePane } from './response-pane';
import { CollectionPane } from './collection-pane';
import { EnvironmentPane } from './environment-pane';
import { GlobalsPane } from './globals-pane';
import { StatusBar } from './status-bar';
import { useUiStore } from '@/store/ui';
import { useTabsStore } from '@/store/tabs';
import { cn } from '@/lib/utils';

const SIDE_PANEL_DEFAULT = 260;
const SIDE_PANEL_MIN = 180;
const SIDE_PANEL_MAX = 480;

export function AppLayout() {
  const { activePanel } = useUiStore();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isCollectionOrFolder = activeTab?.type === 'collection' || activeTab?.type === 'folder';
  const isEnvironment = activeTab?.type === 'environment';
  const isGlobals = activeTab?.type === 'globals';
  const [sideWidth, setSideWidth] = useState(SIDE_PANEL_DEFAULT);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = sideWidth;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      setSideWidth(Math.min(SIDE_PANEL_MAX, Math.max(SIDE_PANEL_MIN, startW.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, [sideWidth]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <HeaderBar />

      <div className="flex flex-1 overflow-hidden">
        <IconRail />

        {/* Side panel with CSS-driven width */}
        {activePanel && (
          <>
            <div
              className="shrink-0 overflow-hidden border-r border-border bg-sidebar"
              style={{ width: sideWidth }}
            >
              <SidePanel />
            </div>
            {/* Drag handle */}
            <div
              className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/40 transition-colors relative group"
              onMouseDown={onMouseDown}
            >
              <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TabBar />

          {isCollectionOrFolder ? (
            <div className="flex-1 overflow-hidden">
              <CollectionPane />
            </div>
          ) : isEnvironment ? (
            <div className="flex-1 overflow-hidden">
              <EnvironmentPane />
            </div>
          ) : isGlobals ? (
            <div className="flex-1 overflow-hidden">
              <GlobalsPane />
            </div>
          ) : (
            <ResizablePanelGroup orientation="vertical" className="flex-1 overflow-hidden">
              <ResizablePanel defaultSize={50} minSize={20} className="overflow-hidden">
                <RequestPane />
              </ResizablePanel>
              <ResizableHandle className={cn(
                'h-px bg-border hover:bg-primary/30',
                'data-[resize-handle-active]:bg-primary/40 transition-colors',
              )} />
              <ResizablePanel defaultSize={50} minSize={15} className="overflow-hidden">
                <ResponsePane />
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
