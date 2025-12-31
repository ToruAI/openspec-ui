import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useSSE } from '../hooks/useApi';
import { Menu, Settings, SignalHigh, Signal, WifiOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SettingsModal } from './SettingsModal';
import type { Source } from '../types';

type View = 'kanban' | 'specs';

interface HeaderProps {
  currentView: View;
  onViewChange: (view: View) => void;
  sources: Source[];
  selectedSourceId: string | null;
  onSourceChange: (id: string | null) => void;
  showViewToggle?: boolean;
  showArchived?: boolean;
  onShowArchivedChange?: (show: boolean) => void;
  onOpenSettings?: () => void;
}

export function Header({
  currentView,
  onViewChange,
  sources,
  selectedSourceId,
  onSourceChange,
  showViewToggle = true,
  showArchived = false,
  onShowArchivedChange,
  onOpenSettings,
}: HeaderProps) {
  const { theme, toggle } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenSettings = () => {
    setSettingsOpen(true);
    onOpenSettings?.();
  };

  const ConnectionIndicator = () => {
    const { connectionStatus } = useSSE(() => {
      // Refetch will be handled by parent components
      window.location.reload();
    });

    const icons = {
      connected: <SignalHigh className="h-4 w-4 text-green-500" />,
      connecting: <Signal className="h-4 w-4 text-amber-500 animate-pulse" />,
      disconnected: <WifiOff className="h-4 w-4 text-destructive" />,
    };

    return (
      <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
        {icons[connectionStatus]}
        <span className="capitalize">{connectionStatus.replace('_', ' ')}</span>
      </div>
    );
  };

  const ViewToggle = () => (
    <nav className="flex gap-1">
      <Button
        variant={currentView === 'kanban' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('kanban')}
      >
        Kanban
      </Button>
      <Button
        variant={currentView === 'specs' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('specs')}
      >
        Specs
      </Button>
    </nav>
  );

  const SourceSelect = () => (
    <Select
      value={selectedSourceId || "all"}
      onValueChange={(val) => onSourceChange(val === "all" ? null : val)}
    >
      <SelectTrigger className="w-[160px] md:w-[200px] h-8 text-sm">
        <SelectValue placeholder="All Projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Projects</SelectItem>
        {sources.map(s => (
          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const ThemeToggle = () => (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  );

  const SettingsButton = () => (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleOpenSettings}
      aria-label="Open settings"
    >
      <Settings className="h-5 w-5" />
    </Button>
  );

  const ShowArchivedToggle = () => {
    if (currentView !== 'kanban' || !onShowArchivedChange) {
      return null;
    }
    return (
      <Button
        variant={showArchived ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onShowArchivedChange(!showArchived)}
        aria-label="Toggle archived changes"
      >
        {showArchived ? 'Hide Archived' : 'Show Archived'}
      </Button>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-4 md:gap-6">
            <h1 className="text-lg font-semibold text-foreground">
              OpenSpec
            </h1>
            {/* Desktop view toggle */}
            {showViewToggle && (
              <div className="hidden md:block">
                <ViewToggle />
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Connection indicator - desktop only */}
            <ConnectionIndicator />

            {/* Show Archived toggle - visible on desktop when in kanban view */}
            <div className="hidden md:block">
              <ShowArchivedToggle />
            </div>

            {/* Source select - visible on all sizes */}
            <SourceSelect />

            {/* Settings button - visible on desktop */}
            <div className="hidden md:block">
              <SettingsButton />
            </div>

            {/* Theme toggle - visible on desktop */}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>

            {/* Mobile menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <div className="flex flex-col gap-6 pt-6">
                    {showViewToggle && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">View</h3>
                        <ViewToggle />
                      </div>
                    )}
                    {currentView === 'kanban' && onShowArchivedChange && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Archived</h3>
                        <ShowArchivedToggle />
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Settings</h3>
                      <SettingsButton />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Theme</h3>
                      <ThemeToggle />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
