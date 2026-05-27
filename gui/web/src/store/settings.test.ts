import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from './settings';

const DEFAULTS = {
  sslVerifyDefault: true,
  followRedirectsDefault: true,
  timeoutDefault: 30000,
  proxy: { enabled: false, url: '', username: '', password: '' },
  editorFontSize: 12,
  editorWordWrap: true,
};

beforeEach(() => {
  useSettingsStore.getState().reset();
  localStorage.clear();
});

describe('initial state', () => {
  it('has ssl verify enabled by default', () => {
    expect(useSettingsStore.getState().sslVerifyDefault).toBe(true);
  });

  it('has 30s timeout by default', () => {
    expect(useSettingsStore.getState().timeoutDefault).toBe(30000);
  });
});

describe('update', () => {
  it('patches a single setting without affecting others', () => {
    useSettingsStore.getState().update({ sslVerifyDefault: false });
    expect(useSettingsStore.getState().sslVerifyDefault).toBe(false);
    expect(useSettingsStore.getState().followRedirectsDefault).toBe(true);
  });

  it('patches multiple settings at once', () => {
    useSettingsStore.getState().update({ editorFontSize: 16, editorWordWrap: false });
    expect(useSettingsStore.getState().editorFontSize).toBe(16);
    expect(useSettingsStore.getState().editorWordWrap).toBe(false);
  });

  it('patches nested proxy object', () => {
    useSettingsStore.getState().update({ proxy: { enabled: true, url: 'http://proxy:8080', username: '', password: '' } });
    expect(useSettingsStore.getState().proxy.enabled).toBe(true);
    expect(useSettingsStore.getState().proxy.url).toBe('http://proxy:8080');
  });
});

describe('reset', () => {
  it('restores all defaults after changes', () => {
    useSettingsStore.getState().update({ sslVerifyDefault: false, editorFontSize: 20, timeoutDefault: 5000 });
    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s.sslVerifyDefault).toBe(DEFAULTS.sslVerifyDefault);
    expect(s.editorFontSize).toBe(DEFAULTS.editorFontSize);
    expect(s.timeoutDefault).toBe(DEFAULTS.timeoutDefault);
  });
});
