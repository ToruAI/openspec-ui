#!/usr/bin/env bash
# Local rehearsal of a release: build what release.yml would build, package and
# stamp it with the workflow's own scripts, and stand up a fake GitHub Releases
# plus a throwaway npm registry, so `npx openspec-ui` can be exercised for real
# before anything is tagged or published.
#
#   scripts/rehearse-release.sh up       build, assemble, start registry + asset server   (default)
#   scripts/rehearse-release.sh verify   run every install flow end to end, print evidence
#   scripts/rehearse-release.sh env      print `export` lines for a tester's shell
#   scripts/rehearse-release.sh demo     make a fresh copy of demo/ and print its path
#   scripts/rehearse-release.sh shell    open a clean, HOME-isolated shell wired to the rehearsal
#   scripts/rehearse-release.sh status   what is running
#   scripts/rehearse-release.sh stop     stop servers and containers, keep build cache
#   scripts/rehearse-release.sh stop --purge   also delete the whole state directory and rehearsal images
#
# What it does, in release.yml terms:
#   meta        scripts/check-version.sh v<VERSION>
#   build       frontend build, cargo build --release for the host (darwin) and, in Docker,
#               a static musl binary for Linux (the container's architecture)
#   package     scripts/smoke-binary.sh, scripts/package-release.sh
#   assemble    scripts/assemble-release.sh -> dist/ with install.sh and SHA256SUMS
#   npm-package node npm/scripts/stamp.js on a COPY of npm/, npm test, npm pack
#   publish     to a local verdaccio (never to npmjs.org); assets to a local static server
#   image       docker build . (from source) and the `prebuilt` target from the musl binary
#
# Targets that cannot be built on this machine (darwin-x86_64, windows-x86_64, and
# linux-x86_64 unless REHEARSE_X86=1) are filled with clearly marked stub files so
# the real packaging/stamping code paths still run; their downloads are not testable.
#
# Isolation: nothing touches ~/.npmrc, the real npm cache, or the launcher's real
# cache. Everything lives in $REHEARSE_DIR (default /tmp/openspec-ui-rehearsal).
#
# Settings (environment): REHEARSE_REUSE=1 skips the Linux rebuild when the last binary is newer than backend/src,
#   REHEARSE_DIR, REHEARSE_REG_PORT (4890), REHEARSE_SITE_PORT (4891),
#   REHEARSE_BIND (127.0.0.1), REHEARSE_X86=1, REHEARSE_SKIP_IMAGES=1, REHEARSE_TAG (v<VERSION>)
# Ports 3000-3010 are never used for infrastructure; the board keeps its default.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ST="${REHEARSE_DIR:-/tmp/openspec-ui-rehearsal}"
ST="${ST%/}"
REG_PORT="${REHEARSE_REG_PORT:-4890}"
SITE_PORT="${REHEARSE_SITE_PORT:-4891}"
BAD_PORT=$((SITE_PORT + 1))
BIND="${REHEARSE_BIND:-127.0.0.1}"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
TAG="${REHEARSE_TAG:-v$VERSION}"
NPM_VERSION="${TAG#v}"
VERDACCIO_VERSION=6.1.2
CTR_HOST=host.docker.internal # how containers reach this machine

say() { printf '\n== %s\n' "$*"; }
die() { printf 'rehearse: %s\n' "$*" >&2; exit 1; }

# --- isolated npm/node environment ------------------------------------------

iso_env() { # prints env assignments isolating npm from the user's real config
  echo "HOME=$ST/home" "NPM_CONFIG_USERCONFIG=$ST/npmrc.user" "NPM_CONFIG_GLOBALCONFIG=$ST/npmrc.global" \
    "NPM_CONFIG_CACHE=$ST/npm-cache" "NPM_CONFIG_PREFIX=$ST/npm-prefix" "NPM_CONFIG_UPDATE_NOTIFIER=false" \
    "NPM_CONFIG_FUND=false" "NPM_CONFIG_AUDIT=false" "XDG_CONFIG_HOME=$ST/home/.config" "XDG_CACHE_HOME=$ST/home/.cache"
}
# shellcheck disable=SC2046
iso() { env $(iso_env) "$@"; }

init_state() {
  mkdir -p "$ST"/{home,npm-cache,npm-prefix,logs,run,build,cache}
  : > "$ST/npmrc.global"
  printf '//127.0.0.1:%s/:_authToken=rehearsal\n//localhost:%s/:_authToken=rehearsal\n' "$REG_PORT" "$REG_PORT" > "$ST/npmrc.user"
}

