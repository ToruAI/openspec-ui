#!/usr/bin/env bash
# Start a built binary on the example repo and check it is healthy, serves the
# embedded UI and reports the expected version (release.yml "Smoke test").
#
#   scripts/smoke-binary.sh <binary> <tag>        (SMOKE_PORT overrides 3917)
set -euo pipefail
[[ $# -eq 2 ]] || { echo "usage: $0 <binary> <tag>" >&2; exit 2; }
BIN="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; tag="$2"
cd "$(dirname "$0")/.."
port="${SMOKE_PORT:-3917}"
work="$(mktemp -d)"
trap 'kill "${pid:-}" 2>/dev/null || true; rm -rf "$work"' EXIT

src="$(cygpath -m "$PWD/demo/storefront/openspec" 2>/dev/null || echo "$PWD/demo/storefront/openspec")"
printf '{"sources":[{"name":"example","path":"%s"}],"port":%s}' "$src" "$port" > "$work/config.json"
PORT="$port" "$BIN" --config "$work/config.json" &
pid=$!
ok=false
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then ok=true; break; fi
  sleep 0.5
done
if [ "$ok" != true ]; then echo "::error::binary did not become healthy"; exit 1; fi
curl -fsS "http://127.0.0.1:$port/" | grep -q 'id="root"' || { echo "::error::embedded frontend missing"; exit 1; }
kill "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true
BINARY="$BIN" scripts/check-version.sh "$tag"
