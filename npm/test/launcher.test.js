'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');

const lib = require('../lib/index.js');

const isWin = process.platform === 'win32';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'osui-test-'));

// A tiny stand-in "binary": prints its args, honours FAKE_EXIT, traps TERM.
const FAKE_BIN = Buffer.from(
  '#!/bin/sh\n' +
    'echo "args:$*"\n' +
    'if [ -n "$FAKE_WAIT" ]; then\n' +
    '  trap \'echo got-term; exit 7\' TERM\n' +
    '  echo ready\n' +
    '  while :; do sleep 0.1; done\n' +
    'fi\n' +
    'exit ${FAKE_EXIT:-0}\n'
);

const VERSION = '1.2.3';
const ID = lib.platformId();
const ASSET = lib.assetName(ID);
const ASSET_PATH = `/v${VERSION}/${ASSET}`;

let server, base, hits, routes;
before(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url);
    const r = routes[req.url];
    if (!r) {
      res.writeHead(404).end('nope');
    } else {
      r(req, res);
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function reset(gz = zlib.gzipSync(FAKE_BIN)) {
  hits = [];
  routes = { [ASSET_PATH]: (req, res) => res.writeHead(200).end(gz) };
  return gz;
}
const stamped = (gz) => ({ version: VERSION, assets: { [ASSET]: sha(gz) } });

// --- platform mapping ------------------------------------------------------

test('platform mapping', () => {
  assert.equal(lib.platformId('darwin', 'arm64'), 'darwin-aarch64');
  assert.equal(lib.platformId('darwin', 'x64'), 'darwin-x86_64');
  assert.equal(lib.platformId('linux', 'x64'), 'linux-x86_64');
  assert.equal(lib.platformId('linux', 'arm64'), 'linux-aarch64');
  assert.equal(lib.platformId('win32', 'x64'), 'windows-x86_64');
  assert.equal(lib.platformId('win32', 'arm64'), 'windows-x86_64');
  assert.equal(lib.exeName('windows-x86_64'), 'openspec-ui.exe');
  assert.equal(lib.exeName('linux-x86_64'), 'openspec-ui');
  assert.equal(lib.assetName('linux-x86_64'), 'openspec-ui-linux-x86_64.gz');
});

test('unsupported platform explains and points at build-from-source', () => {
  assert.throws(
    () => lib.platformId('freebsd', 'x64'),
    (e) => e instanceof lib.LauncherError && /freebsd\/x64/.test(e.message) && /build-from-source/.test(e.message)
  );
  assert.throws(() => lib.platformId('linux', 'riscv64'), lib.LauncherError);
});

test('cache dir honours override', () => {
  assert.equal(lib.defaultCacheDir({ OPENSPEC_UI_CACHE_DIR: '/x/y' }), '/x/y');
});

// --- download / verify / cache --------------------------------------------

test('downloads, verifies, caches; second call is a cache hit', async () => {
  const gz = reset();
  const cacheDir = tmp();
  const opts = { version: VERSION, checksums: stamped(gz), baseUrl: base, cacheDir };
  const p = await lib.getBinary(opts);
  assert.ok(p.startsWith(cacheDir));
  assert.deepEqual(fs.readFileSync(p), FAKE_BIN);
  if (!isWin) assert.ok(fs.statSync(p).mode & 0o100, 'executable');
  assert.equal(hits.length, 1);
  const p2 = await lib.getBinary(opts);
  assert.equal(p2, p);
  assert.equal(hits.length, 1, 'no second request');
});

test('download base: .../releases and .../releases/download both work (shared with install.sh)', async () => {
  assert.equal(lib.releaseBase('https://h/o/r/releases'), 'https://h/o/r/releases/download');
  assert.equal(lib.releaseBase('https://h/o/r/releases/'), 'https://h/o/r/releases/download');
  assert.equal(lib.releaseBase('https://h/o/r/releases/download/'), 'https://h/o/r/releases/download');
  const gz = reset();
  routes['/releases/download' + ASSET_PATH] = (req, res) => res.writeHead(200).end(gz);
  const p = await lib.getBinary({ version: VERSION, checksums: stamped(gz), baseUrl: base + '/releases', cacheDir: tmp() });
  assert.ok(fs.existsSync(p));
});

test('follows redirects to another host path', async () => {
  const gz = reset();
  routes[ASSET_PATH] = (req, res) => res.writeHead(302, { Location: '/cdn/blob' }).end();
  routes['/cdn/blob'] = (req, res) => res.writeHead(200).end(gz);
  const p = await lib.getBinary({ version: VERSION, checksums: stamped(gz), baseUrl: base, cacheDir: tmp() });
  assert.ok(fs.existsSync(p));
  assert.deepEqual(hits, [ASSET_PATH, '/cdn/blob']);
});

test('checksum mismatch: error, nothing cached', async () => {
  const gz = reset();
  const cacheDir = tmp();
  const bad = { version: VERSION, assets: { [ASSET]: sha(Buffer.from('other')) } };
  await assert.rejects(
    lib.getBinary({ version: VERSION, checksums: bad, baseUrl: base, cacheDir }),
    /Checksum mismatch/
  );
  assert.deepEqual(fs.readdirSync(cacheDir), []);
  assert.ok(gz.length > 0);
});

test('HTTP error and unreachable host give clear errors', async () => {
  const gz = reset();
  routes = {};
  await assert.rejects(
    lib.getBinary({ version: VERSION, checksums: stamped(gz), baseUrl: base, cacheDir: tmp() }),
    /HTTP 404/
  );
  // closed port
  const s = http.createServer().listen(0, '127.0.0.1');
  await new Promise((r) => s.once('listening', r));
  const dead = `http://127.0.0.1:${s.address().port}`;
  await new Promise((r) => s.close(r));
  await assert.rejects(
    lib.getBinary({ version: VERSION, checksums: stamped(gz), baseUrl: dead, cacheDir: tmp() }),
    /Could not download.*OPENSPEC_UI_BIN/s
  );
});

test('truncated download is rejected and not cached', async () => {
  const gz = reset();
  routes[ASSET_PATH] = (req, res) => {
    res.writeHead(200, { 'Content-Length': gz.length });
    res.write(gz.subarray(0, Math.floor(gz.length / 2)));
    setTimeout(() => res.socket.destroy(), 20);
  };
  const cacheDir = tmp();
  await assert.rejects(
    lib.getBinary({ version: VERSION, checksums: stamped(gz), baseUrl: base, cacheDir }),
    /interrupted|incomplete/
  );
  assert.deepEqual(fs.readdirSync(cacheDir), []);
});

test('unstamped package refuses to download', async () => {
  reset();
  await assert.rejects(
    lib.getBinary({ version: VERSION, checksums: { version: '0.0.0-dev', assets: {} }, baseUrl: base, cacheDir: tmp() }),
    /no checksum/
  );
  assert.equal(hits.length, 0);
});

test('concurrent first runs end with one valid binary and no leftovers', async () => {
  const gz = reset();
  const cacheDir = tmp();
  const opts = { version: VERSION, checksums: stamped(gz), baseUrl: base, cacheDir };
  const paths = await Promise.all(Array.from({ length: 6 }, () => lib.getBinary(opts)));
  assert.equal(new Set(paths).size, 1);
  assert.deepEqual(fs.readFileSync(paths[0]), FAKE_BIN);
  assert.deepEqual(fs.readdirSync(path.dirname(paths[0])), [lib.exeName(ID)]);
});

// --- proxy -----------------------------------------------------------------

test('proxyFor honours HTTPS_PROXY and NO_PROXY', () => {
  const u = new URL('https://github.com/x');
  assert.equal(lib.proxyFor(u, {}), null);
  assert.equal(lib.proxyFor(u, { HTTPS_PROXY: 'http://p:1' }), 'http://p:1');
  assert.equal(lib.proxyFor(u, { HTTPS_PROXY: 'http://p:1', NO_PROXY: '.github.com' }), null);
  assert.equal(lib.proxyFor(u, { https_proxy: 'http://p:1', no_proxy: '*' }), null);
  assert.equal(lib.proxyFor(new URL('http://github.com/x'), { HTTPS_PROXY: 'http://p:1' }), null);
});

test('HTTPS download goes through a CONNECT proxy', async (t) => {
  const dir = tmp();
  try {
    execFileSync(
      'openssl',
      ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '1',
        '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'],
      { cwd: dir, stdio: 'ignore' }
    );
  } catch {
    t.skip('openssl not available');
    return;
  }
  const key = fs.readFileSync(path.join(dir, 'k.pem'));
  const cert = fs.readFileSync(path.join(dir, 'c.pem'));
  const target = https.createServer({ key, cert }, (req, res) => res.writeHead(200).end('via-proxy'));
  await new Promise((r) => target.listen(0, '127.0.0.1', r));
  const seen = [];
  const proxy = http.createServer();
  proxy.on('connect', (req, clientSocket, head) => {
    seen.push(req.url);
    const [host, port] = req.url.split(':');
    const net = require('node:net');
    const up = net.connect(Number(port), '127.0.0.1', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      up.write(head);
      up.pipe(clientSocket);
      clientSocket.pipe(up);
    });
    up.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => up.destroy());
    void host;
  });
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  try {
    const buf = await lib.fetchBuffer(`https://localhost:${target.address().port}/x`, {
      env: { HTTPS_PROXY: `http://127.0.0.1:${proxy.address().port}` },
      ca: cert,
    });
    assert.equal(buf.toString(), 'via-proxy');
    assert.deepEqual(seen, [`localhost:${target.address().port}`]);
  } finally {
    target.close();
    proxy.close();
  }
});