host_asset() {
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) echo "darwin-aarch64 aarch64-apple-darwin" ;;
    Darwin-x86_64) echo "darwin-x86_64 x86_64-apple-darwin" ;;
    *) die "this script builds the host binary on macOS only (got $(uname -s)-$(uname -m))" ;;
  esac
}

docker_arch() { # arm64 | amd64 of the Docker engine
  case "$(docker version --format '{{.Server.Arch}}')" in
    arm64 | aarch64) echo arm64 ;;
    *) echo amd64 ;;
  esac
}
linux_asset_for() { case "$1" in arm64) echo linux-aarch64 ;; *) echo linux-x86_64 ;; esac; }

# --- build -------------------------------------------------------------------

build_linux() { # $1 = arm64|amd64 -> $ST/build/linux-$1/openspec-ui
  local arch="$1" cache="$ST/cache/linux-$1"
  mkdir -p "$cache" "$ST/build/linux-$arch"
  if [ "${REHEARSE_REUSE:-}" = 1 ] && [ -x "$cache/openspec-ui" ] && [ "$cache/openspec-ui" -nt "$ROOT/backend/src" ]; then
    echo "reusing $cache/openspec-ui (REHEARSE_REUSE=1)"; cp "$cache/openspec-ui" "$ST/build/linux-$arch/openspec-ui"; return
  fi
  say "Linux musl build ($arch) in Docker"
  docker run --rm --platform "linux/$arch" \
    -v "$ROOT:/src:ro" -v "$cache:/cache" \
    -e CARGO_HOME=/cache/cargo -e CARGO_TARGET_DIR=/cache/target \
    rust:1-alpine sh -ec '
      apk add --no-cache musl-dev >/dev/null
      cd /src/backend && cargo build --release
      cp /cache/target/release/openspec-ui /cache/openspec-ui
      '
  cp "$cache/openspec-ui" "$ST/build/linux-$arch/openspec-ui"
  chmod +x "$ST/build/linux-$arch/openspec-ui"
}

stub_binary() { # $1 asset id -> path of a marked stub
  local f="$ST/build/stub-$1/openspec-ui"
  mkdir -p "$(dirname "$f")"
  printf '#!/bin/sh\necho "rehearsal stub for %s: not built on this machine" >&2\nexit 1\n' "$1" > "$f"
  chmod +x "$f"
  echo "$f"
}

# --- servers -------------------------------------------------------------------

alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

wait_http() { # url, label, seconds

  for _ in $(seq 1 "${3:-60}"); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && return 0
    sleep 1
  done
  die "$2 did not come up at $1 (see $ST/logs)"
}

start_site() { # $1 = site dir, $2 = port, $3 = name
  if alive "$ST/run/$3.pid"; then kill "$(cat "$ST/run/$3.pid")" 2>/dev/null || true; sleep 0.5; fi
  nohup node "$ROOT/scripts/rehearsal-server.mjs" "$1" "$2" "$BIND" > "$ST/logs/$3.log" 2>&1 < /dev/null &
  echo $! > "$ST/run/$3.pid"
  wait_http "http://127.0.0.1:$2/healthz" "asset server" 20
}

install_verdaccio() {
  if [ -x "$ST/tools/node_modules/.bin/verdaccio" ]; then return; fi
  say "Installing verdaccio@$VERDACCIO_VERSION (isolated, from npmjs.org)"
  mkdir -p "$ST/tools"
  iso npm install --prefix "$ST/tools" "verdaccio@$VERDACCIO_VERSION" --no-audit --no-fund --loglevel=error
}

start_registry() {
  install_verdaccio
  # throwaway: every `up` starts from an empty registry so the same version can be republished
  if alive "$ST/run/registry.pid"; then kill "$(cat "$ST/run/registry.pid")" 2>/dev/null || true; sleep 1; fi
  rm -rf "$ST/verdaccio/storage"; mkdir -p "$ST/verdaccio/storage"
  cat > "$ST/verdaccio/config.yaml" <<EOF
storage: $ST/verdaccio/storage
auth:
  htpasswd:
    file: $ST/verdaccio/htpasswd
    max_users: -1
uplinks: {}
packages:
  '**':
    access: \$all
    publish: \$all
    unpublish: \$all
log: { type: file, path: $ST/logs/verdaccio-internal.log, level: warn }
EOF
  if alive "$ST/run/registry.pid"; then return; fi
  # shellcheck disable=SC2046
  nohup env $(iso_env) "$ST/tools/node_modules/.bin/verdaccio" -c "$ST/verdaccio/config.yaml" -l "$BIND:$REG_PORT" \
    > "$ST/logs/registry.log" 2>&1 < /dev/null &
  echo $! > "$ST/run/registry.pid"
  wait_http "http://127.0.0.1:$REG_PORT/-/ping" "registry" 60
}

