import { Search, Sun, Moon, Monitor, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { useTheme } from '@/hooks/use-theme';
import { useUiStore } from '@/store/ui';
import { useWorkspaceStore } from '@/store/workspace';

export function HeaderBar() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { activeEnvironmentId, setActiveEnvironment, setSearchOpen, setSettingsOpen } = useUiStore();
  const { environments } = useWorkspaceStore();

  return (
    <header className="h-10 flex items-center gap-2 px-3 border-b border-border bg-card shrink-0 select-none">
      {/* Logo + workspace */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-[9px] font-black tracking-tight leading-none">R</span>
        </div>
        <span className="text-[13px] font-semibold text-foreground">My Workspace</span>
      </div>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Environment */}
      <Select
        value={activeEnvironmentId ?? '__none__'}
        onValueChange={(v) => setActiveEnvironment(v === '__none__' ? null : v)}
      >
        <SelectTrigger className="h-6 w-32 text-xs rounded-md border-border/60 bg-transparent hover:bg-muted/50 gap-1">
          <SelectValue placeholder="No Environment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" className="text-xs">No Environment</SelectItem>
          {environments.map((env) => (
            <SelectItem key={env.id} value={env.id} className="text-xs">
              {env.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {/* Search */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-3 w-3" />
            <span className="hidden sm:inline">Search</span>
            <Kbd className="hidden sm:inline-flex text-[10px] h-4">⌘K</Kbd>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">Search (⌘K)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-4" />

      {/* Theme */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={toggleTheme}
          >
            {theme === 'system' ? (
              <Monitor className="h-3.5 w-3.5" />
            ) : isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          {theme === 'light' ? 'Switch to dark' : theme === 'dark' ? 'Switch to system' : 'Switch to light'}
        </TooltipContent>
      </Tooltip>

      {/* Settings */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">Settings</TooltipContent>
      </Tooltip>
    </header>
  );
}
