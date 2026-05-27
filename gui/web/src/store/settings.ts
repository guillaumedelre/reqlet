import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppSettings {
  sslVerifyDefault: boolean;
  followRedirectsDefault: boolean;
  timeoutDefault: number;
  proxy: { enabled: boolean; url: string; username: string; password: string };
  editorFontSize: number;
  editorWordWrap: boolean;
}

const DEFAULTS: AppSettings = {
  sslVerifyDefault: true,
  followRedirectsDefault: true,
  timeoutDefault: 30000,
  proxy: { enabled: false, url: '', username: '', password: '' },
  editorFontSize: 12,
  editorWordWrap: true,
};

interface SettingsState extends AppSettings {
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      update: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: 'reqlet-settings' },
  ),
);
