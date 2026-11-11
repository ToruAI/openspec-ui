#!/usr/bin/env bash
# Check a dist directory is complete, add install.sh, write SHA256SUMS
# (called by release.yml "assemble" and by scripts/rehearse-release.sh).
#
#   scripts/assemble-release.sh <dist-dir> <tag>
set -euo pipefail
[[ $# -eq 2 ]] || { echo "usage: $0 <dist-dir> <tag>" >&2; exit 2; }
dist="$1"; tag="$2"
root="$(cd "$(dirname "$0")/.." && pwd)"

for id in darwin-aarch64 darwin-x86_64 linux-x86_64 linux-aarch64 windows-x86_64; do
  [ -f "$dist/openspec-ui-$id.gz" ] || { echo "::error::missing openspec-ui-$id.gz"; exit 1; }
  [ -f "$dist/openspec-ui-${tag}-$id.zip" ] || { echo "::error::missing openspec-ui-${tag}-$id.zip"; exit 1; }
done
cp "$root/install.sh" "$dist/install.sh"

if command -v sha256sum >/dev/null 2>&1; then
  sum() { sha256sum "$@"; }
else
  sum() { shasum -a 256 "$@"; } # macOS has no sha256sum by default
fi
rm -f "$dist/SHA256SUMS"
tmp="$(mktemp)"
(cd "$dist" && sum -- * | LC_ALL=C sort -k2 > "$tmp")
mv "$tmp" "$dist/SHA256SUMS"
cat "$dist/SHA256SUMS"
