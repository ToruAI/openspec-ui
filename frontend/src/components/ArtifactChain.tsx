import { AlertTriangle } from 'lucide-react';
import type { Artifact } from '../types';
import { ARTIFACT_STATUS, artifactMeta, artifactTitle, joinWords, nextArtifactId } from '@/lib/artifacts';
import { cn } from '@/lib/utils';

interface ArtifactChainProps {
  artifacts: Artifact[];
  /** Set when OpenSpec cannot read the change; replaces the chain */
  error?: string | null;
  warnings?: string[];
  className?: string;
}

/**
 * A change's workflow chain in build order. Each step says its state with an
 * icon as well as a colour: written (check), skipped (dash), ready to write
 * (arrow; the first one is "next", as `openspec status` puts it), or waiting
 * on another artifact (lock).
 */
export function ArtifactChain({ artifacts, error, warnings = [], className }: ArtifactChainProps) {
  if (error) {
    return (
      <div
        className={cn(
          'flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300',
          className
        )}
        title={error}
        role="alert"
      >
        <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
        <span className="line-clamp-3">
          <span className="font-semibold">OpenSpec can't read this change.</span> {error}
        </span>
      </div>
    );
  }

  const next = nextArtifactId(artifacts);

  return (
    <ul className={cn('flex gap-1 flex-wrap items-center', className)} aria-label="Artifacts">
      {artifacts.map((artifact) => {
        const { label } = artifactMeta(artifact.id);
        const { Icon, label: statusLabel } = ARTIFACT_STATUS[artifact.status];
        const isNext = artifact.id === next;

        return (
          <li
            key={artifact.id}
            title={artifactTitle(artifact)}
            data-status={artifact.status}
            className={cn(
              'flex items-center gap-1 h-5 px-1.5 rounded text-[11px] leading-none whitespace-nowrap',
              artifact.status === 'done' && 'bg-muted/70 text-foreground/75',
              artifact.status === 'skipped' &&
                'text-muted-foreground border border-dashed border-muted-foreground/40 line-through decoration-muted-foreground/50',
              artifact.status === 'ready' && 'text-foreground ring-1 ring-inset ring-foreground/25',
              isNext && 'bg-primary/10 text-primary ring-primary/40 font-semibold',
              artifact.status === 'blocked' && 'text-muted-foreground'
            )}
          >
            <Icon
              className={cn(
                'h-3 w-3 shrink-0',
                artifact.status === 'done' && 'text-emerald-600 dark:text-emerald-400'
              )}
              aria-hidden
            />
            <span>{label}</span>
            {isNext ? (
              <span className="text-[10px] font-medium opacity-80">next</span>
            ) : (
              <span className="sr-only">
                , {artifact.status === 'blocked' && artifact.missingDeps.length > 0
                  ? `waiting for ${joinWords(artifact.missingDeps)}`
                  : statusLabel}
              </span>
            )}
          </li>
        );
      })}
      {warnings.length > 0 && (
        <li title={warnings.join('\n')} className="flex items-center text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          <span className="sr-only">OpenSpec warnings: {warnings.join(' ')}</span>
        </li>
      )}
    </ul>
  );
}
