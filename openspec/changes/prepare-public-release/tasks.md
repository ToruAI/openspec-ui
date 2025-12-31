# Tasks

- [ ] 1. Project Metadata
    - [ ] 1.1 Create `LICENSE` file (MIT).
    - [ ] 1.2 Create root `VERSION` file with content `0.1.0`.
    - [ ] 1.3 Update `backend/Cargo.toml` with:
        - version: `0.1.0`
        - authors: `["ToruGuy"]`
        - repository: `https://github.com/ToruAI/openspec-ui`
        - license: `MIT`
        - description: "A read-only dashboard for monitoring OpenSpec changes and specifications across multiple repositories."
    - [ ] 1.4 Update `frontend/package.json` with:
        - version: `0.1.0`
        - author: `ToruGuy`
        - repository: `https://github.com/ToruAI/openspec-ui`
        - license: `MIT`
        - description matches backend.

- [ ] 2. CI/CD Workflows
    - [ ] 2.1 Create `.github/workflows/ci-macos.yml` (Manual dispatch, Build & Test).
    - [ ] 2.2 Create `.github/workflows/ci-linux.yml` (Manual dispatch, Build & Test).
    - [ ] 2.3 Create `.github/workflows/ci-windows.yml` (Manual dispatch, Build & Test).
    - [ ] 2.4 Create `.github/workflows/ci-all.yml` (Matrix build for all platforms).
    - [ ] 2.5 Ensure workflows upload build artifacts with correct naming convention: `openspec-ui-v{version}-{platform}-{arch}`.





