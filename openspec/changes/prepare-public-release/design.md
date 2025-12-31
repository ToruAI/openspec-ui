# Design: Release Infrastructure

## CI/CD Strategy

### Workflow Structure
We will implement a "Manual First" approach for this initial release phase to maintain control over resource usage.

1.  **Platform-Specific Workflows**:
    - `ci-macos.yml`: Runs on `macos-latest`.
    - `ci-linux.yml`: Runs on `ubuntu-latest`.
    - `ci-windows.yml`: Runs on `windows-latest`.
    - Each workflow performs:
        - Backend: `cargo check`, `test`, `clippy`, `build --release`.
        - Frontend: `npm install`, `lint`, `build`.

2.  **Aggregator Workflow**:
    - `ci-all.yml`: A single entry point that orchestrates the execution of builds on all supported platforms (using a matrix strategy within a single job or separate jobs).
    - **Trigger**: `workflow_dispatch` (Manual) for all workflows.

### Artifact Naming
Build artifacts will follow a strict naming convention for consistency:
`openspec-ui-v{VERSION}-{PLATFORM}-{ARCH}`

Examples:
- `openspec-ui-v0.1.0-linux-x86_64`
- `openspec-ui-v0.1.0-macos-aarch64`
- `openspec-ui-v0.1.0-windows-x86_64.exe`

## Versioning Strategy

### Single Source of Truth
While `Cargo.toml` and `package.json` require their own version fields for their respective ecosystems, we will establish a root `VERSION` file containing the plain semantic version string (e.g., `0.1.0`).

- **Purpose**: Simplify build scripts and CI pipelines when determining the release version for artifact naming.
- **Process**: Human updates `VERSION`, `Cargo.toml`, and `package.json` atomically in a "bump version" commit.

### Metadata Synchronization
Project metadata (Author: `ToruGuy`, Repo: `ToruAI/openspec-ui`) will be synchronized across:
- `backend/Cargo.toml`
- `frontend/package.json`





