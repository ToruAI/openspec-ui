# openspec-ui

Read-only kanban dashboard for [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes and specs.

    npx openspec-ui

This package is a small launcher. On first run it downloads the matching binary
from the GitHub Release for this exact version, verifies its SHA-256 against
checksums bundled in this package, caches it, and runs it. All arguments are
passed through.

Environment variables:

- `OPENSPEC_UI_BIN` - run this local binary instead of downloading.
- `OPENSPEC_UI_DOWNLOAD_BASE` - mirror of `https://github.com/ToruAI/openspec-ui/releases/download` (layout `<base>/v<version>/openspec-ui-<platform>.gz`).
- `OPENSPEC_UI_CACHE_DIR` - where binaries are cached.
- `HTTPS_PROXY` / `NO_PROXY` - respected for downloads.

Source and docs: https://github.com/ToruAI/openspec-ui
