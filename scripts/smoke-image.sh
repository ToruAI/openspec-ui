#!/usr/bin/env bash
# Run a built image on a repos folder and check it becomes healthy and serves
# the UI (release.yml "Run the image").
#
#   scripts/smoke-image.sh <image> <repos-dir> [host-port=3000]
set -euo pipefail
[[ $# -ge 2 ]] || { echo "usage: $0 <image> <repos-dir> [port]" >&2; exit 2; }
image="$1"; repos="$2"; port="${3:-3000}"
name="openspec-ui-smoke-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -p "$port:3000" -v "$repos:/repos:ro" "$image" >/dev/null
ok=
for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && ok=1 && break
  sleep 0.5
done
docker logs "$name"
[ "$ok" = 1 ] || { echo "::error::container never became healthy"; exit 1; }
curl -fsS "http://127.0.0.1:$port/" | grep -q 'id="root"' || { echo "::error::embedded frontend missing"; exit 1; }
echo "image smoke ok: $(curl -fsS "http://127.0.0.1:$port/api/info" | head -c 300)"
