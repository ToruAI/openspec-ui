# Change: Add OpenCode Test Environment

## Why
Currently, testing Brain Gate's integration with the OpenCode server requires manual setup and assumes the server is running on the developer's machine. This creates several problems:
- Difficult to test in isolation without affecting developer's main OpenCode workspace
- No dedicated test workspace for controlled testing scenarios
- Manual server startup requires remembering the correct configuration
- Testing documentation suggests OpenCode is optional, making it hard to validate the core integration

We need a dedicated testing environment with:
- A simple script to launch OpenCode server in test mode
- An isolated test workspace to avoid polluting the developer's actual workspace
- Clear documentation for running integration tests

## What Changes
- Add `opencode-test/` folder at project root for test environment scripts and workspace
- Add `opencode-test/test-workspace/` directory as the dedicated OpenCode working directory
- Create `opencode-test/start-server.sh` script to launch OpenCode server pointing to test workspace
- Update testing documentation to reference the new test environment
- Add `.gitignore` entries to prevent committing test workspace state

## Impact
- Affected specs: `test-environment` (new capability)
- Affected code:
  - `opencode-test/` (new directory with scripts)
  - `TESTING.md` (updated with new test instructions)
  - `.gitignore` (updated to exclude test workspace artifacts)
- Affected testing: Easier to run E2E tests with real OpenCode server integration
- No breaking changes to existing functionality

## Success Criteria
- Developers can run a single script to start OpenCode server for testing
- OpenCode server uses isolated test workspace but inherits user's global config (auth/providers)
- Server successfully starts on port 4096 and responds to health checks
- E2E tests can connect to the test server
- Test workspace state doesn't pollute git repository
