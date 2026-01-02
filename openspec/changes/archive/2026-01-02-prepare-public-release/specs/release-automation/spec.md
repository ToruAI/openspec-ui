# Spec: Release Automation

## ADDED Requirements

### Requirement: Manual CI Workflows
The system SHALL provide manual triggers for CI builds on all major platforms to verify stability before releases.

#### Scenario: Triggering a macOS build
- Given I am a maintainer on GitHub
- When I navigate to the "Actions" tab
- And I select "CI - macOS" workflow
- And I click "Run workflow"
- Then the workflow runs `cargo test`, `cargo build --release`, and `npm run build` on a macOS runner.

#### Scenario: Triggering a Linux build
- Given I am a maintainer on GitHub
- When I trigger "CI - Linux"
- Then the system builds and tests the project on `ubuntu-latest`.

#### Scenario: Triggering a Windows build
- Given I am a maintainer on GitHub
- When I trigger "CI - Windows"
- Then the system builds and tests the project on `windows-latest`.

### Requirement: Multi-Platform Aggregation
The system MUST provide a centralized workflow to orchestrate builds across all platforms simultaneously.

#### Scenario: Triggering all builds
- Given I want to verify cross-platform compatibility
- When I trigger the "CI - All Platforms" workflow
- Then parallel jobs run for macOS, Linux, and Windows
- And the results are aggregated in a single workflow run view.

### Requirement: Artifact Generation
Builds SHALL produce versioned artifacts for distribution.

#### Scenario: Downloading build artifacts
- Given a successful "CI - All Platforms" run
- When I inspect the "Artifacts" section
- Then I see binaries named:
  - `openspec-ui-v0.1.0-linux-x86_64`
  - `openspec-ui-v0.1.0-macos-aarch64` (or x86_64 depending on runner)
  - `openspec-ui-v0.1.0-windows-x86_64.exe`