// --- the bin: passthrough, exit code, signals ------------------------------

// Run the real bin from a stamped copy of the package so the repo stays untouched.
function stampedCopy(gz) {
  const dir = tmp();
  const root = path.join(__dirname, '..');
  fs.cpSync(path.join(root, 'bin'), path.join(dir, 'bin'), { recursive: true });
  fs.cpSync(path.join(root, 'lib'), path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'openspec-ui', version: VERSION }));
  fs.writeFileSync(path.join(dir, 'checksums.json'), JSON.stringify(stamped(gz)));
  return path.join(dir, 'bin', 'openspec-ui.js');
}

function runBin(binJs, args, env, { signalAfterReady } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [binJs, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
      if (signalAfterReady && out.includes('ready')) {
        child.kill(signalAfterReady);
      }
    });
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', (code, signal) => resolve({ code, signal, out, err }));
  });
}

test('bin: downloads then passes args and exit code through', { skip: isWin }, async () => {
  const gz = reset();
  const bin = stampedCopy(gz);
  const env = { OPENSPEC_UI_DOWNLOAD_BASE: base, OPENSPEC_UI_CACHE_DIR: tmp(), FAKE_EXIT: '3' };
  const r = await runBin(bin, ['--port', '4000', 'some dir/with space', '--no-open'], env);
  assert.equal(r.code, 3);
  assert.match(r.out, /args:--port 4000 some dir\/with space --no-open/);
  assert.match(r.err, /downloading/);
  assert.doesNotMatch(r.out, /downloading/, 'launcher chatter stays on stderr');
  // second run: cached, no new request, same behaviour
  const n = hits.length;
  const r2 = await runBin(bin, ['x'], { ...env, FAKE_EXIT: '0' });
  assert.equal(r2.code, 0);
  assert.equal(hits.length, n);
});

