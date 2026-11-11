import { FileText, Layers, CheckSquare, Palette, File, Check, Minus, ArrowRight, Lock } from 'lucide-react';
import type { Artifact, Change } from '../types';

export interface ArtifactMeta {
  label: string;
  Icon: typeof FileText;
  /** Classes for a written artifact */
  tone: string;
  /** Text colour for icons in tabs */
  color: string;
}

/** Built-in spec-driven artifacts get their own look; anything a custom schema defines falls back to a neutral one. */
const KNOWN: Record<string, ArtifactMeta> = {
  proposal: { label: 'Proposal', Icon: FileText, tone: 'bg-blue-500/10 text-blue-500 dark:text-blue-400', color: 'text-blue-500' },
  design: { label: 'Design', Icon: Palette, tone: 'bg-purple-500/10 text-purple-500 dark:text-purple-400', color: 'text-purple-500' },
  specs: { label: 'Specs', Icon: Layers, tone: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400', color: 'text-emerald-500' },
  tasks: { label: 'Tasks', Icon: CheckSquare, tone: 'bg-amber-500/10 text-amber-500 dark:text-amber-400', color: 'text-amber-500' },
};

export function humanize(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function artifactMeta(id: string): ArtifactMeta {
  return KNOWN[id] ?? {
    label: humanize(id),
    Icon: File,
    tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    color: 'text-sky-500',
  };
}

/** How each artifact status reads; the icon carries it as much as the colour does. */
export const ARTIFACT_STATUS: Record<Artifact['status'], { label: string; Icon: typeof FileText }> = {
  done: { label: 'written', Icon: Check },
  skipped: { label: 'skipped', Icon: Minus },
  ready: { label: 'ready to write', Icon: ArrowRight },
  blocked: { label: 'waiting', Icon: Lock },
};

/** "a", "a and b", "a, b and c" */
export function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * What the unwritten artifacts are waiting for, in one line:
 * "Specs and design wait for proposal; tasks waits for specs and design".
 */
export function waitingSummary(artifacts: Artifact[]): string | null {
  const groups = new Map<string, string[]>();
  for (const a of artifacts) {
    if (a.status !== 'blocked' || a.missingDeps.length === 0) continue;
    const deps = joinWords(a.missingDeps.map((d) => artifactMeta(d).label.toLowerCase()));
    groups.set(deps, [...(groups.get(deps) ?? []), artifactMeta(a.id).label.toLowerCase()]);
  }
  if (groups.size === 0) return null;
  const parts = [...groups].map(([deps, ids]) => `${joinWords(ids)} ${ids.length === 1 ? 'waits' : 'wait'} for ${deps}`);
  const line = parts.join('; ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** Tooltip text, in the same terms `openspec status` uses. */
export function artifactTitle(artifact: Artifact): string {
  switch (artifact.status) {
    case 'done':
      return `Written (${artifact.outputPath})`;
    case 'skipped':
      return 'Skipped — this change declares skip_specs (no spec changes)';
    case 'ready':
      return `Ready to write (${artifact.outputPath}) — nothing blocking it`;
    case 'blocked':
      return artifact.missingDeps.length > 0
        ? `Waiting for ${joinWords(artifact.missingDeps)}`
        : 'Not written yet';
  }
}

/** The artifact OpenSpec would tell you to write next: the first ready one in build order. */
export function nextArtifactId(artifacts: Artifact[]): string | null {
  return artifacts.find((a) => a.status === 'ready')?.id ?? null;
}

/**
 * The chain to show for a change. A backend that predates `artifacts`
 * only sends the has* flags; show what exists so the card is not blank.
 */
export function changeArtifacts(change: Change): Artifact[] {
  if (Array.isArray(change.artifacts)) return change.artifacts;
  const present: [string, boolean][] = [
    ['proposal', change.hasProposal],
    ['specs', change.hasSpecs],
    ['design', change.hasDesign],
    ['tasks', change.hasTasks],
  ];
  return present.map(([id, written]) => ({
    id,
    outputPath: id,
    status: written ? 'done' : 'blocked',
    requires: [],
    missingDeps: [],
  }));
}
