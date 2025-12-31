# Change: Add Chat Interface

## Why
Brain Gate needs a core chat interface to send messages to and receive responses from the OpenCode server. This is the foundational feature that enables all AI interactions.

## What Changes
- Add Vite + React frontend with assistant-ui chat components
- Add Rust backend with HTTP endpoints for chat
- Implement OpenCode server proxy for message relay
- Support real-time streaming responses via SSE
- Store chat history in SQLite

## Impact
- Affected specs: `chat` (new capability)
- Affected code: 
  - `src/` (new frontend)
  - `backend/` (new Rust backend)
  - Database schema (new)
