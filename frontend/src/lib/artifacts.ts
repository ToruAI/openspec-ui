import { FileText, Layers, CheckSquare, Palette, File } from 'lucide-react';
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
        ? `Waiting for ${artifact.missingDeps.join(' and ')}`
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
