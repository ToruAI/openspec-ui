/** Where a source's planning lives. OpenSpec stores are a beta feature. */
export interface PlanningRoot {
  /** local: its own changes/specs; store: a store checkout; store_pointer: config.yaml says `store: <id>` */
  kind: 'local' | 'store' | 'store_pointer';
  storeId: string | null;
  /** The store's openspec/ directory on this machine, when the pointer resolves */
  storePath: string | null;
  /** Why the declared store could not be resolved */
  problem: string | null;
}

export interface Source {
  id: string;
  name: string;
  path: string;
  valid: boolean;
  /** Absent for invalid sources and older backends */
  planning?: PlanningRoot | null;
}

export interface TaskStats {
  total: number;
  done: number;
}

export type ChangeStatus = 'draft' | 'todo' | 'in_progress' | 'done' | 'archived';

/** Verbatim from `openspec status --json`. */
export type ArtifactStatus = 'done' | 'skipped' | 'ready' | 'blocked';

export interface Artifact {
  id: string;
  /** The schema's `generates` path or glob, relative to the change */
  outputPath: string;
  status: ArtifactStatus;
  /** Artifacts this one depends on, per the workflow schema */
  requires: string[];
  /** Dependencies not yet done, when blocked */
  missingDeps: string[];
}

export interface Change {
  id: string;
  name: string;
  sourceId: string;
  status: ChangeStatus;
  hasProposal: boolean;
  hasSpecs: boolean;
  hasTasks: boolean;
  hasDesign: boolean;
  taskStats: TaskStats | null;
  /** Workflow schema: .openspec.yaml, else openspec/config.yaml, else spec-driven */
  schema: string | null;
  /** The schema's artifact chain in build order; empty when `error` is set */
  artifacts: Artifact[];
  /** Every artifact is done or skipped */
  isPlanningComplete: boolean;
  /** Artifacts required before implementation (schema `apply.requires`) */
  applyRequires: string[];
  /** Why OpenSpec cannot read this change */
  error: string | null;
  /** Non-fatal problems OpenSpec would warn about */
  warnings: string[];
}

export interface SpecContent {
  path: string;
  content: string;
}

export interface TasksContent {
  raw: string;
  stats: TaskStats;
}

export interface ChangeDetail {
  id: string;
  name: string;
  sourceId: string;
  status: ChangeStatus;
  proposal: string | null;
  design: string | null;
  specs: SpecContent[];
  tasks: TasksContent | null;
  schema: string | null;
  artifacts: Artifact[];
  isPlanningComplete: boolean;
  error: string | null;
  warnings: string[];
  /** Written files per artifact, in chain order */
  documents: ArtifactDocument[];
}

export interface ArtifactDocument {
  artifactId: string;
  files: SpecContent[];
}

export interface Spec {
  id: string;
  sourceId: string;
  path: string;
}

export interface SpecDetail {
  id: string;
  sourceId: string;
  path: string;
  content: string;
}

export interface Idea {
  id: string;
  sourceId: string;
  projectId: string | null;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