# --- up --------------------------------------------------------------------------

cmd_up() {
  command -v node >/dev/null || die "node is required"
  command -v cargo >/dev/null || die "cargo is required"
  command -v docker >/dev/null && docker info >/dev/null 2>&1 || die "Docker is required and must be running"
  init_state
  read -r HOST_ID HOST_TARGET <<< "$(host_asset)"
  local darch lasset
  darch="$(docker_arch)"; lasset="$(linux_asset_for "$darch")"

  say "meta: version coherence for $TAG"
  if [ "$TAG" = "v$VERSION" ]; then "$ROOT/scripts/check-version.sh" "$TAG"; else echo "(custom tag $TAG: skipping tag check)"; fi

  say "build: frontend"
  (cd "$ROOT/frontend" && { [ -d node_modules ] || npm ci; } && npm run build 2>&1 | tail -3)

  say "build: host binary ($HOST_TARGET)"
  (cd "$ROOT/backend" && cargo build --release --target "$HOST_TARGET" 2>&1 | tail -2)
  local hostbin="$ROOT/backend/target/$HOST_TARGET/release/openspec-ui"

  say "smoke: host binary"
  "$ROOT/scripts/smoke-binary.sh" "$hostbin" "$TAG" || { [ "$TAG" != "v$VERSION" ] && echo "(version check skipped for custom tag)"; }

  build_linux "$darch"
  local linuxbin="$ST/build/linux-$darch/openspec-ui"
  if [ "$darch" = arm64 ] && [ "${REHEARSE_X86:-}" = 1 ]; then build_linux amd64; fi

  say "package: dist/ via scripts/package-release.sh"
  rm -rf "$ST/dist"; mkdir -p "$ST/dist"
  local ids="darwin-aarch64 darwin-x86_64 linux-x86_64 linux-aarch64 windows-x86_64" id bin stubs=""
  for id in $ids; do
    
    if [ "$id" = "$HOST_ID" ]; then bin="$hostbin"
    elif [ "$id" = "$lasset" ]; then bin="$linuxbin"
    elif [ "$id" = linux-x86_64 ] && [ -x "$ST/build/linux-amd64/openspec-ui" ]; then bin="$ST/build/linux-amd64/openspec-ui"
    else bin="$(stub_binary "$id")"; stubs="$stubs $id"; fi
    "$ROOT/scripts/package-release.sh" "$bin" "$id" "$TAG" "$ST/dist"
  done
  echo "$stubs" | tr ' ' '\n' | sed '/^$/d' > "$ST/stubs.txt"

  say "assemble: scripts/assemble-release.sh"
  "$ROOT/scripts/assemble-release.sh" "$ST/dist" "$TAG"

  say "asset names: producers vs consumers"
  node "$ROOT/scripts/check-asset-names.mjs" "$ST/dist"

  say "site: GitHub-Releases-shaped layout"
  rm -rf "$ST/site"; mkdir -p "$ST/site/releases/download/$TAG"
  cp "$ST"/dist/* "$ST/site/releases/download/$TAG/"
  echo "$TAG" > "$ST/site/LATEST"

  say "npm-package: stamp a COPY of npm/, test, pack"
  rm -rf "$ST/npm-pkg" "$ST/out"; mkdir -p "$ST/out"
  mkdir "$ST/npm-pkg"
  (cd "$ROOT/npm" && tar -cf - --exclude node_modules .) | (cd "$ST/npm-pkg" && tar -xf -)
  node "$ST/npm-pkg/scripts/stamp.js" "$NPM_VERSION" "$ST/dist/SHA256SUMS"
  (cd "$ST/npm-pkg" && iso npm test 2>&1 | tail -8)
  (cd "$ST/npm-pkg" && iso npm pack --pack-destination "$ST/out" --loglevel=error)
  tar -tzf "$ST"/out/*.tgz
  tar -xzOf "$ST"/out/*.tgz package/checksums.json

  say "asset server on $BIND:$SITE_PORT"
  start_site "$ST/site" "$SITE_PORT" site

  say "registry on $BIND:$REG_PORT (verdaccio, no uplink)"
  start_registry
  iso npm publish "$ST"/out/*.tgz --registry "http://127.0.0.1:$REG_PORT/" --tag latest --loglevel=error 2>&1 | tail -3 \
    || true
  iso npm view openspec-ui version --registry "http://127.0.0.1:$REG_PORT/" | grep -qx "$NPM_VERSION" \
    || die "published package not visible in the local registry"
  echo "openspec-ui@$NPM_VERSION is in the local registry"

  if [ "${REHEARSE_SKIP_IMAGES:-}" != 1 ]; then
    say "image: docker build . (from source) and prebuilt target"
    docker build -t openspec-ui:rehearsal-src "$ROOT" 2>&1 | tail -4
    "$ROOT/scripts/unpack-image-bins.sh" "$ST/dist" "$ST/bins"
    docker build --target prebuilt --platform "linux/$darch" --build-context "bins=$ST/bins" -t openspec-ui:rehearsal "$ROOT" 2>&1 | tail -4
  fi

  cmd_demo > /dev/null
  write_env
  say "READY"
  cat "$ST/env.sh"
  echo
  echo "fresh demo copy: $(cat "$ST/demo-path")"
  [ -s "$ST/stubs.txt" ] && echo "stub assets (not testable): $(tr '\n' ' ' < "$ST/stubs.txt")"
  echo "Run '$0 verify' for the full end-to-end check, '$0 stop' to tear down."
}

write_env() {
  cat > "$ST/env.sh" <<EOF
# source this in a tester shell:   . $ST/env.sh
export HOME=$ST/tester-home
export NPM_CONFIG_USERCONFIG=$ST/npmrc.tester
export NPM_CONFIG_GLOBALCONFIG=$ST/npmrc.global
export NPM_CONFIG_CACHE=$ST/tester-npm-cache
export NPM_CONFIG_UPDATE_NOTIFIER=false
export NPM_CONFIG_REGISTRY=http://127.0.0.1:$REG_PORT/
export OPENSPEC_UI_DOWNLOAD_BASE=http://127.0.0.1:$SITE_PORT/releases/download
export OPENSPEC_UI_CACHE_DIR=$ST/tester-launcher-cache
export OPENSPEC_UI_INSTALL_DIR=$ST/tester-bin
# containers reach the same servers at http://$CTR_HOST:<port>/ instead of 127.0.0.1
# install.sh one-liner:  curl -fsSL http://127.0.0.1:$SITE_PORT/releases/latest/download/install.sh | sh
EOF
  mkdir -p "$ST/tester-home"
  : > "$ST/npmrc.tester"
}

cmd_env() { [ -f "$ST/env.sh" ] || die "not running; run '$0 up' first"; grep -v '^#' "$ST/env.sh"; }

cmd_demo() { # fresh copy of demo/
  mkdir -p "$ST/demo-copies"
  local n d
  n="$(date +%s)-$$"
  d="$ST/demo-copies/demo-$n"
  mkdir -p "$d"
  (cd "$ROOT/demo" && tar -cf - --exclude .cache --exclude screenshots .) | (cd "$d" && tar -xf -)
  echo "$d" > "$ST/demo-path"
  echo "$d"
}

cmd_shell() {
  [ -f "$ST/env.sh" ] || die "not running; run '$0 up' first"
  cd "$(cat "$ST/demo-path")"
  echo "Clean shell in $(pwd). Try:  npx -y openspec-ui"
  # shellcheck disable=SC1090
  exec env -i PATH="$PATH" TERM="${TERM:-dumb}" bash --noprofile --norc -c ". '$ST/env.sh'; exec bash --noprofile --norc -i"
}

# --- status / stop ---------------------------------------------------------------

cmd_status() {
  local n
  for n in registry site site-bad; do
    if alive "$ST/run/$n.pid"; then echo "$n: running (pid $(cat "$ST/run/$n.pid"))"; else echo "$n: stopped"; fi
  done
  [ -f "$ST/env.sh" ] && cmd_env
  return 0
}

cmd_stop() {
  local n
  for n in registry site site-bad; do
    if alive "$ST/run/$n.pid"; then kill "$(cat "$ST/run/$n.pid")" 2>/dev/null || true; echo "stopped $n"; fi
    rm -f "$ST/run/$n.pid"
  done
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker ps -aq --filter "label=openspec-ui-rehearsal" | xargs -r docker rm -f >/dev/null 2>&1 || true
    docker ps -aq --filter "name=^rh-" | xargs -r docker rm -f >/dev/null 2>&1 || true
  fi
  if [ "${1:-}" = "--purge" ]; then
    command -v docker >/dev/null 2>&1 && docker rmi openspec-ui:rehearsal openspec-ui:rehearsal-src >/dev/null 2>&1 || true
    rm -rf "$ST"
    echo "removed $ST"
  fi
}

# --- verify ----------------------------------------------------------------------

PASS=0; FAILN=0
RESULTS=""
ok() { PASS=$((PASS + 1)); RESULTS="$RESULTS
PASS  $1  |  $2"; printf 'PASS  %s  |  %s\n' "$1" "$2"; }
bad() { FAILN=$((FAILN + 1)); RESULTS="$RESULTS
FAIL  $1  |  $2"; printf 'FAIL  %s  |  %s\n' "$1" "$2"; }
check() { # name, evidence-on-success; command in "$@" after
  local name="$1" ev="$2"; shift 2
  if "$@" > "$ST/logs/last-check.out" 2>&1; then ok "$name" "$ev"; else bad "$name" "$(tail -3 "$ST/logs/last-check.out" | tr '\n' ' ')"; fi
}

json_get() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a==null?a:a[k],o);console.log(typeof v==="object"?JSON.stringify(v):v)})' "$1"; }

sources_count() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log((o.sources||[]).length)})'; }

# a minimal clean environment for a "tester" process on the host
tester() { env -i PATH="$PATH" TERM=dumb HOME="$ST/verify-home" \
  NPM_CONFIG_USERCONFIG="$ST/verify-home/.npmrc" NPM_CONFIG_GLOBALCONFIG="$ST/npmrc.global" \
  NPM_CONFIG_CACHE="$ST/verify-home/npm-cache" NPM_CONFIG_UPDATE_NOTIFIER=false \
  NPM_CONFIG_REGISTRY="http://127.0.0.1:$REG_PORT/" \
  OPENSPEC_UI_DOWNLOAD_BASE="http://127.0.0.1:$SITE_PORT/releases/download" \
  OPENSPEC_UI_CACHE_DIR="$ST/verify-home/launcher-cache" "$@"; }

wait_line() { # file, pattern, seconds

  for _ in $(seq 1 "$3"); do grep -q "$2" "$1" 2>/dev/null && return 0; sleep 1; done
  return 1
}

fresh_demo() { local d="$ST/verify-demo"; rm -rf "$d"; mkdir -p "$d"; (cd "$ROOT/demo" && tar -cf - --exclude .cache --exclude screenshots .) | (cd "$d" && tar -xf -); echo "$d"; }

verify_host_npx() {
  say "macOS host: npx -y openspec-ui (clean HOME, local registry)"
  rm -rf "$ST/verify-home"; mkdir -p "$ST/verify-home"; : > "$ST/verify-home/.npmrc"
  local d out url pid
  d="$(fresh_demo)"; out="$ST/logs/verify-host-npx.out"; : > "$out"
  (cd "$d" && nohup "$(command -v env)" -i PATH="$PATH" TERM=dumb HOME="$ST/verify-home" \
    NPM_CONFIG_USERCONFIG="$ST/verify-home/.npmrc" NPM_CONFIG_GLOBALCONFIG="$ST/npmrc.global" \
    NPM_CONFIG_CACHE="$ST/verify-home/npm-cache" NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_REGISTRY="http://127.0.0.1:$REG_PORT/" OPENSPEC_UI_DOWNLOAD_BASE="http://127.0.0.1:$SITE_PORT/releases/download" \
    OPENSPEC_UI_CACHE_DIR="$ST/verify-home/launcher-cache" npx -y openspec-ui > "$out" 2>&1 < /dev/null &)
  if ! wait_line "$out" 'running at' 90; then bad "host npx starts" "$(tail -5 "$out" | tr '\n' ' ')"; return; fi
  url="$(sed -n 's/.*running at \([^ ]*\).*/\1/p' "$out" | head -1)"
  ok "host: npx -y openspec-ui starts" "$(grep 'running at' "$out" | head -1)"
  check "host: downloaded via rehearsal assets, checksum verified, cached outside real cache" \
    "$(cd "$ST/verify-home/launcher-cache" && find . -type f | head -1)" test -x "$ST/verify-home/launcher-cache/$NPM_VERSION/$(host_asset | cut -d' ' -f1)/openspec-ui"
  local info n
  info="$(curl -fsS "$url/api/info")"; n="$(printf '%s' "$info" | sources_count)"
  [ "$n" = 4 ] && ok "host: /api/info lists four repos" "sources=$n version=$(printf '%s' "$info" | json_get version)" || bad "host: /api/info four repos" "sources=$n"
  check "host: / serves the UI" 'id="root" present' sh -c "curl -fsS '$url/' | grep -q 'id=\"root\"'"
  local second
  second="$(cd "$d" && tester npx -y openspec-ui --json 2>&1)"
  if printf '%s' "$second" | grep -q '"reused":[ ]*true'; then ok "host: second run reuses the server" "$(printf '%s' "$second" | head -c 160)"; else bad "host: second run reuses" "$second"; fi
  local ver
  ver="$(cd "$d" && tester npx -y openspec-ui --version 2>&1)"
  case "$ver" in *"$VERSION"*) ok "host: npx -y openspec-ui --version" "$ver" ;; *) bad "host: --version" "$ver" ;; esac
  pid="$(printf '%s' "$info" | json_get pid)"
  kill "$pid" 2>/dev/null || true
  sleep 1
  tester npx -y openspec-ui --help > /dev/null 2>&1 || true
}

