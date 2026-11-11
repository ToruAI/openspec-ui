import { AlertTriangle } from 'lucide-react';
import type { Change } from '../types';
import { cn } from '@/lib/utils';
import { changeArtifacts } from '@/lib/artifacts';
import { splitArchivedName, stageOf } from '@/lib/board';
import { ArtifactChain } from './ArtifactChain';

interface ChangeCardProps {
  change: Change;
  onClick: () => void;
  /** Repo label, shown when the board mixes repos */
  repo?: { name: string; color: string } | null;
}

function TaskBar({ done, total }: { done: number; total: number }) {
  const complete = done === total;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
      <div
        className="h-1 flex-1 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-label="Tasks checked"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div
          className={cn('h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-amber-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn(complete && 'text-emerald-700 dark:text-emerald-400 font-medium')}>
        {done}/{total} tasks
      </span>
    </div>
  );
}

export function ChangeCard({ change, onClick, repo }: ChangeCardProps) {
  const stage = stageOf(change);
  const artifacts = changeArtifacts(change);
  const stats = change.taskStats;
  const hasTasks = !!stats && stats.total > 0;
  // The chain is the point of a change still being planned; once planning is
  // done it is noise, unless something in it is still missing or broken.
  const showChain = !!change.error || stage === 'planning' || (!change.isPlanningComplete && stage !== 'archived');
  const warnings = change.warnings ?? [];
  const summary = change.summary || change.title;
  const archived = stage === 'archived' ? splitArchivedName(change.name) : null;

  return (
    <article
      className={cn(
        'group relative rounded-lg border border-border/70 bg-card px-3 py-2.5 text-left shadow-[0_1px_0_0_oklch(0_0_0/0.02)]',
        'transition-[border-color,box-shadow] duration-150 hover:border-foreground/20 hover:shadow-sm',
        'has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring has-[button:focus-visible]:ring-offset-1 has-[button:focus-visible]:ring-offset-background',
        stage === 'archived' && 'bg-card/60'
      )}
      data-stage={stage}
    >
      {repo && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', repo.color)} aria-hidden />
          <span className="truncate">{repo.name}</span>
        </div>
      )}
      <h3 className="text-[13px] font-semibold leading-snug text-foreground break-words">
        <button
          type="button"
          onClick={onClick}
          className="text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
        >
          {archived ? archived.name : change.name}
        </button>
        {warnings.length > 0 && !change.error && (
          <span
            className="relative z-[1] ml-1 inline-flex align-[-2px] text-amber-600 dark:text-amber-400"
            title={warnings.join('\n')}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            <span className="sr-only">OpenSpec warnings: {warnings.join(' ')}</span>
          </span>
        )}
      </h3>
      {summary && (
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2" title={summary}>
          {summary}
        </p>
      )}

      {(showChain || hasTasks) && (
        <div className="mt-2 space-y-2">
          {showChain && <ArtifactChain artifacts={artifacts} error={change.error} />}
          {hasTasks && stage !== 'archived' && <TaskBar done={stats.done} total={stats.total} />}
        </div>
      )}
      {archived?.date && (
        <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">Archived {archived.date}</p>
      )}
    </article>
  );
}
