#!/usr/bin/env node
// Static server laid out like GitHub Releases download URLs (used by
// scripts/rehearse-release.sh; nothing here is part of a real release).
//
//   node scripts/rehearsal-server.mjs <site-dir> <port> [host=127.0.0.1]
//
// <site-dir>/releases/download/v<version>/<asset>   the files
// <site-dir>/LATEST                                  text file: the version tag, e.g. v0.2.0
//
//   GET /releases/download/v1.2.3/<asset>  -> 302 /objects/v1.2.3/<asset>?rehearsal=1
//   GET /releases/latest/download/<asset>  -> 302 /releases/download/<LATEST>/<asset>
//   GET /objects/v1.2.3/<asset>            -> the bytes
//
// Like github.com, release downloads answer with redirects (to another path
// here, to another host there), so redirect handling in the clients is exercised.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [siteArg, portArg, host = '127.0.0.1'] = process.argv.slice(2);
if (!siteArg || !portArg) {
  console.error('usage: rehearsal-server.mjs <site-dir> <port> [host]');
  process.exit(2);
}
const site = path.resolve(siteArg);
const downloadRoot = path.join(site, 'releases', 'download');

const log = (...a) => console.log(new Date().toISOString(), ...a);

function latestTag() {
  return fs.readFileSync(path.join(site, 'LATEST'), 'utf8').trim();
}

function send(res, status, headers = {}, body = '') {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  let m;
  try {
    if ((m = p.match(/^\/releases\/latest\/download\/([^/]+)$/))) {
      const loc = `/releases/download/${latestTag()}/${m[1]}`;
      log(req.method, p, '->', 302, loc);
      return send(res, 302, { Location: loc });
    }
    if ((m = p.match(/^\/releases\/download\/(v[^/]+)\/([^/]+)$/))) {
      const loc = `/objects/${m[1]}/${m[2]}?rehearsal=1`;
      if (!fs.existsSync(path.join(downloadRoot, m[1], m[2]))) {
        log(req.method, p, '->', 404);
        return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
      }
      log(req.method, p, '->', 302, loc);
      return send(res, 302, { Location: loc });
    }
    if ((m = p.match(/^\/objects\/(v[^/]+)\/([^/]+)$/))) {
      const file = path.join(downloadRoot, m[1], m[2]);
      if (!fs.existsSync(file)) {
        log(req.method, p, '->', 404);
        return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
      }
      const data = fs.readFileSync(file);
      log(req.method, p, '->', 200, `${data.length} bytes`);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': data.length });
      return res.end(req.method === 'HEAD' ? undefined : data);
    }
    if (p === '/healthz') return send(res, 200, { 'Content-Type': 'text/plain' }, 'ok');
  } catch (e) {
    log(req.method, p, '->', 500, e.message);
    return send(res, 500, {}, String(e.message));
  }
  log(req.method, p, '->', 404);
  send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
});

server.listen(Number(portArg), host, () => log(`serving ${site} on http://${host}:${portArg}`));
