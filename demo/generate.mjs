#!/usr/bin/env node
// Regenerates the demo workspace (demo/<repo>/openspec/...) with the real OpenSpec CLI.
//
//   node demo/generate.mjs                 # all repos, OpenSpec version pinned below
//   OPENSPEC_VERSION=latest node demo/generate.mjs
//   node demo/generate.mjs storefront      # one repo
//
// The CLI creates everything it owns (config.yaml, change markers, archive layout,
// merged living specs). The prose lives in demo/src/<repo>.mjs.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDesign, renderIdea, renderProposal, renderSpecDelta, renderTasks } from './src/lib.mjs';

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const VERSION = process.env.OPENSPEC_VERSION ?? '1.17.0';
const REPOS = ['storefront', 'payments-api', 'mobile-app', 'platform-infra'];
const only = process.argv.slice(2);

// Install the pinned CLI once into demo/.cache (gitignored) so we do not pay npx startup per call.
function resolveBin() {
  if (process.env.OPENSPEC_BIN) return process.env.OPENSPEC_BIN;
  const prefix = path.join(demoDir, '.cache', VERSION);
  const bin = path.join(prefix, 'node_modules/.bin/openspec');
  if (!fs.existsSync(bin)) {
    fs.mkdirSync(prefix, { recursive: true });
    execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund', '--prefix', prefix, `@fission-ai/openspec@${VERSION}`], { stdio: 'inherit' });
  }
  return bin;
}
const BIN = resolveBin();

function openspec(cwd, ...args) {
  return execFileSync(BIN, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, OPENSPEC_TELEMETRY: '0', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

function touch(dir, date) {
  const t = new Date(`${date}T10:30:00Z`);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) touch(p, date);
    fs.utimesSync(p, t, t);
  }
}

function writeChange(root, c) {
  const dir = path.join(root, 'openspec/changes', c.name);
  openspec(root, 'new', 'change', c.name, ...(c.goal ? ['--goal', c.goal] : []));

  // The CLI stamps today's date; use the scenario date instead, and flag skip_specs.
  const marker = path.join(dir, '.openspec.yaml');
  let yaml = fs.readFileSync(marker, 'utf8').replace(/^created: .*$/m, `created: ${c.created}`);
  if (c.skipSpecs) yaml = yaml.replace(/\s*$/, '\nskip_specs: true\n');
  fs.writeFileSync(marker, yaml);

  if (c.proposal) write(path.join(dir, 'proposal.md'), renderProposal(c.proposal));
  if (c.design) write(path.join(dir, 'design.md'), renderDesign(c.design));
  for (const [cap, delta] of Object.entries(c.specs ?? {})) {
    write(path.join(dir, 'specs', cap, 'spec.md'), renderSpecDelta(delta));
  }
  if (c.tasks) write(path.join(dir, 'tasks.md'), renderTasks(c.tasks, c.done));
  return dir;
}

async function build(repo) {
  const def = (await import(`./src/${repo}.mjs`)).default;
  const root = path.join(demoDir, repo);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  console.log(`\n== ${repo}`);

  openspec(root, 'init', '--tools', 'none', '--force');
  const cfg = path.join(root, 'openspec/config.yaml');
  const context = def.context.trim().split('\n').map((l) => `  ${l}`).join('\n');
  fs.writeFileSync(cfg, `schema: spec-driven\n\ncontext: |\n${context}\n`);
  fs.rmSync(path.join(root, 'openspec/changes/archive/.gitkeep'), { force: true });

  // Archived first, oldest to newest, so living specs accumulate in the right order.
  const archived = def.changes.filter((c) => c.archivedOn).sort((a, b) => a.archivedOn.localeCompare(b.archivedOn));
  for (const c of archived) {
    writeChange(root, c);
    openspec(root, 'archive', c.name, '--yes', ...(c.skipSpecs ? ['--skip-specs'] : []));
    const arch = path.join(root, 'openspec/changes/archive');
    const made = fs.readdirSync(arch).find((n) => n.endsWith(`-${c.name}`) && !n.startsWith(c.archivedOn));
    if (!made) throw new Error(`archive dir for ${c.name} not found`);
    fs.renameSync(path.join(arch, made), path.join(arch, `${c.archivedOn}-${c.name}`));
    touch(path.join(arch, `${c.archivedOn}-${c.name}`), c.archivedOn);
    console.log(`  archived ${c.archivedOn} ${c.name}`);
  }
  for (const c of def.changes.filter((c) => !c.archivedOn)) {
    touch(writeChange(root, c), c.touched ?? c.created);
    console.log(`  active   ${c.name}`);
  }

  def.ideas.forEach((idea, i) => {
    const ms = new Date(idea.createdAt).getTime();
    const id = `idea-${ms}`;
    write(
      path.join(root, 'openspec/ideas', `${id}.md`),
      renderIdea({ id, projectId: repo, ...idea, createdAt: new Date(ms).toISOString() }),
    );
  });

  // Changes that are still being drafted fail validation by design (no deltas yet); report, do not abort.
  try {
    console.log(openspec(root, 'validate', '--all').trim().split('\n').slice(-2).join('\n'));
  } catch (e) {
    console.log(`${e.stdout}${e.stderr}`.trim().split('\n').filter((l) => /^(✗|Totals)|ERROR/.test(l.trim())).map((l) => l.slice(0, 160)).join('\n'));
  }
}

console.log(`OpenSpec ${VERSION}`);
for (const repo of REPOS.filter((r) => !only.length || only.includes(r))) await build(repo);

fs.writeFileSync(
  path.join(demoDir, 'openspec-ui.json'),
  JSON.stringify(
    {
      sources: REPOS.map((r) => ({ name: r, path: `./${r}/openspec` })),
      port: 3000,
    },
    null,
    2,
  ) + '\n',
);
