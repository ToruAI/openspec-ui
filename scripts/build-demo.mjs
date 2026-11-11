#!/usr/bin/env node
// Builds the static live demo into frontend/dist-demo/.
//
//   node scripts/demo-snapshot.mjs   # once, and after demo/ or the API changes
//   node scripts/build-demo.mjs      # or: cd frontend && npm run build:demo
//
// The snapshot is copied next to the app instead of being imported by it, so the
// JavaScript bundle stays small and the normal build can never contain it.
//
// DEMO_BASE sets the URL sub-path (default /openspec-ui/, GitHub Pages project site).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'frontend');
const snapshot = path.join(frontend, 'demo-snapshot/snapshot.json');
const dist = path.join(frontend, 'dist-demo');

if (!fs.existsSync(snapshot)) {
  console.error(`Missing ${path.relative(root, snapshot)}. Run: node scripts/demo-snapshot.mjs`);
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
fs.rmSync(dist, { recursive: true, force: true });
execFileSync(npx, ['tsc', '-b'], { cwd: frontend, stdio: 'inherit' });
execFileSync(npx, ['vite', 'build', '--mode', 'demo'], { cwd: frontend, stdio: 'inherit' });

fs.copyFileSync(snapshot, path.join(dist, 'snapshot.json'));
// Pages serves 404.html for unknown paths; the app has no routes, so send them to the board.
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
// No Jekyll processing of the output.
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`demo built: ${path.relative(root, dist)}/`);