verify_container_npx() { # image, host-port, name
  local image="$1" port="$2" name="rh-npx-$3" d out info n
  say "Container $image: npx -y openspec-ui --json --host 0.0.0.0"
  d="$(fresh_demo)"
  docker rm -f "$name" > /dev/null 2>&1 || true
  : > "$ST/logs/site-before.mark"
  local before; before="$(wc -l < "$ST/logs/site.log")"
  docker run -d --name "$name" --label openspec-ui-rehearsal -p "127.0.0.1:$port:3000" \
    -v "$d:/work/demo:ro" -w /work/demo \
    -e "NPM_CONFIG_REGISTRY=http://$CTR_HOST:$REG_PORT/" \
    -e "OPENSPEC_UI_DOWNLOAD_BASE=http://$CTR_HOST:$SITE_PORT/releases/download" \
    "$image" npx -y openspec-ui --json --host 0.0.0.0 > /dev/null
  local up=
  for _ in $(seq 1 90); do curl -fsS "http://127.0.0.1:$port/api/health" > /dev/null 2>&1 && { up=1; break; }; sleep 1; done
  docker logs "$name" > "$ST/logs/$name.log" 2>&1 || true
  if [ -z "$up" ]; then bad "$image npx" "$(tail -4 "$ST/logs/$name.log" | tr '\n' ' ')"; docker rm -f "$name" > /dev/null; return; fi
  info="$(curl -fsS "http://127.0.0.1:$port/api/info")"; n="$(printf '%s' "$info" | sources_count)"
  [ "$n" = 4 ] && ok "$image: board reachable from host, four repos" "http://127.0.0.1:$port sources=$n version=$(printf '%s' "$info" | json_get version)" || bad "$image: four repos" "sources=$n"
  check "$image: / serves the UI" 'id="root" present' sh -c "curl -fsS 'http://127.0.0.1:$port/' | grep -q 'id=\"root\"'"
  local hits; hits="$(tail -n +$((before + 1)) "$ST/logs/site.log" | grep -c "openspec-ui-linux-" || true)"
  [ "$hits" -ge 1 ] && ok "$image: binary came from the rehearsal asset server (via redirect)" "$(tail -n +$((before + 1)) "$ST/logs/site.log" | grep 'linux-' | head -2 | sed 's/^[^ ]* //' | tr '\n' ';')" || bad "$image: asset server saw no download" "hits=$hits"
  docker rm -f "$name" > /dev/null
}

