#!/usr/bin/env bash
# Package one built binary the way a release does (called by release.yml and
# by scripts/rehearse-release.sh, so both produce the same files).
#
#   scripts/package-release.sh <binary> <asset-id> <tag> [outdir=dist] [--no-zip]
#
# Writes <outdir>/openspec-ui-<asset-id>.gz           (npm launcher, install.sh)
#        <outdir>/openspec-ui-<tag>-<asset-id>.zip    (humans; unix layout)
# Windows zips are made by the workflow itself (pwsh Compress-Archive); it
# passes --no-zip here to get only the .gz.
set -euo pipefail
[[ $# -ge 3 ]] || { echo "usage: $0 <binary> <asset-id> <tag> [outdir]" >&2; exit 2; }
bin="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
asset="$2"; tag="$3"; out="${4:-dist}"; zipit=1
[ "${5:-}" = "--no-zip" ] && zipit=0
mkdir -p "$out"
out="$(cd "$out" && pwd)"
cd "$(dirname "$0")/.."

gzip -9 -n -c "$bin" > "$out/openspec-ui-${asset}.gz"

if [ "$zipit" = 0 ]; then echo "packaged ${asset}: openspec-ui-${asset}.gz"; exit 0; fi

stage="openspec-ui-${tag}-${asset}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/$stage"
cp "$bin" "$work/$stage/openspec-ui"
cp README.md "$work/$stage/"
if [ -f LICENSE ]; then cp LICENSE "$work/$stage/"; fi
rm -f "$out/${stage}.zip"
(cd "$work" && zip -qr "$out/${stage}.zip" "$stage")
echo "packaged ${asset}: openspec-ui-${asset}.gz, ${stage}.zip"
