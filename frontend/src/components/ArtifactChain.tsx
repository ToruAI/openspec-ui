import { AlertTriangle } from 'lucide-react';
import type { Artifact } from '../types';
import { artifactMeta, artifactTitle, nextArtifactId } from '@/lib/artifacts';
import { cn } from '@/lib/utils';

interface ArtifactChainProps {
  artifacts: Artifact[];
  /** Set when OpenSpec cannot read the change; replaces the chain */
  error?: string | null;
  warnings?: string[];
  className?: string;
}

/**
 * A change's workflow chain in build order: written, skipped, ready to write
 * (the first one is marked "next"), or waiting on another artifact.
 */
export function ArtifactChain({ artifacts, error, warnings = [], className }: ArtifactChainProps) {
  if (error) {
    return (
      <div
        className={cn('flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400', className)}
        title={error}
        role="alert"
      >
        <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
        <span className="line-clamp-2">OpenSpec can't read this change: {error}</span>
      </div>
    );
  }

  const next = nextArtifactId(artifacts);

  return (
    <div className={cn('flex gap-2 flex-wrap items-center', className)}>
      {artifacts.map((artifact) => {
        const { label, Icon, tone } = artifactMeta(artifact.id);
        const isNext = artifact.id === next;

        return (
          <div
            key={artifact.id}
            title={artifactTitle(artifact)}
            data-status={artifact.status}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md transition-opacity',
              artifact.status === 'done' && tone,
              artifact.status === 'skipped' &&
                'text-muted-foreground/60 border border-dashed border-muted-foreground/30',
              artifact.status === 'ready' && 'bg-foreground/5 text-foreground/70 ring-1 ring-inset ring-foreground/15',
              artifact.status === 'blocked' && 'bg-muted/50 text-muted-foreground/50'
            )}
          >
            <Icon className="h-3 w-3" />
            <span className="text-[10px] font-medium">{label}</span>
            {isNext && <span className="text-[9px] font-normal opacity-70">next</span>}
            {artifact.status === 'skipped' && <span className="text-[9px] font-normal opacity-70">skipped</span>}
          </div>
        );
      })}
      {warnings.length > 0 && (
        <span title={warnings.join('\n')} className="text-amber-500" aria-label="OpenSpec warnings">
          <AlertTriangle className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}
