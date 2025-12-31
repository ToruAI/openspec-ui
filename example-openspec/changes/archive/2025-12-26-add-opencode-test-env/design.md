# Design: OpenCode Test Environment

## Problem Statement
Testing Brain Gate's integration with the OpenCode server is currently cumbersome:
1. Developers must manually start OpenCode server with correct configuration
2. No isolation between test workspace and developer's actual workspace
3. Test artifacts may pollute git repository
4. Documentation treats OpenCode as optional, making integration testing unclear

## Goals
- **G1**: Provide one-command startup for OpenCode test server
- **G2**: Isolate test workspace from developer's main workspace
- **G3**: Prevent test artifacts from being committed to repository
- **G4**: Make E2E testing with real OpenCode server straightforward

## Non-Goals
- Creating a mock OpenCode server (we test against the real implementation)
- Automatically installing OpenCode CLI (developers must install separately)
- Running OpenCode server in Docker/containers (keep it simple)
- Managing multiple test workspaces or configurations

## Proposed Solution

### Architecture

```
brain-gate2/
├── opencode-test/              # New: Test environment root
│   ├── README.md              # Usage instructions
│   ├── start-server.sh        # Script to launch OpenCode server
│   └── test-workspace/        # Isolated workspace for OpenCode
│       ├── .gitkeep           # Keeps directory in git
│       └── [runtime files]    # Generated during tests (gitignored)
├── backend/
│   └── tests/
│       └── e2e_test.sh        # Updated to reference test server
└── TESTING.md                 # Updated with test environment docs
```

### Component Details

#### 1. start-server.sh Script
**Purpose**: Launch OpenCode server configured for testing

**Key Features**:
- Changes directory to `test-workspace` before starting server
- Uses standard OpenCode port (4096) and localhost binding
- Uses user's global configuration (auth, providers) for seamless testing
- Displays clear startup messages
- Passes through any additional CLI arguments

**Example**:
```bash
#!/bin/bash
TEST_WORKSPACE="$(dirname "$0")/test-workspace"
cd "$TEST_WORKSPACE"

echo "Starting OpenCode server in test workspace..."
echo "Working directory: $(pwd)"
echo "Using global OpenCode configuration (auth/providers)"
echo "Server will be available at http://127.0.0.1:4096"

opencode serve --port 4096 --hostname 127.0.0.1 "$@"
```

#### 2. test-workspace/ Directory
**Purpose**: Isolated directory for OpenCode server to operate in

**Characteristics**:
- Contains `.gitkeep` to preserve directory structure in git
- All other contents are gitignored
- OpenCode will create its own session files here
- Inherits user's global settings (providers, keys) but keeps file operations contained locally

#### 3. .gitignore Updates
**Purpose**: Prevent test artifacts from being committed

**Additions**:
```gitignore
# OpenCode test workspace artifacts
opencode-test/test-workspace/*
!opencode-test/test-workspace/.gitkeep
```

### Integration with Existing System

#### Backend Tests
The backend's `e2e_test.sh` will be updated to:
1. Check if OpenCode server is running at `http://localhost:4096`
2. Suggest using `opencode-test/start-server.sh` if not running
3. Continue with existing test logic

#### Development Workflow
1. Developer wants to run E2E tests
2. Opens terminal, runs `./opencode-test/start-server.sh`
3. Opens another terminal, runs `cd backend && cargo run`
4. Opens third terminal, runs `npm run dev`
5. Runs E2E tests: `cd backend/tests && ./e2e_test.sh`

### Trade-offs and Alternatives

#### Alternative 1: Docker Container
**Pros**: Complete isolation, no local OpenCode installation needed
**Cons**: Added complexity, slower startup, requires Docker
**Decision**: Rejected - keep it simple with local installation

#### Alternative 2: Mock OpenCode Server
**Pros**: Faster tests, no external dependencies
**Cons**: Doesn't test real integration, maintenance burden
**Decision**: Rejected - we want to test against real OpenCode

#### Alternative 3: Use Main Workspace
**Pros**: No additional setup needed
**Cons**: Pollutes developer's workspace, no isolation
**Decision**: Rejected - isolation is a key goal

### Edge Cases and Error Handling

1. **OpenCode not installed**: Script will fail with clear error message
2. **Port already in use**: OpenCode will report error, developer must free port
3. **Test workspace corrupted**: Simply delete and recreate the directory
4. **Multiple developers**: Each has their own local test workspace

### Future Enhancements (Out of Scope)
- Automated OpenCode installation check
- Multiple test workspace configurations
- Test data seeding scripts
- Integration with CI/CD pipelines
