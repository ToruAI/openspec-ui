# OpenCode Test Environment

This directory contains scripts and configuration for running an isolated OpenCode server for testing Brain Gate.

## Purpose

The test environment provides:
- **Isolated workspace**: OpenCode runs in `test-workspace/` to avoid polluting your main development environment
- **Simple startup**: One script to launch the test server with correct configuration
- **Clean testing**: Test artifacts are gitignored automatically

## Quick Start

```bash
# From the project root
./opencode-test/start-server.sh
```

This will:
1. Start OpenCode server in the `test-workspace/` directory
2. Listen on `http://127.0.0.1:4096`
3. Display startup messages for confirmation

## Directory Structure

```
opencode-test/
├── README.md           # This file
├── start-server.sh     # Server startup script
└── test-workspace/     # Isolated OpenCode workspace (gitignored)
    └── .gitkeep        # Maintains directory in git
```

## Configuration

The test environment automatically inherits your **global OpenCode configuration** (Authentication, Providers). This means:
- You do NOT need to re-login or re-configure API keys.
- The server runs in the isolated `test-workspace/` folder, so file operations are safe.

You can modify behavior by passing flags to the script:
```bash
./opencode-test/start-server.sh --model openai/gpt-4o
```

## Usage

### Starting the Test Server

```bash
./opencode-test/start-server.sh
```

The server will run in the foreground. Press `Ctrl+C` to stop it.

### Running E2E Tests

1. Start the test server (in one terminal):
   ```bash
   ./opencode-test/start-server.sh
   ```

2. Start the Brain Gate backend (in another terminal):
   ```bash
   cd backend
   cargo run
   ```

3. Run the E2E tests (in a third terminal):
   ```bash
   cd backend/tests
   ./e2e_test.sh
   ```

### Passing Arguments to OpenCode

You can pass additional arguments to the `opencode serve` command:

```bash
./opencode-test/start-server.sh --help
./opencode-test/start-server.sh --port 4097
```

## Requirements

- OpenCode CLI must be installed on your system
- See https://opencode.ai/ for installation instructions

## Troubleshooting

### "opencode: command not found"

Install the OpenCode CLI:
```bash
# Follow instructions at https://opencode.ai/
```

### Port already in use

If port 4096 is already in use:
1. Stop any existing OpenCode server
2. Or use a different port: `./start-server.sh --port 4097`

### Clean test workspace

If you need to reset the test workspace:
```bash
rm -rf test-workspace/*
git checkout test-workspace/.gitkeep
```

## Notes

- The test workspace is completely isolated from your main OpenCode workspace
- All files in `test-workspace/` (except `.gitkeep`) are gitignored
- Test sessions and data are stored only in this workspace
- Safe to delete `test-workspace/*` contents at any time
