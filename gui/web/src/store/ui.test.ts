import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './ui';

beforeEach(() => {
  useUiStore.setState({
    activePanel: null,
    activeEnvironmentId: null,
    searchOpen: false,
    settingsOpen: false,
  });
  localStorage.clear();
});

describe('setActivePanel', () => {
  it('sets the active panel', () => {
    useUiStore.getState().setActivePanel('collections');
    expect(useUiStore.getState().activePanel).toBe('collections');
  });

  it('accepts null to clear the panel', () => {
    useUiStore.getState().setActivePanel('environments');
    useUiStore.getState().setActivePanel(null);
    expect(useUiStore.getState().activePanel).toBeNull();
  });
});

describe('togglePanel', () => {
  it('sets the panel when none is active', () => {
    useUiStore.getState().togglePanel('collections');
    expect(useUiStore.getState().activePanel).toBe('collections');
  });

  it('closes the panel when toggling the active one', () => {
    useUiStore.getState().setActivePanel('collections');
    useUiStore.getState().togglePanel('collections');
    expect(useUiStore.getState().activePanel).toBeNull();
  });

  it('switches to a different panel when one is already open', () => {
    useUiStore.getState().setActivePanel('collections');
    useUiStore.getState().togglePanel('environments');
    expect(useUiStore.getState().activePanel).toBe('environments');
  });
});

describe('setActiveEnvironment', () => {
  it('sets the active environment id', () => {
    useUiStore.getState().setActiveEnvironment('env-prod');
    expect(useUiStore.getState().activeEnvironmentId).toBe('env-prod');
  });

  it('accepts null to clear the active environment', () => {
    useUiStore.getState().setActiveEnvironment('env-prod');
    useUiStore.getState().setActiveEnvironment(null);
    expect(useUiStore.getState().activeEnvironmentId).toBeNull();
  });
});

describe('setSearchOpen', () => {
  it('opens the search modal', () => {
    useUiStore.getState().setSearchOpen(true);
    expect(useUiStore.getState().searchOpen).toBe(true);
  });

  it('closes the search modal', () => {
    useUiStore.getState().setSearchOpen(true);
    useUiStore.getState().setSearchOpen(false);
    expect(useUiStore.getState().searchOpen).toBe(false);
  });
});

describe('setSettingsOpen', () => {
  it('opens the settings modal', () => {
    useUiStore.getState().setSettingsOpen(true);
    expect(useUiStore.getState().settingsOpen).toBe(true);
  });

  it('closes the settings modal', () => {
    useUiStore.getState().setSettingsOpen(true);
    useUiStore.getState().setSettingsOpen(false);
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });
});
