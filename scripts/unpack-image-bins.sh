#!/usr/bin/env bash
# Build context for the `prebuilt` Docker target: unpack the linux release
# binaries as <bins>/amd64/openspec-ui and <bins>/arm64/openspec-ui.
#
#   scripts/unpack-image-bins.sh <dist-dir> <bins-dir>
set -euo pipefail
[[ $# -eq 2 ]] || { echo "usage: $0 <dist-dir> <bins-dir>" >&2; exit 2; }
dist="$1"; bins="$2"
mkdir -p "$bins/amd64" "$bins/arm64"
gzip -dc "$dist/openspec-ui-linux-x86_64.gz" > "$bins/amd64/openspec-ui"
gzip -dc "$dist/openspec-ui-linux-aarch64.gz" > "$bins/arm64/openspec-ui"
chmod +x "$bins"/*/openspec-ui
