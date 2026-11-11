#!/usr/bin/env node
'use strict';
// Publish-time stamping: node scripts/stamp.js <version> <SHA256SUMS>
// Writes the version into package.json and the launcher asset hashes into
// checksums.json. Run on a CI checkout or a copy; never commit the result.
const fs = require('node:fs');
const path = require('node:path');

const [version, sumsFile] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version || '') || !sumsFile) {
  console.error('usage: stamp.js <version without leading v> <SHA256SUMS file>');
  process.exit(2);
}
const ids = ['darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'linux-aarch64', 'windows-x86_64'];
const sums = {};
for (const line of fs.readFileSync(sumsFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
  if (m) sums[path.basename(m[2])] = m[1].toLowerCase();
}
const assets = {};
for (const id of ids) {
  const name = `openspec-ui-${id}.gz`;
  if (!sums[name]) {
    console.error(`missing checksum for ${name} in ${sumsFile}`);
    process.exit(1);
  }
  assets[name] = sums[name];
}
const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'checksums.json'), JSON.stringify({ version, assets }, null, 2) + '\n');
console.log(`stamped ${pkg.name}@${version} with ${ids.length} checksums`);
