#!/usr/bin/env node
// Conformance fixture generator.
//
// Builds a set of small OpenSpec projects with the real `openspec` CLI, then
// records what the CLI itself says about them (`openspec list --all --json`
// and `openspec status --all --json`). `cargo test` compares openspec-ui's scan
// of the same files against those recorded answers, offline.
//
//   node conformance/generate.mjs                      # latest OpenSpec from npm
//   node conformance/generate.mjs --version 1.17.0     # a specific release
//   node conformance/generate.mjs --openspec-bin path  # an already-installed CLI
//   node conformance/generate.mjs --out some/dir       # write somewhere else
//
// Every fixture is mutated first (CLI commands and hand-written files), then
// normalised (fixed dates, .gitkeep in empty dirs), and only then queried, so
// the recorded answers describe exactly the bytes that get committed.
//
// The output is deterministic for a given OpenSpec version: re-running it with
// the same version must leave `git status` clean.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXED_DATE = '2026-01-01';

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { version: process.env.OPENSPEC_VERSION || 'latest', out: path.join(HERE, 'fixtures'), bin: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--version') { args.version = value; i += 1; }
    else if (flag === '--out') { args.out = path.resolve(value); i += 1; }
    else if (flag === '--openspec-bin') { args.bin = path.resolve(value); i += 1; }
    else if (flag === '-h' || flag === '--help') {
      console.log('usage: node conformance/generate.mjs [--version <npm version>] [--openspec-bin <path>] [--out <dir>]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// OpenSpec CLI
// ---------------------------------------------------------------------------

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return result;
}

function installOpenSpec(version, workDir) {
  const prefix = path.join(workDir, 'cli');
  fs.mkdirSync(prefix, { recursive: true });
  fs.writeFileSync(path.join(prefix, 'package.json'), '{"private":true}\n');
  console.error(`Installing @fission-ai/openspec@${version} ...`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  // --ignore-scripts: this runs on main and on a schedule with whatever npm
  // calls "latest"; the CLI works without install scripts, so none run.
  const result = run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error', `@fission-ai/openspec@${version}`], { cwd: prefix, shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`npm install failed:\n${result.stdout}\n${result.stderr}`);
  }
  return path.join(prefix, 'node_modules', '@fission-ai', 'openspec', 'bin', 'openspec.js');
}

function packageDirFromBin(bin) {
  // bin/openspec.js -> package root
  let dir = path.dirname(fs.realpathSync(bin));
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Cannot find package.json above ${bin}`);
    dir = parent;
  }
  return dir;
}

function makeCli(bin, env) {
  return (cwd, args, { allowFailure = false } = {}) => {
    const result = run(process.execPath, [bin, ...args], { cwd, env });
    if (result.status !== 0 && !allowFailure) {
      throw new Error(`openspec ${args.join(' ')} failed in ${cwd} (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
    }
    return result;
  };
}

function baseEnv(dataDir) {
  return {
    ...process.env,
    XDG_DATA_HOME: dataDir,
    XDG_CONFIG_HOME: path.join(dataDir, '.config'),
    LOCALAPPDATA: dataDir,
    APPDATA: dataDir,
    DO_NOT_TRACK: '1',
    OPENSPEC_TELEMETRY: '0',
    OPENSPEC_NO_UPDATE_CHECK: '1',
    NO_COLOR: '1',
    CI: '1',
  };
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function append(root, rel, content) {
  fs.appendFileSync(path.join(root, rel), content);
}

function mkdir(root, rel) {
  fs.mkdirSync(path.join(root, rel), { recursive: true });
}

function walkDirs(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirs(full, visit);
      visit(full);
    }
  }
}

