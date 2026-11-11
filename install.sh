#!/bin/sh
# openspec-ui installer for macOS and Linux.
#
#   curl -fsSL https://github.com/ToruAI/openspec-ui/releases/latest/download/install.sh | sh
#
# Environment:
#   OPENSPEC_UI_VERSION       version to install, e.g. 0.3.0 (default: latest release)
#   OPENSPEC_UI_INSTALL_DIR   target directory (default: $HOME/.local/bin)
#   OPENSPEC_UI_DOWNLOAD_BASE release URL base, for mirrors/tests
#                             (default: https://github.com/ToruAI/openspec-ui/releases;
#                             a trailing /download is accepted, so the same value
#                             works for the npm launcher, which uses .../releases/download)
#
# No sudo. Safe to re-run: the binary is replaced atomically.

set -eu

main() {
  repo_base="${OPENSPEC_UI_DOWNLOAD_BASE:-https://github.com/ToruAI/openspec-ui/releases}"
  repo_base="${repo_base%/}"
  repo_base="${repo_base%/download}"
  install_dir="${OPENSPEC_UI_INSTALL_DIR:-$HOME/.local/bin}"

  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin) os_id=darwin ;;
    Linux) os_id=linux ;;
    *) die "unsupported OS '$os'. On Windows use: npx openspec-web (or download the .zip from the releases page)." ;;
  esac
  case "$arch" in
    arm64 | aarch64) arch_id=aarch64 ;;
    x86_64 | amd64) arch_id=x86_64 ;;
    *) die "unsupported architecture '$arch'. Build from source: https://github.com/ToruAI/openspec-ui#build-from-source" ;;
  esac
  # Rosetta: a shell running as x86_64 on an Apple Silicon Mac should still get the native binary.
  if [ "$os_id" = darwin ] && [ "$arch_id" = x86_64 ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = 1 ]; then
    arch_id=aarch64
  fi
  asset="openspec-ui-${os_id}-${arch_id}.gz"

  if [ -n "${OPENSPEC_UI_VERSION:-}" ]; then
    v="${OPENSPEC_UI_VERSION#v}"
    url_dir="$repo_base/download/v$v"
  else
    url_dir="$repo_base/latest/download"
  fi

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT INT TERM

  say "Downloading $asset ..."
  fetch "$url_dir/$asset" "$tmp/$asset"
  fetch "$url_dir/SHA256SUMS" "$tmp/SHA256SUMS"

  expected="$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1; exit }' "$tmp/SHA256SUMS")"
  [ -n "$expected" ] || die "$asset is not listed in SHA256SUMS"
  actual="$(sha256 "$tmp/$asset")"
  [ "$expected" = "$actual" ] || die "checksum mismatch for $asset (expected $expected, got $actual). Nothing was installed."
  say "Checksum OK."

  gzip -dc "$tmp/$asset" > "$tmp/openspec-ui"
  chmod 755 "$tmp/openspec-ui"

  mkdir -p "$install_dir"
  # Copy next to the destination, then rename: atomic, and works while the old binary is running.
  cp "$tmp/openspec-ui" "$install_dir/.openspec-ui.$$"
  mv -f "$install_dir/.openspec-ui.$$" "$install_dir/openspec-ui"
  say "Installed $install_dir/openspec-ui"

  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *)
      say ""
      say "$install_dir is not on your PATH. Add it, e.g.:"
      say "  echo 'export PATH=\"$install_dir:\$PATH\"' >> ~/.profile"
      ;;
  esac
  say ""
  say "Next: run  openspec-ui  in a project (or see the README for options)."
  say "Update: re-run this installer.  Uninstall: rm $install_dir/openspec-ui"
}

say() { printf '%s\n' "$*"; }
die() { printf 'openspec-ui install: %s\n' "$*" >&2; exit 1; }

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 2 -o "$2" "$1" || die "download failed: $1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$2" "$1" || die "download failed: $1"
  else
    die "need curl or wget"
  fi
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    die "need sha256sum or shasum to verify the download"
  fi
}

main "$@"
