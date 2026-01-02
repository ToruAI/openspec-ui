import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Menu, Settings, Sun, Moon, Sparkles, Lightbulb } from 'lucide-react';
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
  onOpenNewIdea?: () => void;
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
  onOpenNewIdea,
}: HeaderProps) {
  const { theme, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleOpenSettings = () => {
    setMobileMenuOpen(false);
    onOpenSettings?.();
  };

  const Logo = () => (
    <div className="flex items-center gap-2.5 group cursor-default select-none shrink-0">
      <div className="relative">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-cyan)] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-300">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-cyan)] opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300" />
      </div>
      <span className="text-lg font-bold tracking-tight whitespace-nowrap">
        <span className="text-gradient">Open</span>
        <span className="text-foreground">Spec</span>
      </span>
    </div>
  );

  const ViewToggle = ({ mobile = false }: { mobile?: boolean }) => {
    const handleViewChange = (view: View) => {
      onViewChange(view);
      if (mobile) {
        setMobileMenuOpen(false);
      }
    };

    if (mobile) {
      return (
        <div className="space-y-1">
          <button
            onClick={() => handleViewChange('kanban')}
            className={cn(
              "flex items-center w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
              currentView === 'kanban'
                ? "bg-primary text-primary-foreground font-medium shadow-sm"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className="mr-3">📋</span>
            Kanban Board
          </button>
          <button
            onClick={() => handleViewChange('specs')}
            className={cn(
              "flex items-center w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
              currentView === 'specs'
                ? "bg-primary text-primary-foreground font-medium shadow-sm"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className="mr-3">📄</span>
            Specifications
          </button>
        </div>
      );
    }

    return (
      <nav className="flex p-1 bg-muted/50 rounded-lg gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewChange('kanban')}
          className={cn(
            "h-8 px-3 rounded-md transition-all duration-200",
            currentView === 'kanban'
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-transparent"
          )}
        >
          Kanban
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewChange('specs')}
          className={cn(
            "h-8 px-3 rounded-md transition-all duration-200",
            currentView === 'specs'
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-transparent"
          )}
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
      <SelectTrigger className="w-[160px] md:w-[180px] h-9 text-sm bg-background/50 border-border/50 hover:border-border transition-colors shrink-0">
        <SelectValue placeholder="All Projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-cyan)] shrink-0" />
            <span className="truncate">All Projects</span>
          </span>
        </SelectItem>
        {sources.map(s => (
          <SelectItem key={s.id} value={s.id}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] shrink-0" />
              <span className="truncate">{s.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const ThemeToggle = ({ mobile = false }: { mobile?: boolean }) => {
    if (mobile) {
      return (
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg text-foreground hover:bg-muted transition-all duration-200"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-500" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-indigo-500" />
              Dark Mode
            </>
          )}
        </button>
      );
    }

    return (
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={toggle} 
        aria-label="Toggle theme"
        className="h-9 w-9 rounded-lg hover:bg-muted transition-colors"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 text-amber-500 transition-transform hover:rotate-45" />
        ) : (
          <Moon className="h-4 w-4 text-indigo-500 transition-transform hover:-rotate-12" />
        )}
      </Button>
    );
  };

  const SettingsButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (mobile) {
      return (
        <button
          onClick={handleOpenSettings}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg text-foreground hover:bg-muted transition-all duration-200"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      );
    }

    return (
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleOpenSettings} 
        aria-label="Open settings"
        className="h-9 w-9 rounded-lg hover:bg-muted transition-colors"
      >
        <Settings className="h-4 w-4 transition-transform hover:rotate-90 duration-300" />
      </Button>
    );
  };

  const NewIdeaButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (mobile) {
      return (
        <button
          onClick={() => {
            onOpenNewIdea?.();
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg text-foreground hover:bg-muted transition-all duration-200"
          aria-label="Create new idea"
        >
          <Lightbulb className="h-4 w-4" />
          New Idea
        </button>
      );
    }

    return (
      <Button
        variant="default"
        size="sm"
        onClick={onOpenNewIdea}
        className="h-9"
      >
        <Lightbulb className="h-4 w-4 mr-2" />
        New Idea
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
            "flex items-center w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
            showArchived
              ? "bg-primary text-primary-foreground font-medium shadow-sm"
              : "text-foreground hover:bg-muted"
          )}
          aria-label="Toggle archived changes"
        >
          <span className="mr-3">📦</span>
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
        className={cn(
          "h-9 transition-all duration-200",
          !showArchived && "bg-background/50 border-border/50 hover:border-border"
        )}
      >
        {showArchived ? 'Hide Archived' : 'Show Archived'}
      </Button>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 overflow-hidden">
        <div className="flex items-center justify-between h-16 overflow-hidden">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-4 md:gap-6 min-w-0 flex-shrink overflow-hidden">
            <Logo />
            {/* Desktop view toggle */}
            {showViewToggle && (
              <div className="hidden md:block">
                <ViewToggle />
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* Show Archived toggle - visible on desktop when in kanban view */}
            <div className="hidden md:block">
              <ShowArchivedToggle />
            </div>

            {/* Source select - visible on all sizes */}
            <SourceSelect />

            {/* New Idea button - visible on desktop */}
            <div className="hidden md:block">
              <NewIdeaButton />
            </div>

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
                  <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] p-0">
                  <div className="flex flex-col h-full">
                    <SheetHeader className="px-5 py-5 border-b border-border">
                      <SheetTitle className="text-left flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Menu
                      </SheetTitle>
                    </SheetHeader>
                    <nav className="flex-1 px-4 py-5 space-y-6">
                      {showViewToggle && (
                        <div className="space-y-2">
                          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">View</p>
                          <ViewToggle mobile />
                        </div>
                      )}
                      {currentView === 'kanban' && onShowArchivedChange && (
                        <div className="space-y-2">
                          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter</p>
                          <ShowArchivedToggle mobile />
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preferences</p>
                        <div className="space-y-1">
                          <NewIdeaButton mobile />
                          <SettingsButton mobile />
                          <ThemeToggle mobile />
                        </div>
                      </div>
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