/** Pin every date OpenSpec stamps so regeneration produces no diff. */
function normalise(projectDir) {
  walkDirs(projectDir, (dir) => {
    const marker = path.join(dir, '.openspec.yaml');
    if (fs.existsSync(marker)) {
      const content = fs.readFileSync(marker, 'utf-8');
      fs.writeFileSync(marker, content.replace(/^created: \d{4}-\d{2}-\d{2}$/m, `created: ${FIXED_DATE}`));
    }
  });
  // `openspec archive` prefixes today's local date; hand-written archive
  // entries (legacy fixtures) keep theirs.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  walkDirs(projectDir, (dir) => {
    if (path.basename(dir) !== 'archive') return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(`${today}-`)) {
        fs.renameSync(path.join(dir, entry.name), path.join(dir, `${FIXED_DATE}-${entry.name.slice(today.length + 1)}`));
      }
    }
  });
  // Git cannot hold empty directories; a .gitkeep keeps them and is invisible
  // to OpenSpec (dot files never match artifact globs or change markers).
  walkDirs(projectDir, (dir) => {
    if (fs.readdirSync(dir).length === 0) fs.writeFileSync(path.join(dir, '.gitkeep'), '');
  });
}

function copyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

// ---------------------------------------------------------------------------
// Recording the CLI's answers
// ---------------------------------------------------------------------------

function parseJson(result, what) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${what} did not print JSON (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
}

function scrub(text, projectDir) {
  // Real path first: on macOS the temp dir is a symlink, and the real path
  // (/private/var/...) contains the symlinked one (/var/...).
  return text.split(fs.realpathSync(projectDir)).join('<project>').split(projectDir).join('<project>');
}

function record(cli, projectDir, version, testCase) {
  const list = parseJson(cli(projectDir, ['list', '--all', '--json', '--sort', 'name']), 'openspec list');
  // `status --all` exits 1 when any change fails to load but still prints the
  // whole envelope; per-change failures are part of the truth we record.
  const status = parseJson(cli(projectDir, ['status', '--all', '--json'], { allowFailure: true }), 'openspec status');

  const statusByChange = {};
  for (const entry of status.changes ?? []) {
    if (Array.isArray(entry.artifacts)) {
      statusByChange[entry.changeName] = {
        ok: true,
        schemaName: entry.schemaName,
        isPlanningComplete: entry.isPlanningComplete,
        applyRequires: entry.applyRequires,
        warnings: (entry.warnings ?? []).length,
        artifacts: entry.artifacts.map((a) => ({
          id: a.id,
          outputPath: a.outputPath,
          status: a.status,
          requires: a.requires ?? [],
          missingDeps: a.missingDeps ?? [],
        })),
      };
    } else {
      const first = (entry.status ?? [])[0] ?? {};
      statusByChange[entry.changeName] = {
        ok: false,
        code: first.code ?? null,
        message: scrub(String(first.message ?? ''), projectDir),
      };
    }
  }

  const root = list.root ?? {};
  return {
    case: testCase.name,
    description: testCase.description,
    openspecVersion: version,
    userData: Boolean(testCase.userData),
    root: { source: root.source ?? null, ...(root.store_id ? { storeId: root.store_id } : {}) },
    list: (list.changes ?? []).map((c) => ({
      name: c.name,
      archived: Boolean(c.archived),
      completedTasks: c.completedTasks,
      totalTasks: c.totalTasks,
      status: c.status,
      ...(c.nested ? { nested: c.nested } : {}),
    })),
    status: statusByChange,
  };
}

