# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com); scheme: [SemVer](https://semver.org).

The version number lives in `VERSION` and is stamped on `main` at merge — pull requests add entries under `[Unreleased]` and leave the number alone.

## [Unreleased]

## [0.3.0] - 2026-11-11

A relaunch: start it with one command in any folder, a board that uses OpenSpec's own stages, and a parser checked against the real OpenSpec CLI on every pull request and every week.

### Added
- **Zero-config start.** `openspec-ui` in a folder shows every repo with an `openspec/` directory in it (three levels deep, `--depth N` for more); `openspec-ui ~/code` or `openspec-ui ./api ./web` picks the folders. No config file needed, and none is ever created. It takes port 3000 or the next free one, and opens the browser when started from an interactive terminal.
- **One-command installs.** `npx openspec-ui` (a small launcher that downloads the release binary and checks its SHA-256), `curl -fsSL https://github.com/ToruAI/openspec-ui/releases/latest/download/install.sh | sh`, and a multi-arch image `ghcr.io/toruai/openspec-ui`. Every release now also ships a Linux arm64 build and a `SHA256SUMS` file.
- **Checked against OpenSpec 1.17, every week.** Change status, the artifact chain and task counts are compared field by field with what `openspec list` and `openspec status` answer for ten fixture projects (1028 checks, part of `cargo test`). A scheduled workflow regenerates the fixtures with the newest OpenSpec release every Monday and on every pull request, so a format change in OpenSpec shows up as a failing check here.
- **Workflow schemas.** The artifact chain comes from the change's schema (`.openspec.yaml`, then `openspec/config.yaml`, then `spec-driven`), so custom schemas, `skip_specs: true` (shown as skipped) and glob outputs work. A change OpenSpec cannot read shows the reason instead of a guessed chain. A repo whose planning lives in an OpenSpec store is reported as such (beta; the store is not followed).
- **A board that answers "what next".** Planning cards show the chain with the next artifact and what the rest waits for ("Tasks waits for design"); repo tiles count active changes per stage and filter the board; an optional By repo layout; cards lead with a one-line summary of the change.
- **Change detail with a tab per artifact,** in chain order, including unwritten ones (with what they wait for), and the tasks file as a checklist.
- **Phone.** `--host 0.0.0.0` makes the board reachable on your network; an "Open on your phone" button shows the address (or the command to run). The phone layout has stage tabs with counts and swipes between them.
- **For scripts and coding agents.** A stable first output line, or one JSON line with `--json`; a second start for the same folders reuses the running server instead of starting another; `GET /api/info` returns the same JSON, including `lanUrl`. An agent skill (`npx skills add ToruAI/openspec-ui`) and a Claude Code plugin (`/plugin marketplace add ToruAI/openspec-ui`) start the board and answer status questions from its API.
- **Live demo** of the real UI on a fictional four-repo workspace (`demo/`), published to GitHub Pages; `npm run dev` runs against the same workspace on a fresh clone.
- Version badge in the header, linked to this changelog; `--version`.

### Changed
- **BREAKING: listens on 127.0.0.1 by default** (0.2.0 listened on every interface). Use `--host 0.0.0.0` or `OPENSPEC_UI_HOST` to reach it from other devices. On localhost, requests with a foreign `Host` header are refused (DNS rebinding), and cross-origin writes are refused everywhere; CORS allows only the server's own origin unless `CORS_ALLOWED_ORIGINS` is set.
- **BREAKING (API): `artifacts[].state` (`complete` | `ready` | `blocked`) is now `artifacts[].status` (`done` | `skipped` | `ready` | `blocked`)**, the values `openspec status --json` uses, with `outputPath` and `requires` per artifact. Each change also carries `schema`, `isPlanningComplete`, `applyRequires`, `summary`, `title`, `error` and `warnings`; the detail adds `documents[]`.
- **Board stages use OpenSpec's terms:** Planning (no tasks yet), Ready to apply (tasks written, none checked), In progress, Complete (every task checked, ready to archive), Archived. The API's `status` values (`draft`, `todo`, `in_progress`, `done`, `archived`) are unchanged.
- **Changes without tasks are on the board.** 0.2.0 dropped them from every column, so changes still being planned were invisible; every folder under `changes/` now counts as a change, as it does for OpenSpec.
- **Task counting follows OpenSpec's checkbox rules** (`*`, `+` and numbered items, indented items), and `specs` counts as written only once a spec `.md` file exists.
- **BREAKING (Docker):** the image searches repos mounted under `/repos` (`docker run -p 127.0.0.1:3000:3000 -v ~/code:/repos ghcr.io/toruai/openspec-ui`) instead of reading a config baked in at build time. A config can be mounted as `/repos/openspec-ui.json` or named by `OPENSPEC_UI_CONFIG`. It runs on Alpine as uid 10001 (was 1000), so mounted folders must be readable by that user.
- **Linux release binaries are static musl builds,** so the same file runs on Alpine and on any glibc distribution.
- Settings edits are saved to the config file when one is in use; for discovered folders they last until the server stops, and the dialog says so.
- No Google Fonts request: a local tool should not call out.

