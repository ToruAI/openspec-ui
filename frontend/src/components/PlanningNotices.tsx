import { Info } from 'lucide-react';
import type { Source } from '../types';

interface PlanningNoticesProps {
  sources: Source[];
  selectedSourceId: string | null;
}

/**
 * Sources whose openspec/config.yaml points at an OpenSpec store (beta): the
 * repo's changes live in the store, not here. The dashboard does not follow
 * the pointer, so say where the changes are instead of showing an empty board.
 */
export function PlanningNotices({ sources, selectedSourceId }: PlanningNoticesProps) {
  const pointers = sources.filter(
    (s) => s.planning?.kind === 'store_pointer' && (!selectedSourceId || s.id === selectedSourceId)
  );
  if (pointers.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {pointers.map((source) => (
        <div
          key={source.id}
          role="status"
          className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sm"
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-sky-500" />
          <div className="min-w-0">
            <span className="font-medium">{source.name}</span> plans in the OpenSpec store{' '}
            <code className="text-xs">{source.planning?.storeId ?? '?'}</code>, so its changes are not in this folder.{' '}
            {source.planning?.storePath ? (
              <>
                Add <code className="text-xs break-all">{source.planning.storePath}</code> as a source to see them.
              </>
            ) : (
              <span className="text-muted-foreground">{source.planning?.problem}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