function builtinSchemas(packageDir) {
  const require = createRequire(path.join(packageDir, 'package.json'));
  const YAML = require('yaml');
  const schemasDir = path.join(packageDir, 'schemas');
  const out = {};
  for (const name of fs.readdirSync(schemasDir).sort()) {
    const file = path.join(schemasDir, name, 'schema.yaml');
    if (!fs.existsSync(file)) continue;
    const schema = YAML.parse(fs.readFileSync(file, 'utf-8'));
    out[name] = {
      name: schema.name,
      artifacts: schema.artifacts.map((a) => ({ id: a.id, generates: a.generates, requires: a.requires ?? [] })),
      apply: schema.apply ? { requires: schema.apply.requires, tracks: schema.apply.tracks ?? null } : null,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fixture content
// ---------------------------------------------------------------------------

const PROPOSAL = '# Proposal\n\n## Why\nUsers need to sign in.\n\n## What Changes\n- Add login\n';
const DESIGN = '# Design\n\nSession cookies, server-side store.\n';
const SPEC_DELTA = [
  '## ADDED Requirements',
  '',
  '### Requirement: Login',
  'The system SHALL let a registered user sign in.',
  '',
  '#### Scenario: Valid credentials',
  '- **WHEN** a user submits valid credentials',
  '- **THEN** a session is created',
  '',
].join('\n');
const tasks = (...items) => `# Tasks\n\n## 1. Work\n${items.map(([done, text], i) => `- [${done ? 'x' : ' '}] 1.${i + 1} ${text}`).join('\n')}\n`;

const TASK_TORTURE = [
  '# Tasks',
  '',
  '- [ ] dash open',
  '- [x] dash done',
  '- [X] dash done upper',
  '  - [ ] indented sub-task',
  '\t- [x] tab-indented sub-task',
  '* [ ] star open',
  '+ [x] plus done',
  '1. [ ] ordered dot',
  '2) [x] ordered paren',
  '123456789. [ ] nine digits',
  '1234567890. [ ] ten digits is not a list marker',
  '-[x] no space after marker',
  '- [~] tilde counts as open',
  '- [] empty box counts as open',
  '- [ x ] padded done',
  '- [ ](./link) whitespace box followed by link still counts',
  '- [x](./link) link bullet is not a task',
  '- [A](https://example.com) one-letter link is not a task',
  '- [1][ref] reference link is not a task',
  '- [WIP] multi-letter label is not a task',
  '- [\u{1F680}] astral marker is not a task',
  '- [é] accented marker counts as open',
  '-  [x] extra space before box',
  'Not a list - [ ] inline',
  '```',
  '- [ ] fenced checkboxes still count',
  '```',
  '<!-- - [x] commented checkboxes still count -->',
  '- [x] wrapped task whose text',
  '  continues on the next line',
  '',
].join('\n');

// Each case is one OpenSpec project. `build` mutates it; nothing is queried
// until every case-specific write is done.
const CASES = [
  {
    name: 'spec-driven',
    description: 'Built-in spec-driven workflow at every stage, plus artifact-detection edge cases and an archived change.',
    build({ cli, dir, w, md }) {
      const change = (name) => cli(dir, ['new', 'change', name]);
      change('fresh');
      change('proposal-only'); w('openspec/changes/proposal-only/proposal.md', PROPOSAL);
      change('proposal-and-design'); w('openspec/changes/proposal-and-design/proposal.md', PROPOSAL); w('openspec/changes/proposal-and-design/design.md', DESIGN);
      change('tasks-without-design-or-specs'); w('openspec/changes/tasks-without-design-or-specs/tasks.md', tasks([false, 'a'], [false, 'b']));
      change('partial-tasks');
      w('openspec/changes/partial-tasks/proposal.md', PROPOSAL);
      w('openspec/changes/partial-tasks/design.md', DESIGN);
      w('openspec/changes/partial-tasks/specs/auth/spec.md', SPEC_DELTA);
      w('openspec/changes/partial-tasks/tasks.md', tasks([true, 'a'], [false, 'b'], [false, 'c']));
      change('complete');
      w('openspec/changes/complete/proposal.md', PROPOSAL);
      w('openspec/changes/complete/design.md', DESIGN);
      w('openspec/changes/complete/specs/auth/spec.md', SPEC_DELTA);
      w('openspec/changes/complete/tasks.md', tasks([true, 'a'], [true, 'b']));
      change('tasks-without-checkboxes'); w('openspec/changes/tasks-without-checkboxes/proposal.md', PROPOSAL);
      w('openspec/changes/tasks-without-checkboxes/tasks.md', '# Tasks\n\n- write the code\n- ship it\n');
      change('specs-without-markdown'); w('openspec/changes/specs-without-markdown/proposal.md', PROPOSAL);
      w('openspec/changes/specs-without-markdown/specs/auth/spec.txt', 'not markdown\n');
      w('openspec/changes/specs-without-markdown/specs/.hidden.md', SPEC_DELTA);
      change('specs-empty-dir'); w('openspec/changes/specs-empty-dir/proposal.md', PROPOSAL); md('openspec/changes/specs-empty-dir/specs/auth');
      change('specs-nested'); w('openspec/changes/specs-nested/specs/auth/session/spec.md', SPEC_DELTA);
      change('specs-at-root'); w('openspec/changes/specs-at-root/specs/auth.md', SPEC_DELTA);
      change('specs-in-hidden-dir'); w('openspec/changes/specs-in-hidden-dir/specs/.drafts/spec.md', SPEC_DELTA);
      change('tasks-is-a-directory'); md('openspec/changes/tasks-is-a-directory/tasks.md');
      md('openspec/changes/bare-directory');
      w('openspec/changes/marker-free/proposal.md', PROPOSAL);
      w('openspec/changes/marker-free/tasks.md', tasks([true, 'a'], [false, 'b']));
      change('shipped');
      w('openspec/changes/shipped/proposal.md', PROPOSAL);
      w('openspec/changes/shipped/design.md', DESIGN);
      w('openspec/changes/shipped/tasks.md', tasks([true, 'a'], [true, 'b']));
      cli(dir, ['archive', 'shipped', '--yes', '--skip-specs']);
      change('shipped-with-open-tasks');
      w('openspec/changes/shipped-with-open-tasks/proposal.md', PROPOSAL);
      w('openspec/changes/shipped-with-open-tasks/tasks.md', tasks([true, 'a'], [false, 'b']));
      cli(dir, ['archive', 'shipped-with-open-tasks', '--yes', '--skip-specs']);
    },
  },
  {
    name: 'task-syntax',
    description: 'How checkboxes are counted: list markers, indentation, odd markers, links, CRLF, BOM, fences.',
    build({ cli, dir, w }) {
      cli(dir, ['new', 'change', 'checkbox-variants']);
      w('openspec/changes/checkbox-variants/tasks.md', TASK_TORTURE);
      cli(dir, ['new', 'change', 'crlf-line-endings']);
      w('openspec/changes/crlf-line-endings/tasks.md', '# Tasks\r\n\r\n- [x] 1.1 done\r\n- [ ] 1.2 open\r\n  - [X] 1.2.1 nested done\r\n- [x](./x)\r\n');
      cli(dir, ['new', 'change', 'byte-order-mark']);
      w('openspec/changes/byte-order-mark/tasks.md', '﻿- [ ] first line behind a BOM\n- [x] second\n');
      cli(dir, ['new', 'change', 'only-links']);
      w('openspec/changes/only-links/tasks.md', '# Tasks\n\n- [Spec](./specs/auth/spec.md)\n- [Design](design.md)\n');
    },
  },
  {
    name: 'skip-specs',
    description: 'skip_specs: true in .openspec.yaml turns unwritten specs/ artifacts into "skipped" and unblocks their dependents.',
    build({ cli, dir, w, a }) {
      const skip = (name) => { cli(dir, ['new', 'change', name]); a(`openspec/changes/${name}/.openspec.yaml`, 'skip_specs: true\n'); };
      skip('skip-fresh');
      skip('skip-proposal-design'); w('openspec/changes/skip-proposal-design/proposal.md', PROPOSAL); w('openspec/changes/skip-proposal-design/design.md', DESIGN);
      skip('skip-complete');
      w('openspec/changes/skip-complete/proposal.md', PROPOSAL);
      w('openspec/changes/skip-complete/design.md', DESIGN);
      w('openspec/changes/skip-complete/tasks.md', tasks([true, 'a']));
      skip('skip-but-specs-written'); w('openspec/changes/skip-but-specs-written/proposal.md', PROPOSAL);
      w('openspec/changes/skip-but-specs-written/specs/auth/spec.md', SPEC_DELTA);
      cli(dir, ['new', 'change', 'skip-false']); a('openspec/changes/skip-false/.openspec.yaml', 'skip_specs: false\n');
      w('openspec/changes/skip-false/proposal.md', PROPOSAL);
    },
  },
  {
    name: 'metadata',
    description: '.openspec.yaml contents: valid extras, unknown keys, and every way it can be invalid.',
    build({ cli, dir, w }) {
      cli(dir, ['new', 'change', 'with-goal', '--goal', 'Let users sign in']);
      w('openspec/changes/with-goal/proposal.md', PROPOSAL);
      w('openspec/changes/affected-areas/.openspec.yaml', `schema: spec-driven\ncreated: ${FIXED_DATE}\naffected_areas:\n  - auth\n  - web\nretire_capabilities: false\n`);
      w('openspec/changes/unknown-keys/.openspec.yaml', 'schema: spec-driven\nowner: alice\nskip_design: true\n');
      w('openspec/changes/extension-keys/.openspec.yaml', 'schema: spec-driven\nx-tracker: JIRA-1\n');
      w('openspec/changes/missing-schema-key/.openspec.yaml', `created: ${FIXED_DATE}\n`);
      w('openspec/changes/missing-schema-key/tasks.md', tasks([true, 'a']));
      w('openspec/changes/unknown-schema/.openspec.yaml', 'schema: does-not-exist\n');
      w('openspec/changes/unknown-schema/tasks.md', tasks([true, 'a'], [false, 'b']));
      w('openspec/changes/invalid-yaml/.openspec.yaml', 'schema: [unclosed\n');
      w('openspec/changes/skip-specs-not-boolean/.openspec.yaml', 'schema: spec-driven\nskip_specs: "yes"\n');
      w('openspec/changes/created-not-a-date/.openspec.yaml', 'schema: spec-driven\ncreated: yesterday\n');
      w('openspec/changes/empty-metadata/.openspec.yaml', '');
      w('openspec/changes/empty-metadata/proposal.md', PROPOSAL);
      w('openspec/changes/.hidden-change/proposal.md', PROPOSAL);
    },
  },
  {
    name: 'custom-schema',
    description: 'Project-local and user-level workflow schemas: custom artifact chains, glob outputs, apply.tracks, broken schemas.',
    userData: true,
    build({ cli, dir, w }) {
      const tpl = (schema, names) => names.forEach((n) => w(`openspec/schemas/${schema}/templates/${n}.md`, `# ${n}\n`));
      tpl('research-first', ['research', 'proposal', 'plan', 'tasks']);
      w('openspec/schemas/research-first/schema.yaml', [
        'name: research-first',
        'version: 1',
        'description: Research before proposing; tasks split across files',
        'artifacts:',
        '  - id: research',
        '    generates: research.md',
        '    description: Research notes',
        '    template: research.md',
        '  - id: proposal',
        '    generates: proposal.md',
        '    description: Proposal',
        '    template: proposal.md',
        '    requires: [research]',
        '  - id: plan',
        '    generates: "plan/*.md"',
        '    description: Plan documents',
        '    template: plan.md',
        '    requires: [proposal]',
        '  - id: tasks',
        '    generates: "tasks/*.md"',
        '    description: Task files',
        '    template: tasks.md',
        '    requires: [plan, research]',
        'apply:',
        '  requires: [tasks]',
        '  tracks: "tasks/*.md"',
        '',
      ].join('\n'));
      tpl('lean', ['x']);
      w('openspec/schemas/lean/schema.yaml', 'name: lean\nversion: 1\nartifacts:\n  - id: brief\n    generates: brief.md\n    description: Brief\n    template: x.md\n  - id: checklist\n    generates: checklist.md\n    description: Checklist\n    template: x.md\n    requires: [brief]\napply:\n  requires: [checklist]\n  tracks: checklist.md\n');
      tpl('untracked', ['x']);
      w('openspec/schemas/untracked/schema.yaml', 'name: untracked\nversion: 1\nartifacts:\n  - id: tasks\n    generates: todo.md\n    description: Todo list\n    template: x.md\napply:\n  requires: [tasks]\n  tracks: null\n');
      tpl('mismatched-tracks', ['x']);
      w('openspec/schemas/mismatched-tracks/schema.yaml', 'name: mismatched-tracks\nversion: 1\nartifacts:\n  - id: work\n    generates: "work/*.md"\n    description: Work\n    template: x.md\napply:\n  requires: [work]\n  tracks: tasks.md\n');
      w('openspec/schemas/cyclic/schema.yaml', 'name: cyclic\nversion: 1\nartifacts:\n  - id: a\n    generates: a.md\n    description: A\n    template: a.md\n    requires: [b]\n  - id: b\n    generates: b.md\n    description: B\n    template: b.md\n    requires: [a]\n');
      // User-level schema: lives in OpenSpec's global data dir, not the project.
      w('user-data/openspec/schemas/personal/templates/x.md', '# x\n');
      w('user-data/openspec/schemas/personal/schema.yaml', 'name: personal\nversion: 1\nartifacts:\n  - id: note\n    generates: note.md\n    description: Note\n    template: x.md\n  - id: tasks\n    generates: tasks.md\n    description: Tasks\n    template: x.md\n    requires: [note]\n');

      cli(dir, ['new', 'change', 'research-fresh', '--schema', 'research-first']);
      cli(dir, ['new', 'change', 'research-tasks-split', '--schema', 'research-first']);
      w('openspec/changes/research-tasks-split/research.md', '# Research\n');
      w('openspec/changes/research-tasks-split/tasks/backend.md', '- [x] api\n- [ ] db\n');
      w('openspec/changes/research-tasks-split/tasks/frontend.md', '- [x] form\n');
      w('openspec/changes/research-tasks-split/tasks.md', '- [ ] not tracked by this schema\n');
      cli(dir, ['new', 'change', 'lean-done', '--schema', 'lean']);
      w('openspec/changes/lean-done/brief.md', '# Brief\n');
      w('openspec/changes/lean-done/checklist.md', '- [x] one\n- [x] two\n');
      cli(dir, ['new', 'change', 'untracked-todo', '--schema', 'untracked']);
      w('openspec/changes/untracked-todo/todo.md', '- [x] a\n- [ ] b\n');
      cli(dir, ['new', 'change', 'mismatched', '--schema', 'mismatched-tracks']);
      w('openspec/changes/mismatched/work/one.md', '- [x] not counted\n');
      w('openspec/changes/mismatched/tasks.md', '- [ ] counted via tasks.md fallback\n');
      w('openspec/changes/cyclic-change/.openspec.yaml', 'schema: cyclic\n');
      cli(dir, ['new', 'change', 'personal-flow', '--schema', 'personal']);
      w('openspec/changes/personal-flow/note.md', '# Note\n');
      // No marker: schema comes from openspec/config.yaml.
      w('openspec/config.yaml', 'schema: research-first\n');
      w('openspec/changes/marker-free-uses-project-default/research.md', '# Research\n');
    },
  },
  {
    name: 'shadowed-builtin',
    description: 'A project-local schema named spec-driven takes precedence over the built-in one.',
    build({ cli, dir, w }) {
      w('openspec/schemas/spec-driven/templates/x.md', '# x\n');
      w('openspec/schemas/spec-driven/schema.yaml', [
        'name: spec-driven',
        'version: 1',
        'artifacts:',
        '  - id: proposal',
        '    generates: proposal.md',
        '    description: Proposal',
        '    template: x.md',
        '  - id: tasks',
        '    generates: tasks.md',
        '    description: Tasks',
        '    template: x.md',
        '    requires: [proposal]',
        '  - id: review',
        '    generates: review.md',
        '    description: Review notes',
        '    template: x.md',
        '    requires: [tasks]',
        'apply:',
        '  requires: [tasks]',
        '  tracks: tasks.md',
        '',
      ].join('\n'));
      cli(dir, ['new', 'change', 'local-flow']);
      w('openspec/changes/local-flow/proposal.md', PROPOSAL);
    },
  },
  {
    name: 'legacy-layout',
    description: 'Pre-1.0 layout: no openspec/config.yaml, no .openspec.yaml markers, project.md + AGENTS.md.',
    build({ w }) {
      w('openspec/project.md', '# Project\n');
      w('openspec/AGENTS.md', '# OpenSpec Instructions\n');
      w('openspec/specs/auth/spec.md', '# Auth\n\n## Purpose\nAuth.\n\n## Requirements\n\n### Requirement: Login\nThe system SHALL allow login.\n\n#### Scenario: ok\n- **WHEN** x\n- **THEN** y\n');
      w('openspec/changes/add-auth/proposal.md', PROPOSAL);
      w('openspec/changes/add-auth/design.md', DESIGN);
      w('openspec/changes/add-auth/specs/auth/spec.md', SPEC_DELTA);
      w('openspec/changes/add-auth/tasks.md', tasks([true, 'a'], [true, 'b'], [false, 'c']));
      w('openspec/changes/old-idea/proposal.md', PROPOSAL);
      w('openspec/changes/archive/2025-01-15-old-shipped/proposal.md', PROPOSAL);
      w('openspec/changes/archive/2025-01-15-old-shipped/tasks.md', tasks([true, 'a']));
    },
  },
  {
    name: 'nested-wrapper',
    description: 'A folder that wraps change directories is not itself a change.',
    build({ w }) {
      w('openspec/changes/flat/proposal.md', PROPOSAL);
      w('openspec/changes/team-a/login/proposal.md', PROPOSAL);
      w('openspec/changes/team-a/signup/tasks.md', tasks([false, 'a']));
    },
  },
  {
    name: 'store-checkout',
    description: 'A store (beta): a standalone planning repo with .openspec-store/store.yaml and the usual openspec/ layout.',
    build({ cli, dir, w }) {
      fs.rmSync(dir, { recursive: true, force: true });
      cli(path.dirname(dir), ['store', 'setup', 'team-plans', '--path', dir, '--no-init-git']);
      cli(dir, ['new', 'change', 'add-login', '--store', 'team-plans']);
      w('openspec/changes/add-login/proposal.md', PROPOSAL);
      w('openspec/changes/add-login/tasks.md', tasks([true, 'a'], [false, 'b']));
    },
  },
  {
    name: 'store-pointer',
    description: 'A code repo whose openspec/config.yaml says `store: team-plans`: its planning lives in a store elsewhere on the machine.',
    build({ cli, dir, w, scratch }) {
      const storeDir = path.join(scratch, 'pointer-target-store');
      cli(scratch, ['store', 'setup', 'team-plans', '--path', storeDir, '--no-init-git']);
      cli(storeDir, ['new', 'change', 'add-login', '--store', 'team-plans']);
      fs.rmSync(path.join(dir, 'openspec'), { recursive: true, force: true });
      w('openspec/config.yaml', 'store: team-plans\n');
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'openspec-conformance-'));
  try {
    const bin = args.bin ?? installOpenSpec(args.version, work);
    const packageDir = packageDirFromBin(bin);
    const version = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')).version;
    console.error(`Generating fixtures with OpenSpec ${version}`);

    const generated = path.join(work, 'fixtures');
    fs.mkdirSync(generated, { recursive: true });

    for (const testCase of CASES) {
      const dir = path.join(generated, testCase.name);
      const scratch = path.join(work, 'scratch', testCase.name);
      fs.mkdirSync(scratch, { recursive: true });
      // Always create openspec/ first so the CLI never walks up into a parent
      // project while building a fixture.
      fs.mkdirSync(path.join(dir, 'openspec', 'changes'), { recursive: true });
      const dataDir = testCase.userData ? path.join(dir, 'user-data') : path.join(scratch, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      const cli = makeCli(bin, baseEnv(dataDir));

      testCase.build({
        cli,
        dir,
        scratch,
        w: (rel, content) => write(dir, rel, content),
        a: (rel, content) => append(dir, rel, content),
        md: (rel) => mkdir(dir, rel),
      });
      normalise(dir);
      const expected = record(cli, dir, version, testCase);
      fs.writeFileSync(path.join(dir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
      console.error(`  ${testCase.name}: ${expected.list.length} change(s)`);
    }

    fs.mkdirSync(args.out, { recursive: true });
    for (const entry of fs.readdirSync(args.out)) {
      fs.rmSync(path.join(args.out, entry), { recursive: true, force: true });
    }
    for (const testCase of CASES) {
      copyTree(path.join(generated, testCase.name), path.join(args.out, testCase.name));
    }
    const manifest = {
      openspecVersion: version,
      generator: 'conformance/generate.mjs',
      cases: CASES.map((c) => c.name),
      builtinSchemas: builtinSchemas(packageDir),
    };
    fs.writeFileSync(path.join(args.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.error(`Wrote ${CASES.length} fixtures to ${args.out}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main();
