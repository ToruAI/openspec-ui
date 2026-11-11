import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Menu, Settings, Sun, Moon, Lightbulb, Archive, Star, LayoutGrid, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { Source } from '../types';
import { BrandMark, BrandName, GitHubIcon } from './Brand';
import { OPENSPEC_URL, REPO_URL } from '@/lib/links';

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
  /** Running server version, shown as a badge linking to the changelog */
  version?: string;
  changelogUrl?: string;
}

const DEFAULT_CHANGELOG_URL = 'https://github.com/ToruAI/openspec-ui/blob/main/CHANGELOG.md';

const VIEWS: { value: View; label: string; Icon: typeof LayoutGrid }[] = [
  { value: 'kanban', label: 'Board', Icon: LayoutGrid },
  { value: 'specs', label: 'Specs', Icon: FileText },
];

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background';

function VersionBadge({ version, changelogUrl }: { version: string; changelogUrl: string }) {
  return (
    <a
      href={changelogUrl}
      target="_blank"
      rel="noreferrer"
      title="What's new in this version"
      className={cn(
        'rounded-md border border-border/80 px-1.5 py-0.5 text-[11px] font-mono leading-none text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors',
        focusRing
      )}
    >
      v{version}
    </a>
  );
}

function SourceSelect({
  sources,
  selectedSourceId,
  onSourceChange,
  className,
}: Pick<HeaderProps, 'sources' | 'selectedSourceId' | 'onSourceChange'> & { className?: string }) {
  return (
    <Select value={selectedSourceId || 'all'} onValueChange={(val) => onSourceChange(val === 'all' ? null : val)}>
      <SelectTrigger aria-label="Repo" className={cn('w-[180px] h-9 text-sm bg-background/50 border-border/70 shrink-0', className)}>
        <SelectValue placeholder="All repos" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All repos</SelectItem>
        {sources.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="truncate">{s.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MenuItem({
  onClick,
  icon,
  children,
  pressed,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors',
        pressed ? 'bg-muted font-medium text-foreground' : 'text-foreground hover:bg-muted',
        focusRing
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </button>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
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
  version,
  changelogUrl = DEFAULT_CHANGELOG_URL,
}: HeaderProps) {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeThen = (fn?: () => void) => () => {
    setMenuOpen(false);
    fn?.();
  };
  // On the board, the workspace overview is the repo filter; Specs needs its own.
  const showSourceSelect = sources.length > 1 && currentView === 'specs';

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3 md:gap-5">
          <div
            className="flex items-center gap-2 select-none"
            title="OpenSpec UI: an independent, read-only board for OpenSpec changes"
          >
            <BrandMark />
            <BrandName />
          </div>
          {version && (
            <span className="hidden md:inline-flex">
              <VersionBadge version={version} changelogUrl={changelogUrl} />
            </span>
          )}
          {showViewToggle && (
            <nav className="hidden md:flex items-center gap-0.5" aria-label="View">
              {VIEWS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onViewChange(value)}
                  aria-current={currentView === value ? 'page' : undefined}
                  className={cn(
                    'h-8 rounded-md px-3 text-sm transition-colors',
                    currentView === value
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                    focusRing
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden md:flex items-center gap-1.5">
            {currentView === 'kanban' && onShowArchivedChange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShowArchivedChange(!showArchived)}
                aria-pressed={showArchived}
                className={cn('h-9 text-muted-foreground', showArchived && 'bg-muted text-foreground')}
              >
                <Archive className="h-4 w-4 mr-1.5" />
                Archived
              </Button>
            )}
            {showSourceSelect && (
              <SourceSelect sources={sources} selectedSourceId={selectedSourceId} onSourceChange={onSourceChange} />
            )}
            {onOpenNewIdea && (
              <Button variant="ghost" size="sm" onClick={onOpenNewIdea} className="h-9 text-muted-foreground">
                <Lightbulb className="h-4 w-4 mr-1.5" />
                New idea
              </Button>
            )}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              title="OpenSpec UI on GitHub. A star helps other OpenSpec users find it."
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                focusRing
              )}
            >
              <GitHubIcon />
              <Star className="h-3.5 w-3.5" aria-hidden />
              <span>Star</span>
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              aria-label="Settings"
              title="Settings"
              className="h-9 w-9 text-muted-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            className="h-9 w-9 text-muted-foreground"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] p-0 gap-0">
                <SheetHeader className="px-5 py-4 border-b border-border">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <BrandMark className="h-6 w-6" />
                    <BrandName />
                  </SheetTitle>
                  <SheetDescription className="text-left text-xs">
                    Read-only board for OpenSpec changes
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Menu">
                  {showViewToggle && (
                    <MenuSection title="View">
                      {VIEWS.map(({ value, label, Icon }) => (
                        <MenuItem
                          key={value}
                          onClick={closeThen(() => onViewChange(value))}
                          icon={<Icon className="h-4 w-4" />}
                          pressed={currentView === value}
                        >
                          {label}
                        </MenuItem>
                      ))}
                    </MenuSection>
                  )}
                  {showSourceSelect && (
                    <MenuSection title="Repo">
                      <div className="px-1">
                        <SourceSelect
                          sources={sources}
                          selectedSourceId={selectedSourceId}
                          onSourceChange={(id) => {
                            onSourceChange(id);
                            setMenuOpen(false);
                          }}
                          className="w-full"
                        />
                      </div>
                    </MenuSection>
                  )}
                  <MenuSection title="Board">
                    {currentView === 'kanban' && onShowArchivedChange && (
                      <MenuItem
                        onClick={closeThen(() => onShowArchivedChange(!showArchived))}
                        icon={<Archive className="h-4 w-4" />}
                        pressed={showArchived}
                      >
                        {showArchived ? 'Hide archived' : 'Show archived'}
                      </MenuItem>
                    )}
                    {onOpenNewIdea && (
                      <MenuItem onClick={closeThen(onOpenNewIdea)} icon={<Lightbulb className="h-4 w-4" />}>
                        New idea
                      </MenuItem>
                    )}
                    <MenuItem onClick={closeThen(onOpenSettings)} icon={<Settings className="h-4 w-4" />}>
                      Settings
                    </MenuItem>
                  </MenuSection>
                  <MenuSection title="About">
                    <div className="px-3 space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <p>
                        An independent community tool for{' '}
                        <a href={OPENSPEC_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                          OpenSpec
                        </a>
                        , not made by the OpenSpec team.
                      </p>
                      <div className="flex items-center gap-2">
                        <a
                          href={REPO_URL}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-foreground hover:bg-muted',
                            focusRing
                          )}
                        >
                          <GitHubIcon className="h-3.5 w-3.5" />
                          <Star className="h-3.5 w-3.5" aria-hidden />
                          Star on GitHub
                        </a>
                        {version && <VersionBadge version={version} changelogUrl={changelogUrl} />}
                      </div>
                    </div>
                  </MenuSection>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
