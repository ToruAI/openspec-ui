import { useMemo, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ChevronLeft, FolderOpen, Columns3, Rows3, Plus, SearchX, Sparkles, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Source, Change, Idea } from '../types';
import { ChangeCard } from './ChangeCard';
import { IdeaCard } from './IdeaCard';
import { ColumnSkeleton } from './LoadingSkeleton';
import { SearchBar } from './SearchBar';
import { SortDropdown } from './SortDropdown';
import { WorkspaceOverview } from './WorkspaceOverview';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ACTIVE_STAGES,
  IDEAS_META,
  STAGES,
  defaultMobileStage,
  matchesQuery,
  repoColor,
  repoSummaries,
  sortChanges,
  stageOf,
  type SortOption,
  type Stage,
} from '@/lib/board';

type ColumnKey = Stage | 'ideas';
type Layout = 'columns' | 'lanes';

const LAYOUT_KEY = 'openspec-board-layout';
const IDEAS_OPEN_KEY = 'openspec-ideas-open';
const SORT_KEY = 'openspec-sort';
export const SEARCH_INPUT_ID = 'board-search';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the preference just isn't remembered.
  }
}

interface KanbanBoardProps {
  changes: Change[];
  ideas: Idea[];
  sources: Source[];
  loading?: boolean;
  error?: Error | null;
  onCardClick: (change: Change) => void;
  onIdeaClick?: (idea: Idea) => void;
  selectedSourceId: string | null;
  onSourceChange?: (id: string | null) => void;
  showArchived?: boolean;
  onOpenSettings?: () => void;
  onNewIdea?: () => void;
  /** Folders the server searched (zero-config mode), for the empty state */
  searchedRoots?: string[];
}

function EmptySourcesHint({ searchedRoots }: { searchedRoots?: string[] }) {
  const searched = searchedRoots && searchedRoots.length > 0 ? searchedRoots.join(', ') : null;
  return (
    <div className="text-sm text-muted-foreground mt-2 space-y-3 max-w-md">
      <p>
        {searched ? (
          <>Nothing with an <code className="font-mono">openspec/</code> folder was found in <code className="font-mono break-all">{searched}</code>.</>
        ) : (
          <>Add the folder of a repo that uses OpenSpec.</>
        )}
      </p>
      <div className="text-left inline-block rounded-lg bg-muted/60 px-4 py-3 font-mono text-xs space-y-1">
        <div><span className="text-muted-foreground/70">$</span> openspec-ui ~/code <span className="text-muted-foreground/70"># search another folder</span></div>
        <div><span className="text-muted-foreground/70">$</span> openspec init <span className="text-muted-foreground/70"># start OpenSpec in a repo</span></div>
      </div>
    </div>
  );
}

