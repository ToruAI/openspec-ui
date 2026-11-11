#!/usr/bin/env node
// Records the API of the real backend, run against the demo workspace, as one static
// JSON file that the demo build of the frontend reads instead of a server.
//
//   node scripts/demo-snapshot.mjs [--backend PATH] [--workspace DIR] [--out FILE]
//
// Defaults: backend/target/release|debug/openspec-ui, demo/, frontend/demo-snapshot/snapshot.json
//
// Nothing here knows the shape of a response. Endpoints come from what the frontend
// asks for (frontend/src/hooks/useApi.ts) plus a baseline; every list that holds objects
// with an `id` is followed to its detail endpoint (/api/<list>/<id>). New fields and new
// endpoints in the UI therefore show up after re-running this script.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const workspace = path.resolve(arg('workspace', path.join(root, 'demo')));
const out = path.resolve(arg('out', path.join(root, 'frontend/demo-snapshot/snapshot.json')));
const backend =
  arg('backend') ??
  ['release', 'debug']
    .map((p) => path.join(root, 'backend/target', p, 'openspec-ui'))
    .find((p) => fs.existsSync(p));
if (!backend || !fs.existsSync(backend)) {
  console.error('No backend binary found. Build it first: cd backend && cargo build');
  process.exit(1);
}

// Shown in the demo instead of the machine that recorded it.
const DEMO_PORT = 3000;
const DEMO_ROOT = '/home/you/fernhill';

// Never recorded: live stream, and per-process facts.
const SKIP_ROOTS = new Set(['events']);
const DROP_KEYS = new Set(['pid']);
const BASELINE_ROOTS = ['info', 'sources', 'changes', 'specs', 'ideas', 'config'];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function endpointsUsedByFrontend() {
  const src = fs.readFileSync(path.join(root, 'frontend/src/hooks/useApi.ts'), 'utf8');
  const found = [...src.matchAll(/\$\{API_BASE\}\/([a-z][a-z0-9-]*)/g)].map((m) => m[1]);
  return [...new Set([...BASELINE_ROOTS, ...found])].filter((r) => !SKIP_ROOTS.has(r));
}

async function waitForServer(base, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`backend exited early (code ${child.exitCode})`);
    try {
      if ((await fetch(`${base}/api/info`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('backend did not start within 10s');
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const child = spawn(backend, ['--port', String(port), '--no-open'], {
  cwd: workspace,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, OPENSPEC_UI_HOST: '127.0.0.1' },
});
const stop = () => child.kill();
process.on('exit', stop);

const responses = {};
const stats = { ok: 0, skipped: 0 };

async function record(urlPath) {
  const res = await fetch(`${base}${urlPath}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    stats.skipped++;
    return null;
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    stats.skipped++;
    return null;
  }
  // Keyed by the decoded path: ids contain "/" and the UI requests them as %2F.
  responses[decodeURIComponent(urlPath)] = json;
  stats.ok++;
  return json;
}

try {
  await waitForServer(base, child);

  for (const r of endpointsUsedByFrontend()) {
    const json = await record(`/api/${r}`);
    if (!json) {
      if (BASELINE_ROOTS.includes(r)) throw new Error(`GET /api/${r} failed against ${workspace}`);
      continue;
    }
    // Follow every list of objects with an `id` to its detail endpoint.
    for (const [key, value] of Object.entries(json)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (item && typeof item.id === 'string') {
          await record(`/api/${key}/${encodeURIComponent(item.id)}`);
        }
      }
    }
  }
} finally {
  stop();
}

// Make the recording machine-independent.
function scrub(value, key) {
  if (typeof value === 'string') {
    let v = value;
    for (const p of new Set([workspace, fs.realpathSync(workspace)])) v = v.split(p).join(DEMO_ROOT);
    return v.split(base).join(`http://localhost:${DEMO_PORT}`);
  }
  if (Array.isArray(value)) return value.map((v) => scrub(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !DROP_KEYS.has(k))
        .map(([k, v]) => [k, k === 'port' && v === port ? DEMO_PORT : scrub(v, k)]),
    );
  }
  return value;
}

const snapshot = {
  capturedAt: new Date().toISOString(),
  responses: scrub(responses),
};
const text = JSON.stringify(snapshot);

for (const needle of [workspace, fs.realpathSync(workspace), process.env.HOME]) {
  if (needle && needle !== '/' && text.includes(needle)) {
    throw new Error(`snapshot still contains a local path (${needle}); refusing to write it`);
  }
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, text);
console.log(
  `snapshot: ${stats.ok} responses (${stats.skipped} skipped), ${(text.length / 1024).toFixed(0)} KB -> ${path.relative(root, out)}`,
);
