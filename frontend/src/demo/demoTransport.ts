/**
 * Answers the UI's API calls from a recorded snapshot (scripts/demo-snapshot.mjs) in
 * place of the real server. Only ever loaded in the demo build, see lib/transport.ts.
 *
 * - Reads: looked up by request path in the snapshot, so any endpoint the snapshot
 *   script recorded works without code here.
 * - Ideas: created, edited and deleted in memory for the session (gone on reload).
 * - Everything else that writes (sources/config) is refused with an explanation.
 * - Timestamps: shifted at load time so the freshest one is about a day old, so
 *   "3d ago" labels never go stale however long ago the snapshot was taken.
 */

interface Snapshot {
  capturedAt: string;
  responses: Record<string, unknown>;
}

interface IdeaRecord {
  id: string;
  sourceId: string;
  projectId: string | null;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const API_PREFIX = '/api';
const FRESHEST_AGE_MS = 24 * 60 * 60 * 1000;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export const DEMO_READ_ONLY_MESSAGE =
  'Sources are fixed in the live demo. Run `npx openspec-web` in your own repo to point it at your projects.';

let snapshotPromise: Promise<Snapshot> | null = null;
let ideas: IdeaRecord[] | null = null;

function collectTimestamps(value: unknown, out: number[]): void {
  if (typeof value === 'string') {
    if (ISO_TIMESTAMP.test(value)) out.push(Date.parse(value));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectTimestamps(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectTimestamps(v, out));
  }
}

function shiftTimestamps<T>(value: T, delta: number): T {
  if (typeof value === 'string') {
    return (ISO_TIMESTAMP.test(value) ? new Date(Date.parse(value) + delta).toISOString() : value) as T;
  }
  if (Array.isArray(value)) return value.map((v) => shiftTimestamps(v, delta)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shiftTimestamps(v, delta)]),
    ) as T;
  }
  return value;
}

function loadSnapshot(): Promise<Snapshot> {
  if (!snapshotPromise) {
    snapshotPromise = fetch(`${import.meta.env.BASE_URL}snapshot.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Demo snapshot unavailable (HTTP ${res.status})`);
        return res.json() as Promise<Snapshot>;
      })
      .then((snap) => {
        const stamps: number[] = [];
        collectTimestamps(snap.responses, stamps);
        if (stamps.length === 0) return snap;
        const delta = Date.now() - FRESHEST_AGE_MS - Math.max(...stamps);
        return { ...snap, responses: shiftTimestamps(snap.responses, delta) };
      });
    // A failed load (e.g. offline) must not be cached forever.
    snapshotPromise.catch(() => {
      snapshotPromise = null;
    });
  }
  return snapshotPromise;
}

async function ideaStore(): Promise<IdeaRecord[]> {
  if (!ideas) {
    const snap = await loadSnapshot();
    const recorded = snap.responses[`${API_PREFIX}/ideas`] as { ideas?: IdeaRecord[] } | undefined;
    ideas = [...(recorded?.ideas ?? [])];
  }
  return ideas;
}

function parseBody(options?: RequestInit): Record<string, unknown> {
  try {
    return typeof options?.body === 'string' ? JSON.parse(options.body) : {};
  } catch {
    return {};
  }
}

export async function demoFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const path = decodeURIComponent(new URL(url, 'http://demo.invalid').pathname);
  const snap = await loadSnapshot();
  const result = await route(method, path, options, snap);
  return result as T;
}

async function route(method: string, path: string, options: RequestInit | undefined, snap: Snapshot): Promise<unknown> {
  const ideaPath = path.match(new RegExp(`^${API_PREFIX}/ideas/(.+)$`));

  if (path === `${API_PREFIX}/ideas` || ideaPath) {
    const store = await ideaStore();
    const body = parseBody(options);
    const now = new Date().toISOString();

    if (method === 'GET' && !ideaPath) return { ideas: [...store] };

    if (method === 'POST' && !ideaPath) {
      const sources = (snap.responses[`${API_PREFIX}/sources`] as { sources?: { id: string }[] } | undefined)?.sources ?? [];
      const sourceId = (body.sourceId as string | null | undefined) ?? sources[0]?.id ?? 'demo';
      const idea: IdeaRecord = {
        id: `${sourceId}/idea-${Date.now()}`,
        sourceId,
        projectId: sourceId,
        title: String(body.title ?? ''),
        description: String(body.description ?? ''),
        createdAt: now,
        updatedAt: now,
      };
      store.unshift(idea);
      return idea;
    }

    const index = store.findIndex((i) => i.id === ideaPath?.[1]);
    if (index === -1) throw new Error('Idea not found');
    if (method === 'PUT') {
      store[index] = {
        ...store[index],
        title: String(body.title ?? store[index].title),
        description: String(body.description ?? store[index].description),
        updatedAt: now,
      };
      return store[index];
    }
    if (method === 'DELETE') {
      store.splice(index, 1);
      return {};
    }
  }

  if (method !== 'GET') throw new Error(DEMO_READ_ONLY_MESSAGE);

  if (path in snap.responses) return snap.responses[path];
  throw new Error(`HTTP 404: ${path} is not part of the demo snapshot`);
}
