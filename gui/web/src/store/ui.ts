import { create } from 'zustand';
import type { ResponseData } from '@/types';

export type SidePanel = 'collections' | 'environments' | 'history';
export type RequestSubTab = 'params' | 'auth' | 'headers' | 'body' | 'scripts';
export type ResponseSubTab = 'body' | 'headers' | 'cookies' | 'timeline';

interface UiState {
  activePanel: SidePanel | null;
  setActivePanel: (panel: SidePanel | null) => void;
  togglePanel: (panel: SidePanel) => void;

  requestSubTab: RequestSubTab;
  setRequestSubTab: (t: RequestSubTab) => void;

  responseSubTab: ResponseSubTab;
  setResponseSubTab: (t: ResponseSubTab) => void;

  activeEnvironmentId: string | null;
  setActiveEnvironment: (id: string | null) => void;

  isSending: boolean;
  setSending: (v: boolean) => void;

  response: ResponseData | null;
  setResponse: (r: ResponseData | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'collections',
  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) => set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),

  requestSubTab: 'params',
  setRequestSubTab: (t) => set({ requestSubTab: t }),

  responseSubTab: 'body',
  setResponseSubTab: (t) => set({ responseSubTab: t }),

  activeEnvironmentId: 'env-dev',
  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

  isSending: false,
  setSending: (v) => set({ isSending: v }),

  response: null,
  setResponse: (r) => set({ response: r }),
}));
