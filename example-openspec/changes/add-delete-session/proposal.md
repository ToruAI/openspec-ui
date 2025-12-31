# Change: Add Delete Session Capability

## Why
Users cannot delete chat sessions. Once a session is created, it remains in the sidebar forever. The OpenCode SDK provides `session.delete()` but Brain Gate doesn't use it. Users need to clean up old or unwanted conversations.

## What Changes
- Add `DELETE /api/sessions/:id` endpoint to Rust backend
- Backend proxies delete to OpenCode `DELETE /session/:id`
- Add delete button to session items in sidebar
- Add confirmation dialog before deletion
- Remove deleted session from UI state

## Impact
- Affected specs: `chat` (MODIFIED - add delete capability)
- Affected code:
  - `backend/src/handlers.rs` (new delete endpoint)
  - `backend/src/opencode.rs` (delete session client method)
  - `src/App.tsx` (delete button, confirmation, state update)
