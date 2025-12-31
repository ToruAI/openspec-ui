# Tasks: Add OpenCode Test Environment

## Overview
This change adds a dedicated test environment for running and testing the OpenCode server integration.

## Implementation Tasks

### 1. Create test environment directory structure
- [x] Create `opencode-test/` directory at project root
- [x] Create `opencode-test/test-workspace/` directory for isolated OpenCode workspace
- [x] Add README in `opencode-test/` explaining the purpose and usage
- **Validation**: Directories exist and are properly structured ✅

### 2. Create OpenCode server startup script
- [x] Create `opencode-test/start-server.sh` with proper configuration
  - Set working directory to `test-workspace`
  - Use port 4096 (standard OpenCode port)
  - Use hostname 127.0.0.1 for local testing
  - Include clear output messages for debugging
- [x] Make the script executable (`chmod +x`)
- [x] Test script launches OpenCode server successfully
- **Validation**: Script runs without errors and starts OpenCode server using global config ✅
- **Dependencies**: Assumes OpenCode CLI is installed on the system

### 3. Update .gitignore for test workspace
- [x] Add `opencode-test/test-workspace/**` to `.gitignore`
- [x] Add exception for keeping `opencode-test/test-workspace/.gitkeep`
- [x] Create `.gitkeep` file in test-workspace to maintain directory structure
- **Validation**: Git status shows result correctly ✅

### 4. Update testing documentation
- [x] Update `TESTING.md` with new "OpenCode Test Environment" section
- [x] Add instructions for starting the test server
- [x] Update E2E test prerequisites to reference the new script
- [x] Add troubleshooting section for common OpenCode server issues
- **Validation**: Documentation is clear and complete ✅

### 5. Verify integration with existing tests
- [x] Run existing E2E tests against the test environment
- [x] Verify backend can connect to test server
- [x] Manual Check: Verify server starts on port 4096 and responds to requests
- **Validation**: All existing tests pass with new test environment ✅

## Order of Execution
1. Directory structure (task 1) - foundation
2. Startup script (task 2) - core functionality
3. Gitignore updates (task 3) - prevents pollution
4. Documentation (task 4) - enables usage
5. Integration verification (task 5) - ensures quality

## Parallel Work Opportunities
- Tasks 2 and 3 can be done in parallel after task 1
- Task 4 can be started after task 2 is complete

## Rollback Plan
If issues arise, simply delete the `opencode-test/` directory and revert `.gitignore` changes. No existing functionality is affected.
