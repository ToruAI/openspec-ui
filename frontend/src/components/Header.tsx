import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useSSE } from '../hooks/useApi';
import { Menu, Settings, SignalHigh, Signal, WifiOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleOpenSettings = () => {
    setMobileMenuOpen(false); // Close mobile menu when opening settings
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

  const ViewToggle = ({ mobile = false }: { mobile?: boolean }) => {
    const handleViewChange = (view: View) => {
      onViewChange(view);
      if (mobile) {
        setMobileMenuOpen(false);
      }
    };

    if (mobile) {
      return (
        <>
          <button
            onClick={() => handleViewChange('kanban')}
            className={cn(
              "flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors",
              currentView === 'kanban'
                ? "bg-primary text-primary-foreground font-medium"
                : "text-foreground hover:bg-muted"
            )}
          >
            Kanban
          </button>
          <button
            onClick={() => handleViewChange('specs')}
            className={cn(
              "flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors",
              currentView === 'specs'
                ? "bg-primary text-primary-foreground font-medium"
                : "text-foreground hover:bg-muted"
            )}
          >
            Specs
          </button>
        </>
      );
    }

    return (
      <nav className="flex gap-1">
        <Button
          variant={currentView === 'kanban' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleViewChange('kanban')}
        >
          Kanban
        </Button>
        <Button
          variant={currentView === 'specs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleViewChange('specs')}
        >
          Specs
        </Button>
      </nav>
    );
  };

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

  const ThemeToggle = ({ mobile = false }: { mobile?: boolean }) => {
    if (mobile) {
      return (
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md text-foreground hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      );
    }

    return (
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </Button>
    );
  };

  const SettingsButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (mobile) {
      return (
        <button
          onClick={handleOpenSettings}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md text-foreground hover:bg-muted transition-colors"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      );
    }

    return (
      <Button variant="ghost" size="icon" onClick={handleOpenSettings} aria-label="Open settings">
        <Settings className="h-5 w-5" />
      </Button>
    );
  };

  const ShowArchivedToggle = ({ mobile = false }: { mobile?: boolean }) => {
    if (currentView !== 'kanban' || !onShowArchivedChange) {
      return null;
    }

    const handleToggle = () => {
      onShowArchivedChange(!showArchived);
      if (mobile) {
        setMobileMenuOpen(false);
      }
    };

    if (mobile) {
      return (
        <button
          onClick={handleToggle}
          className={cn(
            "flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors",
            showArchived
              ? "bg-primary text-primary-foreground font-medium"
              : "text-foreground hover:bg-muted"
          )}
          aria-label="Toggle archived changes"
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      );
    }

    return (
      <Button
        variant={showArchived ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggle}
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
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] p-0">
                  <div className="flex flex-col h-full">
                    <SheetHeader className="px-5 py-4 border-b border-border">
                      <SheetTitle className="text-left">Menu</SheetTitle>
                    </SheetHeader>
                    <nav className="flex-1 px-3 py-4 space-y-1">
                      {showViewToggle && (
                        <>
                          <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">View</p>
                          <ViewToggle mobile />
                        </>
                      )}
                      {currentView === 'kanban' && onShowArchivedChange && (
                        <>
                          <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">Filter</p>
                          <ShowArchivedToggle mobile />
                        </>
                      )}
                      <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">Preferences</p>
                      <SettingsButton mobile />
                      <ThemeToggle mobile />
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
