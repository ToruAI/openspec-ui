import { describe, it, expect } from 'vitest';
import type { Artifact, Change, Source } from '../types';
import {
  defaultMobileStage,
  matchesQuery,
  repoColor,
  repoSummaries,
  sortChanges,
  splitArchivedName,
  stageOf,
} from './board';
import { parseTasks } from './tasks';
import { waitingSummary } from './artifacts';

const artifact = (id: string, status: Artifact['status']): Artifact => ({
  id,
  outputPath: `${id}.md`,
  status,
  requires: [],
  missingDeps: [],
});

function change(overrides: Partial<Change> = {}): Change {
  return {
    id: 'web/add-x',
    name: 'add-x',
    sourceId: 'web',
    status: 'todo',
    hasProposal: true,
    hasSpecs: true,
    hasTasks: true,
    hasDesign: true,
    taskStats: { done: 0, total: 4 },
    schema: 'spec-driven',
    artifacts: ['proposal', 'specs', 'design', 'tasks'].map((id) => artifact(id, 'done')),
    isPlanningComplete: true,
    applyRequires: ['tasks'],
    error: null,
    warnings: [],
    ...overrides,
  };
}

const source = (id: string, extra: Partial<Source> = {}): Source => ({ id, name: id, path: `/code/${id}`, valid: true, ...extra });

describe('stageOf', () => {
  it('maps openspec list statuses onto board stages', () => {
    expect(stageOf(change({ status: 'draft', taskStats: null }))).toBe('planning');
    expect(stageOf(change({ status: 'todo' }))).toBe('ready');
    expect(stageOf(change({ status: 'in_progress', taskStats: { done: 1, total: 4 } }))).toBe('in_progress');
    expect(stageOf(change({ status: 'done', taskStats: { done: 4, total: 4 } }))).toBe('complete');
    expect(stageOf(change({ status: 'archived' }))).toBe('archived');
  });

  it('keeps a change in planning while apply still needs an artifact, even if a task file exists', () => {
    const c = change({
      status: 'todo',
      artifacts: [artifact('plan', 'ready'), artifact('tasks', 'done')],
      applyRequires: ['plan', 'tasks'],
    });
    expect(stageOf(c)).toBe('planning');
  });

  it('treats a skipped artifact as satisfied for apply', () => {
    const c = change({ artifacts: [artifact('specs', 'skipped'), artifact('tasks', 'done')], applyRequires: ['specs', 'tasks'] });
    expect(stageOf(c)).toBe('ready');
  });
});

describe('repoSummaries', () => {
  it('counts active changes per stage and repo, and the workspace total', () => {
    const changes = [
      change({ id: 'web/a', sourceId: 'web', status: 'draft', taskStats: null }),
      change({ id: 'web/b', sourceId: 'web', status: 'in_progress', taskStats: { done: 2, total: 4 } }),
      change({ id: 'web/c', sourceId: 'web', status: 'archived' }),
      change({ id: 'api/d', sourceId: 'api', status: 'done', taskStats: { done: 3, total: 3 }, error: null }),
      change({ id: 'api/e', sourceId: 'api', status: 'draft', taskStats: null, error: 'Invalid .openspec.yaml' }),
    ];
    const { total, repos } = repoSummaries([source('web'), source('api')], changes);
    const web = repos.find((r) => r.id === 'web')!;
    expect(web.counts).toEqual({ planning: 1, ready: 0, in_progress: 1, complete: 0 });
    expect(web.active).toBe(2);
    expect(web.archived).toBe(1);
    expect(web.tasks).toEqual({ done: 2, total: 4 });
    expect(repos.find((r) => r.id === 'api')!.errors).toBe(1);
    expect(total.active).toBe(4);
    expect(total.tasks).toEqual({ done: 5, total: 7 });
  });

  it('flags a repo whose folder is gone or whose changes live in a store', () => {
    const { repos } = repoSummaries(
      [source('gone', { valid: false }), source('ptr', { planning: { kind: 'store_pointer', storeId: 'team', storePath: null, problem: null } })],
      []
    );
    expect(repos[0].problem).toBe('Folder not found');
    expect(repos[1].problem).toBe('Plans in store team');
  });
});

describe('helpers', () => {
  it('gives each of the first eight repos its own colour', () => {
    const sources = Array.from({ length: 8 }, (_, i) => source(`r${i}`));
    expect(new Set(sources.map((s) => repoColor(sources, s.id))).size).toBe(8);
  });

  it('searches names, repos and summaries', () => {
    const c = change({ summary: 'Refunds are all-or-nothing today' });
    expect(matchesQuery(c, 'refunds')).toBe(true);
    expect(matchesQuery(c, 'WEB')).toBe(true);
    expect(matchesQuery(c, 'nope')).toBe(false);
  });

  it('sorts by progress with name as the tie-break', () => {
    const a = change({ id: 'a', name: 'b-change', taskStats: { done: 1, total: 2 } });
    const b = change({ id: 'b', name: 'a-change', taskStats: { done: 1, total: 2 } });
    const c = change({ id: 'c', name: 'c-change', taskStats: { done: 2, total: 2 } });
    expect(sortChanges([a, b, c], 'progress-desc').map((x) => x.name)).toEqual(['c-change', 'a-change', 'b-change']);
  });

  it('opens a phone on the stage where work is moving', () => {
    expect(defaultMobileStage({ ideas: 9, planning: 2, in_progress: 3 })).toBe('in_progress');
    expect(defaultMobileStage({ ideas: 9, planning: 2, in_progress: 0 })).toBe('planning');
    expect(defaultMobileStage({ ideas: 9 })).toBe('ideas');
    expect(defaultMobileStage({})).toBe('in_progress');
  });

  it('splits the archive date off an archived change name', () => {
    expect(splitArchivedName('2026-08-12-add-email-login')).toEqual({ date: '2026-08-12', name: 'add-email-login' });
    expect(splitArchivedName('add-email-login')).toEqual({ date: null, name: 'add-email-login' });
  });
});

describe('parseTasks', () => {
  it('turns checkbox lines into tasks and keeps the markdown between them', () => {
    const blocks = parseTasks('## 1. Schema\n\n- [x] 1.1 Add column\n  - [ ] 1.1.1 Backfill\n* [X] 1.2 Index\n\nNotes here');
    expect(blocks).toEqual([
      { kind: 'markdown', text: '## 1. Schema' },
      { kind: 'task', done: true, text: '1.1 Add column', depth: 0 },
      { kind: 'task', done: false, text: '1.1.1 Backfill', depth: 1 },
      { kind: 'task', done: true, text: '1.2 Index', depth: 0 },
      { kind: 'markdown', text: 'Notes here' },
    ]);
  });
});

describe('waitingSummary', () => {
  it('says what each unwritten artifact waits for, grouped', () => {
    const blocked = (id: string, deps: string[]): Artifact => ({ ...artifact(id, 'blocked'), missingDeps: deps });
    expect(
      waitingSummary([artifact('proposal', 'ready'), blocked('specs', ['proposal']), blocked('design', ['proposal']), blocked('tasks', ['specs', 'design'])])
    ).toBe('Specs and design wait for proposal; tasks waits for specs and design');
    expect(waitingSummary([artifact('proposal', 'done'), artifact('tasks', 'ready')])).toBeNull();
  });
});
