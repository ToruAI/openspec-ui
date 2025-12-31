# Spec: Test Environment

## ADDED Requirements

### Requirement: Isolated Test Workspace
The system SHALL provide an isolated workspace directory where the OpenCode server can operate during testing without interfering with the developer's main workspace.

#### Scenario: Test workspace exists and is isolated
**Given** the Brain Gate project is cloned  
**When** a developer navigates to the project root  
**Then** an `opencode-test/test-workspace/` directory should exist  
**And** the directory should be gitignored except for a `.gitkeep` file  
**And** the directory should be separate from any user's main OpenCode workspace

#### Scenario: Test workspace maintains structure in git
**Given** a fresh clone of the repository  
**When** checking the directory structure  
**Then** the `opencode-test/test-workspace/` directory should exist  
**But** it should be empty except for `.gitkeep`  
**And** no test artifacts or OpenCode state files should be committed

### Requirement: Simple Server Startup Script
The system SHALL provide a simple script to launch the OpenCode server configured for testing.

#### Scenario: Start OpenCode server for testing
**Given** OpenCode CLI is installed on the system  
**And** the developer is in the project root directory  
**When** the developer runs `./opencode-test/start-server.sh`  
**Then** the OpenCode server should start  
**And** the server should use `opencode-test/test-workspace/` as its working directory  
**And** the server should listen on `http://127.0.0.1:4096`  
**And** the script should display clear startup messages

#### Scenario: Script is executable
**Given** the repository is cloned  
**When** checking file permissions on `start-server.sh`  
**Then** the script should have executable permissions  
**And** the developer should not need to run `chmod +x` manually

#### Scenario: Script accepts additional arguments
**Given** the OpenCode server startup script  
**When** the developer runs `./opencode-test/start-server.sh --help`  
**Then** the arguments should be passed through to the `opencode serve` command  
**And** the OpenCode CLI help should be displayed

#### Scenario: Use global configuration
**Given** the developer has a global OpenCode configuration (auth keys, providers)  
**When** they run the test server  
**Then** the server should detect and use the global configuration  
**And** the developer should not be required to re-authenticate for testing

### Requirement: Test Environment Documentation
The system SHALL provide clear documentation on how to use the test environment for integration testing.

#### Scenario: Developer wants to run E2E tests
**Given** a developer is reading `TESTING.md`  
**When** they look for OpenCode server setup instructions  
**Then** they should find a section on "OpenCode Test Environment"  
**And** the section should explain how to start the test server  
**And** the section should explain the purpose of the test workspace  
**And** the section should include troubleshooting tips

#### Scenario: Understanding test environment structure
**Given** a developer opens `opencode-test/README.md`  
**When** reading the file  
**Then** they should understand what the directory contains  
**And** they should know how to start the test server  
**And** they should know that the test workspace is isolated

### Requirement: Prevent Test Artifact Pollution
The system SHALL prevent test workspace artifacts from being committed to the git repository.

#### Scenario: Test workspace artifacts are ignored
**Given** the OpenCode server has been running in the test workspace  
**And** OpenCode has created state files (sessions, config, etc.)  
**When** running `git status`  
**Then** the test workspace artifacts should not appear as untracked files  
**But** the `opencode-test/test-workspace/.gitkeep` file should be tracked  
**And** changes to `.gitignore` should be tracked

#### Scenario: Fresh developer onboarding
**Given** a new developer clones the repository  
**When** they run the test server for the first time  
**Then** OpenCode should create necessary files in test workspace  
**And** those files should automatically be gitignored  
**And** the developer should not need to manually configure gitignore

### Requirement: Integration with Existing Tests
The test environment SHALL integrate seamlessly with existing E2E tests without breaking current functionality.

#### Scenario: E2E tests connect to test server
**Given** the test OpenCode server is running via `start-server.sh`  
**And** the Brain Gate backend is running  
**When** running `./backend/tests/e2e_test.sh`  
**Then** the tests should connect to the OpenCode server  
**And** all integration tests should pass  
**And** test data should be created in the test workspace

#### Scenario: Helpful error when server not running
**Given** the OpenCode server is not running  
**When** running E2E tests  
**Then** the test output should suggest starting the server  
**And** the output should reference `./opencode-test/start-server.sh`
