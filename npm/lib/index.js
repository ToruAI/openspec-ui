'use strict';
// Launcher for the openspec-ui binary. Zero dependencies, Node 18+.
// On first run it downloads the release binary for this platform, checks it
// against SHA-256 sums shipped inside this npm package, caches it per user,
// then runs it with stdio inherited.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const DEFAULT_BASE = 'https://github.com/ToruAI/openspec-ui/releases/download';
const SOURCE_URL = 'https://github.com/ToruAI/openspec-ui#build-from-source';
const MAX_REDIRECTS = 5;

class LauncherError extends Error {}

// process.platform-process.arch -> release asset id.
// Windows on ARM runs the x86_64 build through built-in emulation.
const PLATFORMS = {
  'darwin-arm64': 'darwin-aarch64',
  'darwin-x64': 'darwin-x86_64',
  'linux-x64': 'linux-x86_64',
  'linux-arm64': 'linux-aarch64',
  'win32-x64': 'windows-x86_64',
  'win32-arm64': 'windows-x86_64',
};

function platformId(platform = process.platform, arch = process.arch) {
  const id = PLATFORMS[`${platform}-${arch}`];
  if (!id) {
    throw new LauncherError(
      `No prebuilt openspec-ui binary for ${platform}/${arch}.\n` +
        `Supported: ${Object.keys(PLATFORMS).join(', ')}.\n` +
        `You can build it from source: ${SOURCE_URL}`
    );
  }
  return id;
}

const assetName = (id) => `openspec-ui-${id}.gz`;
const exeName = (id) => (id.startsWith('windows') ? 'openspec-ui.exe' : 'openspec-ui');

function defaultCacheDir(env = process.env, platform = process.platform) {
  if (env.OPENSPEC_UI_CACHE_DIR) return env.OPENSPEC_UI_CACHE_DIR;
  const home = os.homedir();
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches', 'openspec-ui');
  if (platform === 'win32') {
    return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'openspec-ui', 'Cache');
  }
  return path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), 'openspec-ui');
}

// --- proxy support (HTTPS via CONNECT only) -------------------------------

function proxyFor(targetUrl, env = process.env) {
  const proxy = env.HTTPS_PROXY || env.https_proxy;
  if (!proxy || targetUrl.protocol !== 'https:') return null;
  const noProxy = (env.NO_PROXY || env.no_proxy || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const host = targetUrl.hostname.toLowerCase();
  for (const entry of noProxy) {
    if (entry === '*') return null;
    const bare = entry.replace(/^\*?\./, '');
    if (host === bare || host.endsWith('.' + bare)) return null;
  }
  return proxy;
}

class TunnelAgent extends https.Agent {
  constructor(proxyUrl, options) {
    super(options);
    this.proxy = new URL(proxyUrl);
  }
  createConnection(options, cb) {
    const p = this.proxy;
    const secure = p.protocol === 'https:';
    const headers = {};
    if (p.username) {
      const cred = `${decodeURIComponent(p.username)}:${decodeURIComponent(p.password)}`;
      headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(cred).toString('base64');
    }
    const target = `${options.host}:${options.port || 443}`;
    const req = (secure ? https : http).request({
      host: p.hostname,
      port: p.port || (secure ? 443 : 80),
      method: 'CONNECT',
      path: target,
      headers: { Host: target, ...headers },
    });
    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        cb(new Error(`proxy refused CONNECT to ${target} (HTTP ${res.statusCode})`));
        return;
      }
      cb(null, tls.connect({ socket, servername: options.servername || options.host, ca: this.options.ca }));
    });
    req.on('error', cb);
    req.end();
  }
}

// --- download --------------------------------------------------------------

