#!/usr/bin/env node
// README screenshots of the real app, served by the real backend from a copy of demo/.
//
//   npm ci                                  # root: installs playwright-core
//   (cd frontend && npm ci && npm run build) && (cd backend && cargo build)
//   node scripts/screenshots.mjs [--backend PATH] [--out DIR] [--only NAME,...]
//
// Uses the installed Google Chrome (Playwright channel "chrome"); no browser download.
// Output (docs/images/): board-light.png, board-dark.png, phone.png, change-detail.png,
// live-update.gif. Re-run after UI changes and after the version is stamped (the header
// shows the binary's version).
//
// Stable output: the browser clock is pinned to one day after the newest idea in demo/,
// the same rule the static live demo uses, so "1d ago" never drifts. The server runs on a
// temporary copy of demo/ because the animation edits a tasks.md file.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const outDir = path.resolve(arg('out', path.join(root, 'docs/images')));
const only = arg('only')?.split(',');
const want = (name) => !only || only.includes(name);
const backend =
  arg('backend') ??
  ['release', 'debug']
    .map((p) => path.join(root, 'backend/target', p, 'openspec-ui'))
    .find((p) => fs.existsSync(p));
if (!backend) {
  console.error('No backend binary found. Build it first: cd backend && cargo build');
  process.exit(1);
}

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const DETAIL_CHANGE = 'add-saved-addresses';
// What the animation checks off, in order: a "Ready to apply" change starts (moves to
// In progress), then an almost finished one completes (moves to Complete).
const LIVE_STEPS = [
  { repo: 'payments-api', name: 'add-partial-refunds', task: '1.1', expect: '1/10 tasks', hold: 1.8 },
  { repo: 'storefront', name: 'add-saved-addresses', task: '3.3', expect: '8/9 tasks', hold: 1.2 },
  { repo: 'storefront', name: 'add-saved-addresses', task: '3.4', expect: '9/9 tasks', hold: 2.6 },
];

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

async function startServer(workspace) {
  const port = await freePort();
  const child = spawn(backend, [workspace, '--port', String(port), '--no-open'], {
    cwd: workspace,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`backend exited early (code ${child.exitCode})`);
    try {
      if ((await fetch(`${base}/api/info`)).ok) return { base, child };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error('backend did not start within 10s');
}

async function pinnedNow(base) {
  const { ideas } = await (await fetch(`${base}/api/ideas`)).json();
  const newest = Math.max(...ideas.map((i) => Date.parse(i.createdAt)));
  return new Date(newest + 26 * 3600 * 1000);
}

async function newPage(browser, { viewport, scale, theme, now }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    colorScheme: theme,
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600,
  });
  // The app keeps the theme in localStorage; start every shot from a known state.
  await context.addInitScript((t) => {
    try {
      localStorage.clear();
      localStorage.setItem('theme', t);
    } catch {
      // ignore
    }
  }, theme);
  const page = await context.newPage();
  await page.clock.setFixedTime(now);
  return page;
}

async function openBoard(page, base) {
  // Not 'networkidle': the board keeps an event stream open.
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByText('Ready to apply').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function shot(page, name, options = {}) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, ...options });
  console.log(`  ${path.relative(root, file)}`);
  return file;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openspec-ui-shots-'));
const workspace = path.join(tmp, 'fernhill');
fs.cpSync(path.join(root, 'demo'), workspace, {
  recursive: true,
  filter: (src) => !/[/\\](\.cache|src|node_modules)$/.test(src) && !src.endsWith('generate.mjs'),
});
fs.mkdirSync(outDir, { recursive: true });

const { base, child } = await startServer(workspace);
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const now = await pinnedNow(base);
  console.log(`server ${base}, clock pinned to ${now.toISOString()}`);

  for (const theme of ['light', 'dark']) {
    if (!want(`board-${theme}`)) continue;
    const page = await newPage(browser, { viewport: DESKTOP, scale: 2, theme, now });
    await openBoard(page, base);
    await shot(page, `board-${theme}`);
    await page.context().close();
  }

  if (want('phone')) {
    const page = await newPage(browser, { viewport: PHONE, scale: 3, theme: 'light', now });
    await openBoard(page, base);
    await shot(page, 'phone');
    await page.context().close();
  }

  if (want('change-detail')) {
    const page = await newPage(browser, { viewport: DESKTOP, scale: 2, theme: 'light', now });
    await openBoard(page, base);
    await page.getByText(DETAIL_CHANGE, { exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('tab', { name: /tasks/i }).click();
    await page.waitForTimeout(400);
    await shot(page, 'change-detail');
    await page.context().close();
  }

  if (want('live-update')) await liveUpdate(browser, base, now);
} finally {
  await browser.close();
  child.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}

// A short loop of the board reacting to an agent checking off tasks: discrete frames of
// the real UI (crisper than screen recording), assembled by ffmpeg with a shared palette.
async function liveUpdate(browser, base, now) {
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  try {
    execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
  } catch {
    console.warn('  live-update skipped: ffmpeg not found (set FFMPEG=/path/to/ffmpeg)');
    return;
  }
  const page = await newPage(browser, { viewport: DESKTOP, scale: 2, theme: 'light', now });
  await openBoard(page, base);
  // Crop to the three columns the cards move through, so the text stays readable.
  const from = await page.locator('section[aria-label="Ready to apply"]').boundingBox();
  const to = await page.locator('section[aria-label="Complete"]').boundingBox();
  const clip = { x: from.x - 12, y: from.y - 10, width: to.x + to.width - from.x + 24, height: 600 };
  const frames = fs.mkdtempSync(path.join(tmp, 'frames-'));
  const list = [];
  const frame = async (seconds) => {
    const file = path.join(frames, `${String(list.length).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, clip });
    list.push({ file, seconds });
  };
  const check = async (step, expectText) => {
    const file = path.join(workspace, step.repo, 'openspec/changes', step.name, 'tasks.md');
    const text = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, text.replace(`- [ ] ${step.task}`, `- [x] ${step.task}`));
    await page.getByText(expectText, { exact: true }).first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
  };

  await frame(2.0);
  for (const step of LIVE_STEPS) {
    await check(step, step.expect);
    await frame(step.hold);
  }
  await page.context().close();

  const concat = list.map((f) => `file '${f.file}'\nduration ${f.seconds}`).join('\n');
  // The concat demuxer ignores the last duration unless the last file is repeated.
  const listFile = path.join(frames, 'list.txt');
  fs.writeFileSync(listFile, `${concat}\nfile '${list.at(-1).file}'\n`);
  const out = path.join(outDir, 'live-update.gif');
  execFileSync(ffmpeg, [
    '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none',
    '-loop', '0', out,
  ]);
  console.log(`  ${path.relative(root, out)}`);
}
