# OpenSpec UI

A local, read-only web board for OpenSpec: changes by stage, the artifact chain of each change, specs and ideas, across every repo with an `openspec/` folder. Independent community project, not affiliated with Fission-AI.

## Tech Stack
- **Backend**: Rust (Axum), one binary with the frontend embedded (rust-embed); file watching + Server-Sent Events for live updates
- **Frontend**: Vite + React + TypeScript, Tailwind CSS, shadcn/ui primitives
- **Distribution**: GitHub Release archives (macOS, Linux musl, Windows), `npx openspec-web` launcher (`npm/`), `install.sh`, container image `ghcr.io/toruai/openspec-ui`

## Conventions
- Read-only toward OpenSpec: never write specs or changes. The only writes are idea notes under `openspec/ideas/` and the config file when one is in use.
- Status and artifact chains must match the OpenSpec CLI; `conformance/` records its answers and `cargo test` compares against them.
- No external database or network calls; the filesystem is the source of truth.
- Localhost by default; mobile-friendly; light and dark themes.
- Every PR adds a `CHANGELOG.md` line under `[Unreleased]` and never touches `VERSION`.

## Project Structure
```
openspec-ui/
├── backend/       # Rust server and parser
├── frontend/      # React app (also built as the static live demo)
├── conformance/   # fixtures + recorded OpenSpec CLI answers
├── demo/          # fictional four-repo workspace for dev, demo and screenshots
├── npm/           # npx launcher package
├── skills/        # agent skill (also a Claude Code plugin via .claude-plugin/)
└── openspec/      # this project's own specs
```

## Running
```bash
npm ci && (cd frontend && npm ci && npm run build)   # backend embeds frontend/dist
npm run dev                         # backend on demo/ at :3100, Vite dev server
cd backend && cargo test            # includes the conformance check
openspec-ui ~/code                  # installed binary: board for every repo under ~/code
```
