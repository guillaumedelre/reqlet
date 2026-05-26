import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/app-layout';
import { useTheme } from '@/hooks/use-theme';

export default function App() {
  useTheme();
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={100}>
      <AppLayout />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
