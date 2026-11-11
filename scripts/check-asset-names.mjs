#!/usr/bin/env node
// Do the producers and consumers of release assets agree on their names?
//
//   node scripts/check-asset-names.mjs [dist-dir]
//
// Producers : release.yml build matrix + assemble list, npm/scripts/stamp.js
// Consumers : npm/lib/index.js (platform -> asset), install.sh (uname -> asset)
// With a dist dir, also the files actually produced (and what SHA256SUMS lists).
// Exit 1 on any disagreement.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const problems = [];
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const sorted = (xs) => [...new Set(xs)].sort();
const show = (label, xs) => console.log(`${label.padEnd(34)} ${xs.join(' ')}`);

// release.yml
const wf = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
const matrixIds = sorted([...wf.matchAll(/^\s+asset: ([a-z0-9_-]+)\s*$/gm)].map((m) => m[1]));
const assembleMatch = wf.match(/scripts\/assemble-release\.sh/);
const assembleSh = fs.readFileSync(path.join(root, 'scripts/assemble-release.sh'), 'utf8');
const assembleIds = sorted((assembleSh.match(/for id in ([^;]+); do/) || [, ''])[1].trim().split(/\s+/));
if (!assembleMatch) problems.push('release.yml no longer calls scripts/assemble-release.sh');

// stamp.js
const stamp = fs.readFileSync(path.join(root, 'npm/scripts/stamp.js'), 'utf8');
const stampIds = sorted([...((stamp.match(/const ids = \[([^\]]+)\]/) || [, ''])[1].matchAll(/'([^']+)'/g))].map((m) => m[1]));

// launcher
const lib = require(path.join(root, 'npm/lib/index.js'));
const launcherIds = sorted(Object.values(lib.PLATFORMS));
const launcherAssets = sorted(launcherIds.map((id) => lib.assetName(id)));

// install.sh, driven through fake uname/curl so the real script logic runs
const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-names-'));
fs.writeFileSync(path.join(shim, 'uname'), '#!/bin/sh\nif [ "$1" = "-s" ]; then echo "$FAKE_OS"; else echo "$FAKE_ARCH"; fi\n', { mode: 0o755 });
fs.writeFileSync(path.join(shim, 'sysctl'), '#!/bin/sh\necho 0\n', { mode: 0o755 });
fs.writeFileSync(path.join(shim, 'curl'), '#!/bin/sh\nfor a; do last="$a"; done\n# argv: ... -o <out> <url>\necho "$last" >> "$FAKE_LOG"\nexit 22\n', { mode: 0o755 });
const installAssets = [];
for (const [osName, arch] of [['Darwin', 'arm64'], ['Darwin', 'x86_64'], ['Linux', 'x86_64'], ['Linux', 'aarch64'], ['Linux', 'arm64'], ['Linux', 'amd64']]) {
  const log = path.join(shim, 'log');
  fs.rmSync(log, { force: true });
  spawnSync('sh', [path.join(root, 'install.sh')], {
    env: { PATH: `${shim}:/usr/bin:/bin`, HOME: shim, FAKE_OS: osName, FAKE_ARCH: arch, FAKE_LOG: log, OPENSPEC_UI_VERSION: '9.9.9' },
    encoding: 'utf8',
  });
  const first = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n')[0] : '';
  const name = first.split('/').pop();
  if (!name.endsWith('.gz')) problems.push(`install.sh on ${osName}/${arch} requested '${first}'`);
  else installAssets.push(name);
}
fs.rmSync(shim, { recursive: true, force: true });
const installSet = sorted(installAssets);

show('release.yml build matrix', matrixIds);
show('assemble-release.sh list', assembleIds);
show('stamp.js ids', stampIds);
show('launcher PLATFORMS ids', launcherIds);
show('install.sh requests', installSet);

const nonWindows = (xs) => xs.filter((x) => !x.includes('windows'));
if (!same(matrixIds, assembleIds)) problems.push('build matrix and assemble-release.sh list differ');
if (!same(matrixIds, stampIds)) problems.push('build matrix and stamp.js ids differ');
if (!same(matrixIds, launcherIds)) problems.push('build matrix and launcher platform ids differ');
if (!same(nonWindows(launcherAssets), installSet)) problems.push('launcher and install.sh disagree on non-Windows asset names');

const dist = process.argv[2];
if (dist) {
  const files = fs.readdirSync(dist).sort();
  const gz = sorted(files.filter((f) => /^openspec-ui-[a-z0-9_-]+\.gz$/.test(f)));
  show('dist .gz files', gz);
  if (!same(gz, launcherAssets)) problems.push('dist .gz files differ from what the launcher downloads');
  const tagMatch = files.find((f) => /^openspec-ui-v.*\.zip$/.test(f));
  const zipRe = /^openspec-ui-(v\d+\.\d+\.\d+.*?)-((?:darwin|linux|windows)-[a-z0-9_]+)\.zip$/;
  const zips = files.filter((f) => zipRe.test(f));
  const zipIds = sorted(zips.map((f) => f.match(zipRe)[2]));
  if (!tagMatch || !same(zipIds, matrixIds)) problems.push(`dist zips ${zipIds.join(',')} differ from build matrix`);
  for (const must of ['install.sh', 'SHA256SUMS']) if (!files.includes(must)) problems.push(`dist lacks ${must}`);
  const listed = fs.existsSync(path.join(dist, 'SHA256SUMS'))
    ? sorted(fs.readFileSync(path.join(dist, 'SHA256SUMS'), 'utf8').split('\n').filter(Boolean).map((l) => l.split(/\s+\*?/)[1]))
    : [];
  const expectListed = sorted(files.filter((f) => f !== 'SHA256SUMS'));
  if (!same(listed, expectListed)) problems.push(`SHA256SUMS lists ${listed.join(',')} but dist holds ${expectListed.join(',')}`);
}

if (problems.length) {
  console.error('\nasset name check FAILED:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\nasset names agree');
