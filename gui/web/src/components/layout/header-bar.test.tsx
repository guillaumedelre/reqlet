import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderBar } from './header-bar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUiStore } from '@/store/ui';
import { useWorkspaceStore } from '@/store/workspace';
import type { Environment } from '@/types';

function renderHeader() {
  return render(
    <TooltipProvider>
      <HeaderBar />
    </TooltipProvider>,
  );
}

const ENV_A: Environment = { id: 'env-a', name: 'Production', variables: [] };
const ENV_B: Environment = { id: 'env-b', name: 'Staging', variables: [] };

function setEnvs(envs: Environment[]) {
  useWorkspaceStore.setState((s) => ({ ...s, environments: envs }));
}

function mockMatchMedia(prefersDark = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  setEnvs([]);
  useUiStore.setState((s) => ({
    ...s,
    activeEnvironmentId: null,
    searchOpen: false,
    settingsOpen: false,
  }));
  mockMatchMedia();
  // Radix Select calls scrollIntoView on the selected item — not implemented in jsdom
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Theme select — rendering
// ---------------------------------------------------------------------------

describe('theme select — rendering', () => {
  it('shows "system" by default', () => {
    renderHeader();
    expect(screen.getByText('system')).toBeInTheDocument();
  });

  it('shows "light" when stored theme is light', () => {
    localStorage.setItem('reqlet-theme', 'light');
    renderHeader();
    expect(screen.getByText('light')).toBeInTheDocument();
  });

  it('shows "dark" when stored theme is dark', () => {
    localStorage.setItem('reqlet-theme', 'dark');
    renderHeader();
    expect(screen.getByText('dark')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Theme select — interaction
// ---------------------------------------------------------------------------

describe('theme select — interaction', () => {
  it('adds dark class to <html> when Dark is selected', async () => {
    renderHeader();
    const [, themeTrigger] = screen.getAllByRole('combobox');
    act(() => fireEvent.click(themeTrigger));

    const darkOption = await screen.findByRole('option', { name: /^dark$/i });
    act(() => fireEvent.click(darkOption));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('removes dark class from <html> when Light is selected', async () => {
    localStorage.setItem('reqlet-theme', 'dark');
    document.documentElement.classList.add('dark');
    renderHeader();

    const [, themeTrigger] = screen.getAllByRole('combobox');
    act(() => fireEvent.click(themeTrigger));

    const lightOption = await screen.findByRole('option', { name: /^light$/i });
    act(() => fireEvent.click(lightOption));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('persists the selected theme to localStorage', async () => {
    renderHeader();
    const [, themeTrigger] = screen.getAllByRole('combobox');
    act(() => fireEvent.click(themeTrigger));

    const darkOption = await screen.findByRole('option', { name: /^dark$/i });
    act(() => fireEvent.click(darkOption));

    await waitFor(() => {
      expect(localStorage.getItem('reqlet-theme')).toBe('dark');
    });
  });
});

// ---------------------------------------------------------------------------
// Environment select — rendering
// ---------------------------------------------------------------------------

describe('environment select — rendering', () => {
  it('shows "No Environment" placeholder when no environment is active', () => {
    renderHeader();
    expect(screen.getByText('No Environment')).toBeInTheDocument();
  });

  it('shows the active environment name', () => {
    setEnvs([ENV_A]);
    useUiStore.setState((s) => ({ ...s, activeEnvironmentId: 'env-a' }));
    renderHeader();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Environment select — interaction
// ---------------------------------------------------------------------------

describe('environment select — interaction', () => {
  it('sets activeEnvironmentId when an environment is selected', async () => {
    setEnvs([ENV_A, ENV_B]);
    renderHeader();

    const [envTrigger] = screen.getAllByRole('combobox');
    act(() => fireEvent.click(envTrigger));

    const prodOption = await screen.findByRole('option', { name: /production/i });
    act(() => fireEvent.click(prodOption));

    await waitFor(() => {
      expect(useUiStore.getState().activeEnvironmentId).toBe('env-a');
    });
  });

  it('sets activeEnvironmentId to null when No Environment is selected', async () => {
    setEnvs([ENV_A]);
    useUiStore.setState((s) => ({ ...s, activeEnvironmentId: 'env-a' }));
    renderHeader();

    const [envTrigger] = screen.getAllByRole('combobox');
    act(() => fireEvent.click(envTrigger));

    const noneOption = await screen.findByRole('option', { name: /no environment/i });
    act(() => fireEvent.click(noneOption));

    await waitFor(() => {
      expect(useUiStore.getState().activeEnvironmentId).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Action buttons
// ---------------------------------------------------------------------------

describe('action buttons', () => {
  it('opens the search modal when the Search button is clicked', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(useUiStore.getState().searchOpen).toBe(true);
  });

  it('opens the settings modal when the Settings button is clicked', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(useUiStore.getState().settingsOpen).toBe(true);
  });
});