verify_install_sh() {
  say "install.sh: host (isolated install dir) and clean Alpine container"
  local t base="http://127.0.0.1:$SITE_PORT"
  t="$(mktemp -d "$ST/verify-install.XXXX")"
  local out
  out="$(env -i PATH="$PATH" HOME="$t/home" OPENSPEC_UI_DOWNLOAD_BASE="$base/releases" OPENSPEC_UI_INSTALL_DIR="$t/bin" \
    sh -c "curl -fsSL '$base/releases/latest/download/install.sh' | sh" 2>&1)" || { bad "install.sh host" "$out"; return; }
  printf '%s\n' "$out" | sed 's/^/    /'
  case "$out" in *"Checksum OK"*) ok "install.sh host: latest/download via redirect, checksum verified" "$(printf '%s' "$out" | grep -E 'Checksum OK|Installed' | tr '\n' ';')" ;; *) bad "install.sh host" "$out" ;; esac
  local v; v="$("$t/bin/openspec-ui" --version 2>&1)"
  case "$v" in *"$VERSION"*) ok "install.sh host: installed binary runs" "$v" ;; *) bad "install.sh host binary" "$v" ;; esac
  # the launcher-style base (.../releases/download) must work for install.sh as well
  out="$(env -i PATH="$PATH" HOME="$t/home" OPENSPEC_UI_DOWNLOAD_BASE="$base/releases/download" OPENSPEC_UI_VERSION="$VERSION" OPENSPEC_UI_INSTALL_DIR="$t/bin2" \
    sh "$ROOT/install.sh" 2>&1)" && case "$out" in *"Checksum OK"*) ok "install.sh host: same DOWNLOAD_BASE as the launcher (.../releases/download) + pinned version" "$(printf '%s' "$out" | grep Installed)" ;; *) bad "install.sh base compat" "$out" ;; esac || bad "install.sh base compat" "$out"

  local d; d="$(fresh_demo)"
  docker rm -f rh-install > /dev/null 2>&1 || true
  out="$(docker run --name rh-install --label openspec-ui-rehearsal -v "$d:/work/demo:ro" -v "$ROOT/install.sh:/mnt/install.sh:ro" -w /work/demo \
    -e "OPENSPEC_UI_DOWNLOAD_BASE=http://$CTR_HOST:$SITE_PORT/releases" alpine:3.21 sh -ec "
      wget -qO- http://$CTR_HOST:$SITE_PORT/releases/latest/download/install.sh | sh
      ~/.local/bin/openspec-ui --version
      (~/.local/bin/openspec-ui --json --host 0.0.0.0 > /tmp/b.out 2>&1 &)
      i=0; until wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; do i=\$((i+1)); [ \$i -gt 30 ] && cat /tmp/b.out && exit 1; sleep 1; done
      wget -qO- http://127.0.0.1:3000/api/info | head -c 200; echo
      " 2>&1)" || { bad "install.sh alpine" "$out"; docker rm -f rh-install > /dev/null 2>&1; return; }
  docker rm -f rh-install > /dev/null 2>&1 || true
  printf '%s\n' "$out" | sed 's/^/    /'
  case "$out" in *"Checksum OK"*"openspec-ui $VERSION"*) ok "install.sh clean Alpine (busybox wget): installs, checksum, runs, board healthy" "$(printf '%s' "$out" | grep -E 'Installed|openspec-ui [0-9]' | tr '\n' ';')" ;; *) bad "install.sh alpine" "$out" ;; esac
}

