#!/usr/bin/env bash
# Version coherence check. VERSION is the single source of truth.
#
#   scripts/check-version.sh              CI: VERSION == backend/Cargo.toml, npm placeholder untouched
#   scripts/check-version.sh v0.3.0       release: additionally the tag must equal v$(VERSION)
#   BINARY=path scripts/check-version.sh  additionally, if the binary answers --version, it must match
#
# The npm package never carries a version in git ("0.0.0-dev"); it is stamped
# from the tag at publish time, so it cannot drift.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "version check failed: $*" >&2; exit 1; }

version="$(tr -d '[:space:]' < VERSION)"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || fail "VERSION is not semver: '$version'"

cargo="$(awk '/^\[package\]/{p=1;next} /^\[/{p=0} p && /^version[[:space:]]*=/{gsub(/"/,"",$3); print $3; exit}' backend/Cargo.toml)"
[[ "$cargo" == "$version" ]] || fail "VERSION is $version but backend/Cargo.toml is '$cargo'"

npm_version="$(node -p "require('./npm/package.json').version")"
[[ "$npm_version" == "0.0.0-dev" ]] || fail "npm/package.json must keep the placeholder 0.0.0-dev in git (found $npm_version); it is stamped at publish time"

if [[ -n "${1:-}" ]]; then
  [[ "$1" == "v$version" ]] || fail "tag is $1 but VERSION says v$version"
fi

if [[ -n "${BINARY:-}" ]]; then
  if out="$("$BINARY" --version 2>/dev/null)"; then
    grep -q "$version" <<<"$out" || fail "binary reports '$out', expected $version"
    echo "binary --version: $out"
  else
    echo "note: binary has no --version yet; skipped binary check"
  fi
fi

echo "version ok: $version"
