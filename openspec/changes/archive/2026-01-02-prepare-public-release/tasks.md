# Tasks

## 1. Project Metadata
- [x] 1.1 Create `LICENSE` file (MIT).
- [x] 1.2 Create root `VERSION` file with content `0.1.0`.
- [x] 1.3 Update `backend/Cargo.toml` with:
    - version: `0.1.0`
    - authors: `["ToruGuy"]`
    - repository: `https://github.com/ToruAI/openspec-ui`
    - license: `MIT`
    - description: "A read-only dashboard for monitoring OpenSpec changes and specifications across multiple repositories."
- [x] 1.4 Update `frontend/package.json` with:
    - version: `0.1.0`
    - author: `ToruGuy`
    - repository: `https://github.com/ToruAI/openspec-ui`
    - license: `MIT`
    - description matches backend.

## 2. Testing Infrastructure
- [x] 2.1 Install `vitest`, `jsdom`, `@testing-library/react` in frontend.
- [x] 2.2 Configure `vite.config.ts` for testing.
- [x] 2.3 Add basic test: `frontend/src/components/KanbanBoard.test.tsx` (smoke test).
- [x] 2.4 Add `test` script to `package.json`.

## 3. Deployment & Security
- [x] 3.1 Create multi-stage `Dockerfile` (Node build -> Rust build -> Runtime).
- [x] 3.2 Update `backend/src/main.rs` to read `CORS_ALLOWED_ORIGINS` env var.
- [x] 3.3 Configure CORS layer to use the env var (defaulting to safe defaults if missing).

## 4. CI/CD Workflows
- [x] 4.1 Create `.github/workflows/ci-macos.yml` (Manual dispatch, Build & Test).
- [x] 4.2 Create `.github/workflows/ci-linux.yml` (Manual dispatch, Build & Test).
- [x] 4.3 Create `.github/workflows/ci-windows.yml` (Manual dispatch, Build & Test).
- [x] 4.4 Create `.github/workflows/ci-all.yml` (Matrix build for all platforms).
- [x] 4.5 Ensure workflows run frontend tests and `cargo test` before building.
- [x] 4.6 Ensure workflows upload build artifacts with correct naming convention: `openspec-ui-v{version}-{platform}-{arch}`.
