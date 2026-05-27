import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/app-layout';
import { SearchModal } from '@/components/search-modal';
import { SettingsModal } from '@/components/settings-modal';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTabsStore } from '@/store/tabs';
import { useUiStore } from '@/store/ui';

function KeyboardShortcuts() {
  const { activeTabId, openNewTab, closeTab, reopenLastClosedTab } = useTabsStore();
  const { setSearchOpen } = useUiStore();

  useKeyboardShortcut('t', openNewTab, true);
  useKeyboardShortcut('w', () => closeTab(activeTabId), true);
  useKeyboardShortcut('t', reopenLastClosedTab, true, true);
  useKeyboardShortcut('k', () => setSearchOpen(true), true);

  return null;
}

export default function App() {
  useTheme();
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={100}>
      <KeyboardShortcuts />
      <AppLayout />
      <SearchModal />
      <SettingsModal />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
