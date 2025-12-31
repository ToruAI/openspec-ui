# Change: Add Abort Session

## Why
Users cannot stop a running AI response. When OpenCode takes too long or goes in the wrong direction, users must wait for completion. The OpenCode API provides `POST /session/:id/abort` but Brain Gate doesn't use it.

## What Changes
- Add backend endpoint to proxy `POST /session/:id/abort` to OpenCode
- Transform send button to stop button while AI is generating
- Call abort endpoint when stop button clicked
- Handle abort state in UI (stop streaming, show aborted status)

## Impact
- Affected specs: `chat` (ADDED - abort capability)
- Affected code:
  - `backend/src/handlers.rs` (new abort endpoint)
  - `backend/src/opencode.rs` (abort_session method)
  - `src/components/assistant-ui/thread.tsx` or composer (stop button)
  - `src/runtime.tsx` (abort handling)

## OpenCode API Reference
```
POST /session/:id/abort
Response: boolean
```