verify_tamper() {
  say "Tampered download: checksum must refuse"
  rm -rf "$ST/site-bad"; mkdir -p "$ST/site-bad/releases/download"
  cp -R "$ST/site/releases/download/$TAG" "$ST/site-bad/releases/download/$TAG"
  echo "$TAG" > "$ST/site-bad/LATEST"
  local f
  for f in "$ST"/site-bad/releases/download/"$TAG"/openspec-ui-*.gz; do printf 'X' | dd of="$f" bs=1 seek=40 conv=notrunc 2> /dev/null; done
  start_site "$ST/site-bad" "$BAD_PORT" site-bad
  local t out; t="$(mktemp -d "$ST/verify-tamper.XXXX")"
  if out="$(env -i PATH="$PATH" HOME="$t" OPENSPEC_UI_DOWNLOAD_BASE="http://127.0.0.1:$BAD_PORT/releases" OPENSPEC_UI_INSTALL_DIR="$t/bin" sh "$ROOT/install.sh" 2>&1)"; then
    bad "install.sh rejects tampered asset" "it installed anyway"
  else
    case "$out" in *"checksum mismatch"*) [ ! -e "$t/bin/openspec-ui" ] && ok "install.sh rejects tampered asset, installs nothing" "$(printf '%s' "$out" | head -c 110)" || bad "install.sh tamper" "binary exists" ;; *) bad "install.sh tamper message" "$out" ;; esac
  fi
  rm -rf "$ST/verify-home"; mkdir -p "$ST/verify-home"; : > "$ST/verify-home/.npmrc"
  if out="$(cd "$t" && env -i PATH="$PATH" HOME="$ST/verify-home" NPM_CONFIG_USERCONFIG="$ST/verify-home/.npmrc" NPM_CONFIG_GLOBALCONFIG="$ST/npmrc.global" \
      NPM_CONFIG_CACHE="$ST/verify-home/npm-cache" NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_REGISTRY="http://127.0.0.1:$REG_PORT/" \
      OPENSPEC_UI_DOWNLOAD_BASE="http://127.0.0.1:$BAD_PORT/releases/download" OPENSPEC_UI_CACHE_DIR="$ST/verify-home/lc" npx -y openspec-ui --version 2>&1)"; then
    bad "launcher rejects tampered asset" "it ran: $out"
  else
    case "$out" in *"Checksum mismatch"*) ok "launcher rejects tampered asset, nothing cached" "$(printf '%s' "$out" | grep -m1 'Checksum mismatch')" ;; *) bad "launcher tamper message" "$out" ;; esac
  fi
  if alive "$ST/run/site-bad.pid"; then kill "$(cat "$ST/run/site-bad.pid")" 2>/dev/null || true; rm -f "$ST/run/site-bad.pid"; fi
}