test('bin: OPENSPEC_UI_BIN override skips the network', { skip: isWin }, async () => {
  const gz = reset();
  const bin = stampedCopy(gz);
  const local = path.join(tmp(), 'mybin');
  fs.writeFileSync(local, FAKE_BIN, { mode: 0o755 });
  const r = await runBin(bin, ['hello'], { OPENSPEC_UI_BIN: local, OPENSPEC_UI_DOWNLOAD_BASE: 'http://127.0.0.1:1' });
  assert.equal(r.code, 0);
  assert.match(r.out, /args:hello/);
  const missing = await runBin(bin, [], { OPENSPEC_UI_BIN: '/nonexistent/bin' });
  assert.equal(missing.code, 1);
  assert.match(missing.err, /does not exist/);
});

test('bin: SIGTERM is forwarded and the child exit code preserved', { skip: isWin }, async () => {
  const gz = reset();
  const bin = stampedCopy(gz);
  const r = await runBin(
    bin,
    [],
    { OPENSPEC_UI_DOWNLOAD_BASE: base, OPENSPEC_UI_CACHE_DIR: tmp(), FAKE_WAIT: '1' },
    { signalAfterReady: 'SIGTERM' }
  );
  assert.match(r.out, /got-term/);
  assert.equal(r.code, 7);
});

test('bin: download failure exits 1 with a message', { skip: isWin }, async () => {
  const gz = reset();
  routes = {};
  const r = await runBin(stampedCopy(gz), [], { OPENSPEC_UI_DOWNLOAD_BASE: base, OPENSPEC_UI_CACHE_DIR: tmp() });
  assert.equal(r.code, 1);
  assert.match(r.err, /openspec-ui: Download failed: HTTP 404/);
});