### Fixed
- 0.2.0 said its artifact vocabulary and dependency graph matched `openspec status`. They did not: the CLI says `done` where we said `complete`, orders the chain proposal, specs, design, tasks, and has a `skipped` state. The conformance checks above exist so that claim is now tested rather than asserted.
- Live updates no longer blink the board, and an open change detail follows them.

### Security
- **Any file on the machine could be read through the spec API** (0.1.0 and 0.2.0, which also listened on every network interface by default, so anyone on the same network could do it). A spec name with `..` or an absolute path (`GET /api/specs/<repo>%2F%2Fetc%2Fpasswd`) returned that file. Spec names are now checked, and the file must resolve to a `.md` inside the repo's `openspec/specs/` folder or directly in `openspec/`.
- **Deleting or editing an idea could delete or overwrite a `.md` file elsewhere on disk** (0.1.0 and 0.2.0). The idea id went into the file path unchecked, through the API and through the UI itself: a cloned repo with an idea whose frontmatter said `id: ../../../x` made the Delete button remove `x.md` outside the repo. An idea's id is now its file name (letters, digits, `-`, `_`, `.`; no leading dot), checked on every create, edit and delete; symlinked idea files and an `ideas/` folder pointing out of the repo are refused.
- **Symlinks in a repo could show files from outside it** (0.1.0 and 0.2.0 for `proposal.md` and the other fixed files; a symlink to `/` also made every board refresh walk the whole disk before this release). A linked `schema.yaml` or `.openspec.yaml` could also put a line of an outside file into a change's error message. A file or folder that resolves outside the source's `openspec/` directory now counts as absent, for the board and for the change detail alike. Symlinks that stay inside it, and a source path that is itself a symlink, work as before.
- **Any website could use a board reachable on the network** (`--host 0.0.0.0`, and every Docker container, which listens that way; in 0.1.0 and 0.2.0 every start). Through DNS rebinding a page the user visited could read the repos through the API, create, edit and delete ideas, and point the server at other folders. The server now answers only to localhost, IP addresses and names given with the new **`--allowed-host NAME`** (or `OPENSPEC_UI_ALLOWED_HOSTS=a,b`), for this computer's name (`my-pc.local`), reverse proxies and Docker hosts; anything else gets a 403 that names the flag. Opening the board by IP address, as the phone button shows it, needs nothing. Changes must come from a page of the board itself.
- **The source list can be changed only from a browser on the computer openspec-ui runs on.** Other devices (a phone), and every browser when it runs in a container, see Settings read-only, with a note; `PUT /api/config/sources` answers 403 to them. In Docker, change the mounted folders instead.
- **Reusing a running server no longer prints or opens a URL chosen by whatever holds the port** (new in this release, never shipped). The address comes from the port we checked, and on Windows the browser is opened without going through `cmd`, so characters such as `&` in a URL cannot run commands.

## [0.2.0] - 2026-07-27

### Fixed
- **Changes created by OpenSpec 1.0+ were invisible on the board.** A directory was only treated as a change if it contained `proposal.md`, but current OpenSpec writes `.openspec.yaml` when the change is created and the proposal only once an agent drafts it. Every freshly created change was therefore missing from the dashboard until someone wrote a proposal — the exact moment you most want to see it. Either marker now identifies a change.

### Added
- **Artifact chain per change.** Each change reports `proposal`, `design`, `specs` and `tasks` as `complete`, `ready` (dependencies met, not written yet) or `blocked`, with the artifacts it is waiting for. Vocabulary and dependency graph match `openspec status --change <name>`, verified against OpenSpec 1.6, but are computed from the files on disk — so no OpenSpec install is needed in the repos being watched. Exposed on `/api/changes` and `/api/changes/{id}`, and rendered on each card with the next actionable artifact marked.
- CI on every push and pull request: frontend build, `cargo test`, `cargo clippy -D warnings`. Nothing verified commits before this.
- `release.yml` builds and publishes release archives from a `v*` tag for four targets (adds macOS Intel), replacing manual assembly from workflow artifacts.
- `CHANGELOG.md`, following the ToruAI versioning standard.

### Changed
- Cards show the whole workflow chain instead of badges for artifacts that happen to exist, so a glance answers "what is next here" rather than only "what has been written".
- Consolidated four dispatch-only workflows (`ci-all`, `ci-linux`, `ci-macos`, `ci-windows`) into `ci.yml` + `release.yml`. They built the same binaries but only uploaded them as build artifacts, so publishing a release meant downloading and re-uploading by hand. `release.yml` keeps a `workflow_dispatch` entry point for builds without a tag.
- README leads with what the dashboard answers and states OpenSpec version compatibility; download table no longer hard-codes `v0.1.0`.

### Removed
- `readyForReview` from the `Change` type: declared in the frontend contract, never sent by the backend, never read by any component.

## [0.1.0] - 2026-01-07

### Added
- Multi-repo kanban dashboard for OpenSpec changes, with ideas capture, specs browser, detail view and SSE live refresh.
- Single-binary distribution (embedded frontend) for macOS, Linux and Windows; Docker image.