verify_images() {
  [ "${REHEARSE_SKIP_IMAGES:-}" = 1 ] && return
  say "Docker images"
  local img d port=4896 name out st
  for img in openspec-ui:rehearsal-src openspec-ui:rehearsal; do
    d="$(fresh_demo)"; name="rh-img-$(echo "$img" | tr ':' '-')"
    docker rm -f "$name" > /dev/null 2>&1 || true
    docker run -d --name "$name" --label openspec-ui-rehearsal -p "127.0.0.1:$port:3000" -v "$d:/repos:ro" "$img" > /dev/null
    for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$port/api/health" > /dev/null 2>&1 && break; sleep 0.5; done
    out="$(curl -fsS "http://127.0.0.1:$port/api/info" 2>&1 || true)"
    local n; n="$(printf '%s' "$out" | sources_count 2> /dev/null || echo 0)"
    [ "$n" = 4 ] && ok "$img: four repos at /repos" "sources=$n version=$(printf '%s' "$out" | json_get version) user=$(docker exec "$name" id -u 2> /dev/null)" || bad "$img four repos" "$out"
    st=
    for _ in $(seq 1 50); do st="$(docker inspect -f '{{.State.Health.Status}}' "$name")"; [ "$st" = healthy ] && break; sleep 1; done
    [ "$st" = healthy ] && ok "$img: Docker reports healthy" "health=$st" || bad "$img health" "health=$st"
    docker rm -f "$name" > /dev/null
  done
  d="$(fresh_demo)"
  check "scripts/smoke-image.sh (release.yml's image step) on the prebuilt image" "smoke ok" "$ROOT/scripts/smoke-image.sh" openspec-ui:rehearsal "$d" "$port"
}

