import { create } from 'zustand';
import type { Tab, HttpMethod, RequestItem } from '@/types';

let _seq = 1;
function nextId(): string { return `tab-${_seq++}`; }

const INITIAL_TAB: Tab = {
  id: 'tab-0',
  type: 'request',
  title: 'New Request',
  method: 'GET',
  dirty: false,
};

interface TabsState {
  tabs: Tab[];
  activeTabId: string;
  setActiveTab: (id: string) => void;
  openRequestTab: (request: RequestItem) => void;
  openNewTab: () => void;
  closeTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [INITIAL_TAB],
  activeTabId: INITIAL_TAB.id,

  setActiveTab: (id) => set({ activeTabId: id }),

  openRequestTab: (request: RequestItem) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.requestId === request.id);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const tab: Tab = {
      id: nextId(),
      type: 'request',
      title: request.name,
      method: request.method as HttpMethod,
      dirty: false,
      requestId: request.id,
    };
    set({ tabs: [...tabs, tab], activeTabId: tab.id });
  },

  openNewTab: () => {
    const tab: Tab = {
      id: nextId(),
      type: 'request',
      title: 'New Request',
      method: 'GET',
      dirty: false,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    const remaining = tabs.filter((t) => t.id !== id);
    if (remaining.length === 0) {
      const blank: Tab = { id: nextId(), type: 'request', title: 'New Request', method: 'GET', dirty: false };
      set({ tabs: [blank], activeTabId: blank.id });
      return;
    }
    const nextActive = activeTabId === id ? remaining[Math.min(idx, remaining.length - 1)].id : activeTabId;
    set({ tabs: remaining, activeTabId: nextActive });
  },

  updateTab: (id, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
}));