function CenteredMessage({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 py-12 px-4 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">{icon}</div>
      <div className="flex flex-col items-center">
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function columnMeta(key: ColumnKey) {
  return key === 'ideas' ? IDEAS_META : STAGES[key];
}

function ColumnHeader({
  columnKey,
  count,
  action,
}: {
  columnKey: ColumnKey;
  count: number;
  action?: React.ReactNode;
}) {
  const { label, hint, Icon, color } = columnMeta(columnKey);
  return (
    <div className="flex items-center gap-2 h-9 px-1" title={hint}>
      <Icon className={cn('h-4 w-4 shrink-0', color)} aria-hidden />
      <h2 className="text-[13px] font-semibold text-foreground truncate">{label}</h2>
      <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${count} ${count === 1 ? 'item' : 'items'}`}>
        {count}
      </span>
      {action && <div className="ml-auto flex items-center">{action}</div>}
    </div>
  );
}

function EmptyColumn({ columnKey }: { columnKey: ColumnKey }) {
  const text: Record<ColumnKey, string> = {
    ideas: 'No ideas',
    planning: 'Nothing being planned',
    ready: 'Nothing waiting to start',
    in_progress: 'Nothing in progress',
    complete: 'Nothing waiting to be archived',
    archived: 'Nothing archived',
  };
  return (
    <div className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs text-muted-foreground">
      {text[columnKey]}
    </div>
  );
}

function LayoutToggle({ layout, onChange }: { layout: Layout; onChange: (l: Layout) => void }) {
  const options: { value: Layout; label: string; Icon: typeof Columns3 }[] = [
    { value: 'columns', label: 'Stages', Icon: Columns3 },
    { value: 'lanes', label: 'By repo', Icon: Rows3 },
  ];
  return (
    <div className="flex h-9 items-center rounded-md border border-border/70 bg-background/50 p-0.5" role="group" aria-label="Board layout">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={layout === value}
          onClick={() => onChange(value)}
          className={cn(
            'flex h-full items-center gap-1.5 rounded px-2.5 text-xs transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            layout === value ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

export function KanbanBoard({
  changes,
  ideas,
  sources,
  loading = false,
  error = null,
  onCardClick,
  onIdeaClick,
  selectedSourceId,
  onSourceChange,
  showArchived = false,
  onOpenSettings,
  onNewIdea,
  searchedRoots,
}: KanbanBoardProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortByState] = useState<SortOption>(() =>
    readStored(SORT_KEY, ['name-asc', 'name-desc', 'progress-asc', 'progress-desc'] as const, 'name-asc')
  );
  const [layout, setLayoutState] = useState<Layout>(() => readStored(LAYOUT_KEY, ['columns', 'lanes'] as const, 'columns'));
  const [ideasOpen, setIdeasOpenState] = useState(() => readStored(IDEAS_OPEN_KEY, ['true', 'false'] as const, 'false') === 'true');
  const [mobileColumn, setMobileColumn] = useState<ColumnKey | null>(null);

  const setSortBy = (value: SortOption) => {
    setSortByState(value);
    store(SORT_KEY, value);
  };
  const setLayout = (value: Layout) => {
    setLayoutState(value);
    store(LAYOUT_KEY, value);
  };
  const setIdeasOpen = (open: boolean) => {
    setIdeasOpenState(open);
    store(IDEAS_OPEN_KEY, String(open));
  };

  const multiRepo = sources.length > 1;
  const colorOf = (id: string) => repoColor(sources, id);
  const nameOf = (id: string) => sources.find((s) => s.id === id)?.name ?? id;

  // The overview counts the whole workspace, regardless of filter and search.
  const summaries = useMemo(() => repoSummaries(sources, changes), [sources, changes]);

  const visibleChanges = useMemo(() => {
    const filtered = changes.filter(
      (c) =>
        (!selectedSourceId || c.sourceId === selectedSourceId) &&
        (showArchived || c.status !== 'archived') &&
        matchesQuery(c, searchQuery)
    );
    return sortChanges(filtered, sortBy);
  }, [changes, selectedSourceId, showArchived, searchQuery, sortBy]);

  const visibleIdeas = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return ideas.filter(
      (idea) =>
        (!selectedSourceId || idea.sourceId === selectedSourceId) &&
        (!q || [idea.title, idea.description, idea.sourceId].some((f) => f.toLowerCase().includes(q)))
    );
  }, [ideas, selectedSourceId, searchQuery]);

  const byColumn = useMemo(() => {
    const groups: Record<Stage, Change[]> = { planning: [], ready: [], in_progress: [], complete: [], archived: [] };
    for (const change of visibleChanges) groups[stageOf(change)].push(change);
    // Most recently archived first: the folder name starts with the date.
    groups.archived.sort((a, b) => b.name.localeCompare(a.name));
    return groups;
  }, [visibleChanges]);

  const hasIdeas = ideas.some((i) => !selectedSourceId || i.sourceId === selectedSourceId);
  const columns: ColumnKey[] = [
    ...(hasIdeas ? (['ideas'] as const) : []),
    ...ACTIVE_STAGES,
    ...(showArchived ? (['archived'] as const) : []),
  ];
  const countOf = (key: ColumnKey) => (key === 'ideas' ? visibleIdeas.length : byColumn[key].length);

  // Keep the active stage tab visible in its strip. Horizontal only, and only
  // when the active tab changes, so live updates never move the page.
  const scrolledTo = useRef<ColumnKey | null>(null);
  const keepInView = (key: ColumnKey) => (el: HTMLButtonElement | null) => {
    const strip = el?.parentElement;
    if (!el || !strip || scrolledTo.current === key) return;
    scrolledTo.current = key;
    strip.scrollLeft = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
  };

  // Swipe between columns on a phone.
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  if (loading) {
    return (
      <div className="flex gap-4 pb-4">
        {(isMobile ? [0] : [0, 1, 2, 3]).map((i) => <ColumnSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <CenteredMessage icon={<AlertTriangle className="h-8 w-8 text-destructive" />} title="Error loading changes">
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-4">
          Try again
        </Button>
      </CenteredMessage>
    );
  }

  if (sources.length === 0) {
    return (
      <CenteredMessage icon={<FolderOpen className="h-8 w-8" />} title="No OpenSpec projects found">
        <EmptySourcesHint searchedRoots={searchedRoots} />
        <Button onClick={onOpenSettings} size="sm" className="mt-5">
          <FolderOpen className="h-4 w-4 mr-2" />
          Add a project folder
        </Button>
      </CenteredMessage>
    );
  }

  const scopedChanges = changes.filter((c) => !selectedSourceId || c.sourceId === selectedSourceId);
  if (scopedChanges.length === 0 && !hasIdeas) {
    const where = selectedSourceId ? nameOf(selectedSourceId) : multiRepo ? 'these repos' : sources[0].name;
    return (
      <div className="flex flex-col gap-4">
        {multiRepo && onSourceChange && (
          <WorkspaceOverview
            total={summaries.total}
            repos={summaries.repos}
            selectedId={selectedSourceId}
            onSelect={onSourceChange}
            colorOf={colorOf}
            compact={isMobile}
          />
        )}
        <CenteredMessage icon={<Sparkles className="h-8 w-8" />} title={`No changes in ${where} yet`}>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Changes appear here as soon as they exist under <code className="font-mono text-xs">openspec/changes/</code>,
            whether your AI assistant proposes one or you start it yourself:
          </p>
          <div className="mt-3 rounded-lg bg-muted/60 px-4 py-3 font-mono text-xs text-left">
            <span className="text-muted-foreground/70">$</span> openspec new change add-dark-mode
          </div>
          <p className="text-xs text-muted-foreground mt-3">The board updates live; no need to reload.</p>
        </CenteredMessage>
      </div>
    );
  }

  const noMatches = searchQuery !== '' && visibleChanges.length === 0 && visibleIdeas.length === 0;
  const repoFor = (change: Change) =>
    multiRepo && !selectedSourceId ? { name: nameOf(change.sourceId), color: colorOf(change.sourceId) } : null;

  const renderItems = (key: ColumnKey, items: (Change | Idea)[], withRepo: boolean) => (
    <>
      {items.map((item) =>
        'status' in item ? (
          <ChangeCard
            key={item.id}
            change={item}
            onClick={() => onCardClick(item)}
            repo={withRepo ? repoFor(item) : null}
          />
        ) : (
          <IdeaCard key={item.id} idea={item} onClick={() => onIdeaClick?.(item)} />
        )
      )}
      {items.length === 0 && <EmptyColumn columnKey={key} />}
    </>
  );

  const itemsOf = (key: ColumnKey, sourceId?: string): (Change | Idea)[] => {
    const all = key === 'ideas' ? visibleIdeas : byColumn[key];
    return sourceId ? all.filter((i) => i.sourceId === sourceId) : all;
  };

  const overview = multiRepo && onSourceChange && (
    <WorkspaceOverview
      total={summaries.total}
      repos={summaries.repos}
      selectedId={selectedSourceId}
      onSelect={onSourceChange}
      colorOf={colorOf}
      compact={isMobile}
    />
  );

  // ------------------------------------------------------------------ phone
  if (isMobile) {
    const mobileColumns = [...columns.filter((k) => k !== 'ideas'), ...columns.filter((k) => k === 'ideas')];
    const active: ColumnKey =
      mobileColumn && mobileColumns.includes(mobileColumn)
        ? mobileColumn
        : (defaultMobileStage(Object.fromEntries(mobileColumns.map((k) => [k, countOf(k)]))) as ColumnKey);
    const activeIndex = Math.max(0, mobileColumns.indexOf(active));
    const items = itemsOf(active);

    const go = (index: number) => {
      setMobileColumn(mobileColumns[Math.min(mobileColumns.length - 1, Math.max(0, index))]);
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > Math.abs(dy)) setDragOffset(dx * 0.4);
    };
    const onTouchEnd = () => {
      if (dragOffset < -28) go(activeIndex + 1);
      else if (dragOffset > 28) go(activeIndex - 1);
      setDragOffset(0);
    };

    return (
      <div className="flex flex-col gap-3">
        {overview}
        <div
          role="tablist"
          aria-label="Stages"
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-border/70 px-4 [scrollbar-width:none]"
        >
          {mobileColumns.map((key) => {
            const { label, Icon, color } = columnMeta(key);
            const selected = key === active;
            return (
              <button
                key={key}
                id={`stage-tab-${key}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls="stage-panel"
                onClick={() => go(mobileColumns.indexOf(key))}
                ref={selected ? keepInView(key) : undefined}
                className={cn(
                  '-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2 text-[13px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  selected ? 'border-foreground text-foreground font-semibold' : 'border-transparent text-muted-foreground'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
                {label}
                <span className="tabular-nums text-xs text-muted-foreground font-normal">{countOf(key)}</span>
              </button>
            );
          })}
        </div>
        <SearchBar id={SEARCH_INPUT_ID} value={searchQuery} onChange={setSearchQuery} placeholder="Search changes" />
        <div
          id="stage-panel"
          role="tabpanel"
          aria-labelledby={`stage-tab-${active}`}
          className="flex flex-col gap-2 pb-6 transition-transform duration-150"
          style={{ transform: dragOffset ? `translateX(${dragOffset}px)` : undefined }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <p className="text-xs text-muted-foreground px-0.5">{columnMeta(active).hint}</p>
          {active === 'ideas' && onNewIdea && (
            <Button variant="outline" size="sm" className="self-start" onClick={onNewIdea}>
              <Plus className="h-4 w-4 mr-1" /> New idea
            </Button>
          )}
          {noMatches ? <NoMatches query={searchQuery} onClear={() => setSearchQuery('')} /> : renderItems(active, items, true)}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- desktop
  const lanes = multiRepo && !selectedSourceId && layout === 'lanes';
  const stageColumns = columns.filter((k) => k !== 'ideas');
  const ideasColumn = hasIdeas;
  const singleRepo = !multiRepo ? sources[0] : null;

  const ideasRail = (
    <button
      type="button"
      onClick={() => setIdeasOpen(true)}
      aria-expanded={false}
      aria-label={`Show ideas (${visibleIdeas.length})`}
      title={IDEAS_META.hint}
      className={cn(
        'flex w-10 shrink-0 self-start flex-col items-center gap-2 rounded-lg border border-border/70 bg-card/40 py-3 text-muted-foreground',
        'hover:border-foreground/20 hover:text-foreground transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <IDEAS_META.Icon className={cn('h-4 w-4', IDEAS_META.color)} aria-hidden />
      <span className="text-xs tabular-nums">{visibleIdeas.length}</span>
      <span className="text-xs font-medium [writing-mode:vertical-rl] rotate-180">Ideas</span>
    </button>
  );

  const ideasToggle = (
    <button
      type="button"
      onClick={() => setIdeasOpen(true)}
      aria-expanded={false}
      aria-label={`Show ideas (${visibleIdeas.length})`}
      title={IDEAS_META.hint}
      className="flex h-9 w-10 items-center justify-center gap-1 rounded-md text-xs tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IDEAS_META.Icon className={cn('h-4 w-4', IDEAS_META.color)} aria-hidden />
      {visibleIdeas.length}
    </button>
  );

  const ideasHeaderActions = (
    <>
      {onNewIdea && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewIdea} aria-label="New idea" title="New idea">
          <Plus className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setIdeasOpen(false)}
        aria-label="Hide ideas"
        aria-expanded
        title="Hide ideas"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Workspace + tools */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          {overview || (
            singleRepo && (
              <div className="flex items-center gap-2 min-w-0" title={singleRepo.path}>
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <span className="text-sm font-semibold truncate">{singleRepo.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {summaries.total.active} active
                  {summaries.total.tasks.total > 0 &&
                    ` · ${summaries.total.tasks.done}/${summaries.total.tasks.total} tasks checked`}
                </span>
              </div>
            )
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SearchBar id={SEARCH_INPUT_ID} value={searchQuery} onChange={setSearchQuery} placeholder="Search changes" />
          <SortDropdown value={sortBy} onChange={setSortBy} />
          {multiRepo && !selectedSourceId && <LayoutToggle layout={layout} onChange={setLayout} />}
        </div>
      </div>

      {noMatches ? (
        <NoMatches query={searchQuery} onClear={() => setSearchQuery('')} />
      ) : lanes ? (
        <Lanes
          columns={stageColumns}
          ideas={ideasColumn ? { open: ideasOpen, compact: ideasToggle, actions: ideasHeaderActions } : null}
          repos={summaries.repos}
          colorOf={colorOf}
          countOf={countOf}
          itemsOf={itemsOf}
          renderItems={renderItems}
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          {ideasColumn && !ideasOpen && ideasRail}
          {(ideasColumn && ideasOpen ? columns : stageColumns).map((key) => (
            <section key={key} className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={columnMeta(key).label}>
              <ColumnHeader columnKey={key} count={countOf(key)} action={key === 'ideas' ? ideasHeaderActions : undefined} />
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4 pr-1 pt-1">
                {renderItems(key, itemsOf(key), true)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <CenteredMessage icon={<SearchX className="h-8 w-8" />} title={`Nothing matches "${query}"`}>
      <p className="text-sm text-muted-foreground mt-1">Search looks at change names, summaries and repo names.</p>
      <Button onClick={onClear} variant="outline" size="sm" className="mt-4">
        Clear search
      </Button>
    </CenteredMessage>
  );
}

interface LanesProps {
  columns: ColumnKey[];
  ideas: { open: boolean; compact: React.ReactNode; actions: React.ReactNode } | null;
  repos: ReturnType<typeof repoSummaries>['repos'];
  colorOf: (id: string) => string;
  countOf: (key: ColumnKey) => number;
  itemsOf: (key: ColumnKey, sourceId?: string) => (Change | Idea)[];
  renderItems: (key: ColumnKey, items: (Change | Idea)[], withRepo: boolean) => React.ReactNode;
}

/** One row per repo, the same stage columns across: who is where, side by side. */
function Lanes({ columns, ideas, repos, colorOf, countOf, itemsOf, renderItems }: LanesProps) {
  const all: ColumnKey[] = ideas?.open ? ['ideas', ...columns] : columns;
  const template = `${ideas && !ideas.open ? '2.5rem ' : ''}repeat(${all.length}, minmax(0, 1fr))`;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="grid gap-x-3" style={{ gridTemplateColumns: template }}>
        <div className="contents">
          {ideas && !ideas.open && <div className="sticky top-0 z-10 bg-background">{ideas.compact}</div>}
          {all.map((key) => (
            <div key={key} className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
              <ColumnHeader columnKey={key} count={countOf(key)} action={key === 'ideas' ? ideas?.actions : undefined} />
            </div>
          ))}
        </div>
        {repos.map((repo) => {
          return (
            <section key={repo.id} className="contents" aria-label={repo.name}>
              <div className="col-span-full mt-3 mb-1.5 flex items-center gap-2 border-t border-border/70 pt-3 px-1">
                <span className={cn('h-2 w-2 rounded-full', colorOf(repo.id))} aria-hidden />
                <h3 className="text-[13px] font-semibold">{repo.name}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {repo.active} active
                  {repo.tasks.total > 0 && ` · ${repo.tasks.done}/${repo.tasks.total} tasks checked`}
                  {repo.problem && ` · ${repo.problem}`}
                </span>
              </div>
              {ideas && !ideas.open && <div aria-hidden />}
              {all.map((key) => {
                const items = itemsOf(key, repo.id);
                return (
                  <div key={key} className="flex min-w-0 flex-col gap-2">
                    {items.length > 0 && renderItems(key, items, false)}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