// Redirects are followed per hop, so a proxy tunnel always targets the
// post-redirect host (GitHub redirects release downloads to another host).
function fetchBuffer(urlString, opts = {}, redirects = 0) {
  const { env = process.env, ca, timeoutMs = 30000 } = opts;
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      reject(new LauncherError(`Invalid download URL: ${urlString}`));
      return;
    }
    const lib = url.protocol === 'http:' ? http : https;
    const reqOpts = { headers: { 'User-Agent': 'openspec-ui-launcher' } };
    if (url.protocol === 'https:') {
      const proxy = proxyFor(url, env);
      if (proxy) reqOpts.agent = new TunnelAgent(proxy, { ca });
      else if (ca) reqOpts.ca = ca;
    }
    const req = lib.get(url, reqOpts, (res) => {
      const status = res.statusCode;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) {
          reject(new LauncherError(`Too many redirects while downloading ${urlString}`));
          return;
        }
        const next = new URL(res.headers.location, url).toString();
        fetchBuffer(next, opts, redirects + 1).then(resolve, reject);
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new LauncherError(`Download failed: HTTP ${status} for ${urlString}`));
        return;
      }
      const expected = Number(res.headers['content-length']);
      const chunks = [];
      let got = 0;
      res.on('data', (c) => {
        chunks.push(c);
        got += c.length;
      });
      res.on('error', (e) => reject(new LauncherError(`Download interrupted: ${e.message}`)));
      res.on('aborted', () => reject(new LauncherError('Download interrupted (connection closed early)')));
      res.on('end', () => {
        if (expected && got !== expected) {
          reject(new LauncherError(`Download incomplete: got ${got} of ${expected} bytes`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timed out after ${timeoutMs} ms`)));
    req.on('error', (e) =>
      reject(
        new LauncherError(
          `Could not download ${urlString}\n  (${e.message})\n` +
            `Check your network or proxy (HTTPS_PROXY is respected), or set OPENSPEC_UI_BIN to a local binary.`
        )
      )
    );
  });
}

// --- obtain binary ---------------------------------------------------------

async function getBinary(o) {
  const {
    version,
    checksums,
    baseUrl = DEFAULT_BASE,
    cacheDir = defaultCacheDir(),
    platform = process.platform,
    arch = process.arch,
    env = process.env,
    ca,
    log = () => {},
  } = o;
  const id = platformId(platform, arch);
  const binPath = path.join(cacheDir, version, id, exeName(id));
  if (fs.existsSync(binPath)) return binPath;

  const asset = assetName(id);
  const expected =
    checksums && checksums.version === version && checksums.assets && checksums.assets[asset];
  if (!expected) {
    throw new LauncherError(
      `This copy of the package (${version}) has no checksum for ${asset}, so it cannot download a binary safely.\n` +
        `Install a published release (npx openspec-ui@latest), or set OPENSPEC_UI_BIN to a local binary.`
    );
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/v${version}/${asset}`;
  log(`openspec-ui: downloading ${asset} (v${version}) ...`);
  const gz = await fetchBuffer(url, { env, ca });

  // Verify the compressed bytes before decompressing anything.
  const actual = crypto.createHash('sha256').update(gz).digest('hex');
  if (actual !== String(expected).toLowerCase()) {
    throw new LauncherError(
      `Checksum mismatch for ${asset}.\n  expected ${expected}\n  actual   ${actual}\n` +
        `The download was corrupted or tampered with; nothing was installed.`
    );
  }
  let bin;
  try {
    bin = zlib.gunzipSync(gz);
  } catch (e) {
    throw new LauncherError(`Downloaded ${asset} is not valid gzip (${e.message})`);
  }

  fs.mkdirSync(path.dirname(binPath), { recursive: true });
  const tmp = `${binPath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, bin, { mode: 0o755 });
    fs.renameSync(tmp, binPath);
  } catch (e) {
    // A concurrent run may have won the race (on Windows a running .exe cannot be replaced).
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    if (!fs.existsSync(binPath)) {
      throw new LauncherError(`Could not write ${binPath}: ${e.message}`);
    }
  }
  log(`openspec-ui: cached at ${binPath}`);
  return binPath;
}

// --- run -------------------------------------------------------------------

function runBinary(binPath, args) {
  return new Promise((resolve) => {
    const child = spawn(binPath, args, { stdio: 'inherit' });
    const handlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((sig) => {
      const h = () => {
        try {
          child.kill(sig);
        } catch {
          /* already gone */
        }
      };
      process.on(sig, h);
      return [sig, h];
    });
    const cleanup = () => handlers.forEach(([sig, h]) => process.removeListener(sig, h));
    child.on('error', (e) => {
      cleanup();
      process.stderr.write(`openspec-ui: could not start ${binPath}: ${e.message}\n`);
      resolve({ code: 1 });
    });
    child.on('exit', (code, signal) => {
      cleanup();
      resolve({ code, signal });
    });
  });
}

async function main(argv, env = process.env) {
  try {
    let binPath = env.OPENSPEC_UI_BIN;
    if (binPath) {
      if (!fs.existsSync(binPath)) {
        throw new LauncherError(`OPENSPEC_UI_BIN points to ${binPath}, which does not exist.`);
      }
    } else {
      const pkg = require('../package.json');
      let checksums = null;
      try {
        checksums = require('../checksums.json');
      } catch {
        /* unstamped */
      }
      binPath = await getBinary({
        version: pkg.version,
        checksums,
        baseUrl: env.OPENSPEC_UI_DOWNLOAD_BASE || DEFAULT_BASE,
        cacheDir: defaultCacheDir(env),
        env,
        log: (m) => process.stderr.write(m + '\n'),
      });
    }
    return await runBinary(binPath, argv);
  } catch (e) {
    if (!(e instanceof LauncherError)) throw e;
    process.stderr.write(`openspec-ui: ${e.message}\n`);
    return { code: 1 };
  }
}

function finish({ code, signal }) {
  if (signal) {
    // Mirror the child's fate so shells see the same signal.
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
    setTimeout(() => process.exit(128 + (os.constants.signals[signal] || 0)), 100);
    return;
  }
  process.exit(code === null || code === undefined ? 1 : code);
}

module.exports = {
  LauncherError,
  PLATFORMS,
  DEFAULT_BASE,
  platformId,
  assetName,
  exeName,
  defaultCacheDir,
  proxyFor,
  fetchBuffer,
  getBinary,
  runBinary,
  main,
  finish,
};
