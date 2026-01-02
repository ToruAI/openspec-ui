# Change: Prepare Public Release

## Summary
Prepare the `openspec-ui` repository for public open-source release by establishing release infrastructure, project metadata, and legal compliance.

## Why
The [Production Readiness Report](../../../docs/production-readiness.md) identified several blocking issues for open-sourcing:
- **Legal**: Missing License.
- **Quality**: No frontend tests, leaving the UI prone to regression.
- **Deployment**: No containerization (Docker) support, limiting deployment options.
- **Security**: CORS is too permissive (`Any`), and there is no rate limiting.
- **Ops**: Missing CI/CD pipelines and versioning strategy.
- **Metadata**: Incomplete project metadata in `Cargo.toml` and `package.json`.

Addressing these ensures the project is professional, buildable by others, secure, and ready for distribution.

## What Changes
1. **Licensing**: Add MIT License.
2. **Metadata**: Update `package.json` and `Cargo.toml` with `ToruGuy` as author and `https://github.com/ToruAI/openspec-ui` as the repository.
3. **Versioning**: Implement Semantic Versioning (starting at `0.1.0`), using a root `VERSION` file as the source of truth for scripts.
4. **Testing Infrastructure**:
   - Install `vitest`, `jsdom`, and `@testing-library/react`.
   - Implement basic rendering tests for critical components (`KanbanBoard`).
5. **Containerization**:
   - Create a multi-stage `Dockerfile` (Node builder -> Rust builder -> Distroless/Debian runtime).
6. **Security Hardening**:
   - Update `main.rs` to allow configurable CORS origins via `CORS_ALLOWED_ORIGINS` env var (default to strict/localhost if unset).
7. **CI/CD**: Implement GitHub Actions workflows:
   - Separate manual workflows for macOS, Linux, and Windows.
   - An "All Platforms" workflow that triggers builds across all OSs.
   - Build artifacts named with version, platform, and architecture (e.g., `openspec-ui-v0.1.0-linux-x86_64`).
