import { AlertTriangle } from 'lucide-react';
import { ACTIVE_STAGES, STAGES, type RepoSummary } from '@/lib/board';
import { cn } from '@/lib/utils';

interface WorkspaceOverviewProps {
  total: RepoSummary;
  repos: RepoSummary[];
  /** Repo the board is filtered to; null for every repo */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  colorOf: (id: string) => string;
  /** Phone: one scrolling row of compact chips */
  compact?: boolean;
}

function stageSentence(summary: RepoSummary): string {
  const parts = ACTIVE_STAGES.filter((s) => summary.counts[s] > 0).map(
    (s) => `${summary.counts[s]} ${STAGES[s].label.toLowerCase()}`
  );
  return parts.length > 0 ? parts.join(', ') : 'no active changes';
}

/** Active changes per stage as one bar, segment widths by count. */
function StageBar({ summary }: { summary: RepoSummary }) {
  return (
    <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted" aria-hidden>
      {ACTIVE_STAGES.map((stage) => {
        const count = summary.counts[stage];
        if (count === 0) return null;
        return <div key={stage} className={STAGES[stage].fill} style={{ flexGrow: count }} />;
      })}
    </div>
  );
}

/** Stage icons with their counts: shape and number, not colour alone. */
function StageCounts({ summary }: { summary: RepoSummary }) {
  return (
    <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] tabular-nums text-muted-foreground" aria-hidden>
      {ACTIVE_STAGES.map((stage) => {
        const count = summary.counts[stage];
        if (count === 0) return null;
        const { Icon, color } = STAGES[stage];
        return (
          <span key={stage} className="flex items-center gap-0.5" title={STAGES[stage].label}>
            <Icon className={cn('h-3 w-3', color)} />
            {count}
          </span>
        );
      })}
      {summary.active === 0 && <span>No active changes</span>}
      {summary.errors > 0 && (
        <span className="flex items-center gap-0.5 text-amber-700 dark:text-amber-400" title="OpenSpec can't read these">
          <AlertTriangle className="h-3 w-3" />
          {summary.errors}
        </span>
      )}
    </div>
  );
}

function describe(summary: RepoSummary): string {
  const tasks =
    summary.tasks.total > 0 ? `; ${summary.tasks.done} of ${summary.tasks.total} tasks checked` : '';
  const errors = summary.errors > 0 ? `; ${summary.errors} OpenSpec can't read` : '';
  const problem = summary.problem ? `; ${summary.problem}` : '';
  return `${summary.name}: ${summary.active} active (${stageSentence(summary)})${tasks}${errors}${problem}`;
}

function Tile({
  summary,
  selected,
  onClick,
  color,
}: {
  summary: RepoSummary;
  selected: boolean;
  onClick: () => void;
  color: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={describe(summary)}
      title={summary.path || undefined}
      className={cn(
        'flex min-w-[156px] max-w-[220px] flex-1 basis-0 flex-col gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        selected
          ? 'border-foreground/40 bg-card shadow-sm'
          : 'border-border/70 bg-card/50 hover:border-foreground/20 hover:bg-card'
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {color && <span className={cn('h-2 w-2 shrink-0 rounded-full', color)} aria-hidden />}
        <span className={cn('truncate text-[13px]', selected ? 'font-semibold' : 'font-medium')}>{summary.name}</span>
        <span className="ml-auto shrink-0 pl-1 text-[11px] tabular-nums text-muted-foreground" aria-hidden>
          {summary.active}
        </span>
      </div>
      <StageBar summary={summary} />
      {summary.problem ? (
        <div className="truncate text-[11px] text-amber-700 dark:text-amber-400" aria-hidden>
          {summary.problem}
        </div>
      ) : (
        <StageCounts summary={summary} />
      )}
    </button>
  );
}

/**
 * Every repo on the board at a glance: active changes by stage, tasks
 * checked, and anything OpenSpec can't read. Doubles as the repo filter.
 */
export function WorkspaceOverview({ total, repos, selectedId, onSelect, colorOf, compact }: WorkspaceOverviewProps) {
  // Tiles while they fit in a row; past that, chips that wrap.
  if (compact || repos.length > 5) {
    const chips = [{ summary: total, id: null as string | null }, ...repos.map((r) => ({ summary: r, id: r.id }))];
    return (
      <div
        className={cn(
          'flex gap-1.5',
          compact ? '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]' : 'flex-wrap'
        )}
        role="group"
        aria-label="Repos"
      >
        {chips.map(({ summary, id }) => {
          const selected = selectedId === id;
          return (
            <button
              key={id ?? 'all'}
              type="button"
              aria-pressed={selected}
              aria-label={describe(summary)}
              onClick={() => onSelect(selectedId === id ? null : id)}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-foreground bg-foreground text-background font-medium'
                  : 'border-border bg-card text-foreground'
              )}
            >
              {id && <span className={cn('h-1.5 w-1.5 rounded-full', colorOf(id))} aria-hidden />}
              <span>{id ? summary.name : 'All'}</span>
              <span className={cn('tabular-nums', selected ? 'opacity-70' : 'text-muted-foreground')} aria-hidden>
                {summary.active}
              </span>
              {summary.errors > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group" aria-label="Repos">
      <Tile summary={total} selected={selectedId === null} onClick={() => onSelect(null)} color={null} />
      {repos.map((repo) => (
        <Tile
          key={repo.id}
          summary={repo}
          selected={selectedId === repo.id}
          onClick={() => onSelect(selectedId === repo.id ? null : repo.id)}
          color={colorOf(repo.id)}
        />
      ))}
    </div>
  );
}
