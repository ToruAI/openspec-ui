import { Archive, CircleCheck, CircleDashed, Circle, Contrast, Lightbulb } from 'lucide-react';
import type { Change, Source } from '../types';

/**
 * Where a change sits on the board. Mirrors `openspec list` (no-tasks /
 * in-progress / complete) and splits its "in-progress" into ready (nothing
 * checked yet) and in progress, which is what people scan a board for.
 */
export type Stage = 'planning' | 'ready' | 'in_progress' | 'complete' | 'archived';

export type ActiveStage = Exclude<Stage, 'archived'>;

export const ACTIVE_STAGES: ActiveStage[] = ['planning', 'ready', 'in_progress', 'complete'];

export interface StageMeta {
  label: string;
  /** One line on what puts a change here, in OpenSpec's terms */
  hint: string;
  Icon: typeof Circle;
  /** Icon colour */
  color: string;
  /** Solid fill for bars */
  fill: string;
}

/** Each stage has its own icon shape too, so colour is never the only cue. */
export const STAGES: Record<Stage, StageMeta> = {
  planning: {
    label: 'Planning',
    hint: 'No tasks yet: the proposal, specs and design are being written',
    Icon: CircleDashed,
    color: 'text-sky-600 dark:text-sky-400',
    fill: 'bg-sky-500',
  },
  ready: {
    label: 'Ready to apply',
    hint: 'Tasks are written, none checked off yet',
    Icon: Circle,
    color: 'text-slate-500 dark:text-slate-400',
    fill: 'bg-slate-400 dark:bg-slate-500',
  },
  in_progress: {
    label: 'In progress',
    hint: 'Tasks are being checked off',
    Icon: Contrast,
    color: 'text-amber-600 dark:text-amber-400',
    fill: 'bg-amber-500',
  },
  complete: {
    label: 'Complete',
    hint: 'Every task is checked; ready to archive',
    Icon: CircleCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    fill: 'bg-emerald-500',
  },
  archived: {
    label: 'Archived',
    hint: 'Moved to changes/archive and merged into the specs',
    Icon: Archive,
    color: 'text-muted-foreground',
    fill: 'bg-muted-foreground/40',
  },
};

export const IDEAS_META = {
  label: 'Ideas',
  hint: 'Notes captured in this dashboard (openspec/ideas/), not OpenSpec changes yet',
  Icon: Lightbulb,
  color: 'text-violet-600 dark:text-violet-400',
};

/** Artifacts `apply` needs that are neither written nor skipped. */
export function missingForApply(change: Change): string[] {
  const byId = new Map((change.artifacts ?? []).map((a) => [a.id, a.status]));
  return (change.applyRequires ?? []).filter((id) => {
    const status = byId.get(id);
    return status !== undefined && status !== 'done' && status !== 'skipped';
  });
}

export function stageOf(change: Change): Stage {
  switch (change.status) {
    case 'archived':
      return 'archived';
    case 'draft':
      return 'planning';
    case 'in_progress':
      return 'in_progress';
    case 'done':
      return 'complete';
    case 'todo':
      // Tasks exist but the schema says something else must be written first.
      return missingForApply(change).length > 0 ? 'planning' : 'ready';
  }
}

/** `openspec archive` prefixes the folder with the date: 2026-08-12-add-email-login. */
export function splitArchivedName(name: string): { date: string | null; name: string } {
  const match = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(name);
  return match ? { date: match[1], name: match[2] } : { date: null, name };
}

export function taskProgress(change: Change): number | null {
  const s = change.taskStats;
  return s && s.total > 0 ? s.done / s.total : null;
}

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

/** Distinct, readable in both themes. Assigned by position, so up to eight repos never share one. */
const REPO_COLORS = [
  'bg-teal-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-lime-500',
  'bg-yellow-500',
];

export function repoColor(sources: Source[], sourceId: string): string {
  const index = sources.findIndex((s) => s.id === sourceId);
  return REPO_COLORS[(index < 0 ? 0 : index) % REPO_COLORS.length];
}

export interface RepoSummary {
  id: string;
  name: string;
  path: string;
  /** Active changes per stage */
  counts: Record<ActiveStage, number>;
  active: number;
  archived: number;
  /** Checked / total tasks over active changes that have tasks */
  tasks: { done: number; total: number };
  /** Changes OpenSpec cannot read */
  errors: number;
  /** Something about the repo itself: missing folder, store pointer */
  problem: string | null;
}

function emptyCounts(): RepoSummary['counts'] {
  return { planning: 0, ready: 0, in_progress: 0, complete: 0 };
}

export function summarize(id: string, name: string, path: string, changes: Change[]): RepoSummary {
  const summary: RepoSummary = {
    id,
    name,
    path,
    counts: emptyCounts(),
    active: 0,
    archived: 0,
    tasks: { done: 0, total: 0 },
    errors: 0,
    problem: null,
  };
  for (const change of changes) {
    const stage = stageOf(change);
    if (stage === 'archived') {
      summary.archived += 1;
      continue;
    }
    summary.active += 1;
    summary.counts[stage] += 1;
    if (change.taskStats) {
      summary.tasks.done += change.taskStats.done;
      summary.tasks.total += change.taskStats.total;
    }
    if (change.error) summary.errors += 1;
  }
  return summary;
}

function sourceProblem(source: Source): string | null {
  if (!source.valid) return 'Folder not found';
  if (source.planning?.kind === 'store_pointer') return `Plans in store ${source.planning.storeId ?? ''}`.trim();
  return null;
}

/** One summary per source, in source order, plus the workspace total. */
export function repoSummaries(sources: Source[], changes: Change[]): { total: RepoSummary; repos: RepoSummary[] } {
  const repos = sources.map((source) => ({
    ...summarize(
      source.id,
      source.name,
      source.path,
      changes.filter((c) => c.sourceId === source.id)
    ),
    problem: sourceProblem(source),
  }));
  const total = summarize('', 'All repos', '', changes);
  return { total, repos };
}

// ---------------------------------------------------------------------------
// Filtering and sorting
// ---------------------------------------------------------------------------

export type SortOption = 'name-asc' | 'name-desc' | 'progress-asc' | 'progress-desc';

export function matchesQuery(change: Change, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [change.name, change.sourceId, change.title, change.summary].some(
    (field) => typeof field === 'string' && field.toLowerCase().includes(q)
  );
}

export function sortChanges(changes: Change[], sortBy: SortOption): Change[] {
  const result = [...changes];
  const byName = (a: Change, b: Change) => a.name.localeCompare(b.name) || a.sourceId.localeCompare(b.sourceId);
  const progress = (c: Change) => taskProgress(c) ?? 0;
  switch (sortBy) {
    case 'name-asc':
      return result.sort(byName);
    case 'name-desc':
      return result.sort((a, b) => byName(b, a));
    case 'progress-asc':
      return result.sort((a, b) => progress(a) - progress(b) || byName(a, b));
    case 'progress-desc':
      return result.sort((a, b) => progress(b) - progress(a) || byName(a, b));
  }
}

/**
 * The column a phone opens on: where work is moving, else what is being
 * planned, else whatever has something in it.
 */
export function defaultMobileStage(counts: Partial<Record<Stage | 'ideas', number>>): Stage | 'ideas' {
  const order: (Stage | 'ideas')[] = ['in_progress', 'planning', 'ready', 'complete', 'ideas', 'archived'];
  return order.find((stage) => (counts[stage] ?? 0) > 0) ?? 'in_progress';
}
