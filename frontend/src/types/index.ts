export interface Source {
  id: string;
  name: string;
  path: string;
  valid: boolean;
}

export interface TaskStats {
  total: number;
  done: number;
}

export type ChangeStatus = 'draft' | 'todo' | 'in_progress' | 'done' | 'archived';

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
  readyForReview: boolean;
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
