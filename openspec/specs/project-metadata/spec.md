# project-metadata Specification

## Purpose
TBD - created by archiving change prepare-public-release. Update Purpose after archive.
## Requirements
### Requirement: Project Identity
The project manifest files MUST contain correct open-source metadata.

#### Scenario: Checking Cargo metadata
- Given I inspect `backend/Cargo.toml`
- Then `authors` contains "ToruGuy"
- And `repository` is "https://github.com/ToruAI/openspec-ui"
- And `license` is "MIT".

#### Scenario: Checking NPM metadata
- Given I inspect `frontend/package.json`
- Then `author` is "ToruGuy"
- And `repository` is "https://github.com/ToruAI/openspec-ui"
- And `license` is "MIT".

### Requirement: Versioning
The project SHALL follow Semantic Versioning with a clear source of truth.

#### Scenario: Determining project version
- Given I am in the project root
- When I read the `VERSION` file
- Then I see the current Semantic Version (e.g., `0.1.0`)
- And this version matches `backend/Cargo.toml` and `frontend/package.json`.