verify_workflow_logic() {
  say "Release workflow logic"
  check "actionlint on all workflows" "no findings" actionlint
  check "scripts/check-version.sh $TAG" "version ok: $VERSION" "$ROOT/scripts/check-version.sh" "$TAG"
  check "asset names: workflow vs launcher vs install.sh vs dist" "agree" node "$ROOT/scripts/check-asset-names.mjs" "$ST/dist"
  check "npm test (launcher) on the stamped copy" "all pass" iso sh -c "cd '$ST/npm-pkg' && npm test"
}

cmd_verify() {
  [ -f "$ST/env.sh" ] || die "not running; run '$0 up' first"
  alive "$ST/run/registry.pid" && alive "$ST/run/site.pid" || die "servers are not running; run '$0 up'"
  : > "$ST/evidence.log"
  {
    verify_workflow_logic
    verify_host_npx
    verify_container_npx node:22-slim 4895 slim
    verify_container_npx node:22-alpine 4895 alpine
    verify_container_npx node:18-slim 4895 node18
    verify_install_sh
    verify_tamper
    verify_images
    say "SUMMARY ($PASS passed, $FAILN failed)"
    printf '%s\n' "$RESULTS"
  } 2>&1 | tee "$ST/evidence.log"
  # the subshell of tee hides counters; recount from the log
  if grep -q '^FAIL ' "$ST/evidence.log"; then echo "verify: FAILURES (see $ST/evidence.log)"; exit 1; fi
  echo "verify: all flows passed (evidence in $ST/evidence.log)"
}

case "${1:-up}" in
  up) cmd_up ;;
  verify) cmd_verify ;;
  env) cmd_env ;;
  demo) cmd_demo ;;
  shell) cmd_shell ;;
  status) cmd_status ;;
  stop) shift; cmd_stop "$@" ;;
  -h | --help | help) sed -n '2,32p' "$0" ;;
  *) die "unknown command '$1' (up | verify | env | demo | shell | status | stop [--purge])" ;;
esac
