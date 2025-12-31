# Change: Add Environment-Based Configuration

## Why
The OpenCode server URL is currently hardcoded to `localhost:4096` in the backend and `localhost:8080` in the frontend. Brain Gate is designed to connect to a remote VPS running OpenCode, but there's no way to configure the server URL for production deployment.

## What Changes
- Add environment variable support for OpenCode server URL in Rust backend
- Add environment variable support for backend API URL in frontend
- Provide sensible defaults for local development
- Document configuration options

## Impact
- Affected specs: `configuration` (new capability)
- Affected code:
  - `backend/src/main.rs` (read env vars)
  - `backend/src/lib.rs` (AppState initialization)
  - `src/App.tsx` (API base URL)
  - `src/runtime.tsx` (API base URL)
  - `.env.example` (new file documenting vars)
