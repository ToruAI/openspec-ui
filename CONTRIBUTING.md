# Contributing

Bug reports, OpenSpec layouts the board reads wrong, and pull requests are welcome. For anything bigger than a fix, open an issue first so we can agree on the shape.

## Dev loop

Needs Rust (stable) and Node.js 18+.

```sh
npm ci && (cd frontend && npm ci)
npm run dev          # backend on the demo/ workspace at :3100, Vite dev server at :5173
```

`demo/` is a fictional four-repo workspace with changes in every stage; see [demo/README.md](demo/README.md) to change or regenerate it.

## Before you open a pull request

```sh
cd frontend && npm run lint && npm run build && npm test -- --run
cd backend && cargo test && cargo clippy --all-targets -- -D warnings
sh scripts/check-version.sh
```

`cargo test` includes the conformance check (below). If you touch `.github/workflows/`, run `actionlint`.

## Changelog and version

Every pull request with a user-visible change adds a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md): what changed, for the person using the board, not the commit message. Mark breaking changes with **BREAKING**.

Do not change `VERSION` (or the version in `backend/Cargo.toml` or `npm/package.json`). The number is stamped once on `main` when a release is cut, so open pull requests never collide.

## OpenSpec conformance

The parser must read changes exactly as the OpenSpec CLI does. `conformance/generate.mjs` builds small OpenSpec projects with the real CLI and records what `openspec list` and `openspec status` say about them; `cargo test` compares the board's scan with those answers field by field.

```sh
node conformance/generate.mjs                    # regenerate with the latest OpenSpec
node conformance/generate.mjs --version 1.17.0   # or a specific release
cd backend && cargo test conformance
```

The `OpenSpec conformance` workflow does the same with the newest OpenSpec release on every pull request and every Monday. When it fails, a new OpenSpec release changed behaviour the board depends on: regenerate, read the diff of `conformance/fixtures/`, fix the parser, and commit the fixtures with the fix. To cover a new case, add a fixture to `generate.mjs` rather than hand-writing expected output.

## Screenshots and the live demo

- `npm run screenshots` regenerates `docs/images/` from the real app on a copy of `demo/` (uses your installed Chrome and `ffmpeg` for the GIF).
- `cd frontend && npm run snapshot:demo && npm run build:demo` rebuilds the static live demo; the Pages workflow does this on every push to `main`.
