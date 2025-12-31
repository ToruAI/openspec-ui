# Change: Prepare Public Release

## Summary
Prepare the `openspec-ui` repository for public open-source release by establishing release infrastructure, project metadata, and legal compliance.

## Motivation
The [Production Readiness Report](../../../docs/production-readiness.md) identified several blocking issues for open-sourcing:
- Missing License.
- Missing CI/CD pipelines.
- Missing versioning strategy.
- Incomplete project metadata in `Cargo.toml` and `package.json`.

Addressing these ensures the project is professional, buildable by others, and ready for distribution.

## Proposed Solution
1. **Licensing**: Add MIT License.
2. **Metadata**: Update `package.json` and `Cargo.toml` with `ToruGuy` as author and `https://github.com/ToruAI/openspec-ui` as the repository.
3. **Versioning**: Implement Semantic Versioning (starting at `0.1.0`), using a root `VERSION` file as the source of truth for scripts, while keeping manifest files in sync manually.
4. **CI/CD**: Implement GitHub Actions workflows:
   - Separate manual workflows for macOS, Linux, and Windows.
   - An "All Platforms" workflow that triggers builds across all OSs.
   - Build artifacts named with version, platform, and architecture (e.g., `openspec-ui-v0.1.0-linux-x86_64`).





