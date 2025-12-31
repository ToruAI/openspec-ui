# Change: Add Streaming Chat with SSE

## Why
Users currently experience a "disappearing message" effect where the UI clears while waiting for the full AI response. This provides poor feedback. Additionally, the system waits for the complete response before showing anything, making the application feel slow. OpenCode supports Server-Sent Events (SSE) and asynchronous prompting, which allows for a real-time, streaming experience.

## What Changes

### Backend
- **NEW**: Add `GET /api/events` endpoint to proxy OpenCode SSE events (`GET /event`).
- **UPDATE**: Change message sending to use OpenCode's `POST /session/:id/prompt_async` (returns immediately).
- **UPDATE**: Ensure `get_messages` returns the latest state (fallback/initial load).

### Frontend
- **UPDATE**: `useMyRuntime` to support optimistic updates (show user message immediately).
- **NEW**: Implement SSE listener to subscribe to `/api/events`.
- **UPDATE**: Handle `message.part.updated` events to stream AI text and tool usage in real-time.
- **UPDATE**: Handle `message.updated` for final message states.

## Impact
- **Specs**: `chat` (streaming requirements), `backend` (SSE proxy).
- **Code**: `src/runtime.tsx`, `backend/src/handlers.rs`, `backend/src/opencode.rs`.
- **Docs**: Relies on OpenCode `server.md` (SSE events) and `sdk.md`.

## Technical Details
- **OpenCode SSE**: `GET /event` emits `message.part.updated` and `message.updated`.
- **OpenCode Async**: `POST /session/:id/prompt_async` returns `204 No Content`.
- **Proxying**: Backend keeps a persistent connection to OpenCode `/event` and broadcasts relevant events to frontend clients.

## Implementation Notes (Post-Review)

### Code Quality Fixes Applied
1. **Stale closure bug** in `onNew` - fixed using functional update pattern to capture message snapshot
2. **Race condition** - removed async fetch inside `setUiMessages` callback; now creates message from event data directly
3. **Dead code** - removed unused `transform_opencode_response_to_ui_message` function
4. **SSE session filter bug** - fixed `session_id` → `sessionID` (OpenCode uses camelCase)

### Known Limitations (Future Work)
- **No SSE connection pooling**: Each frontend client creates new connection to OpenCode `/event`
- **No event filtering at backend**: All events forwarded to all clients (filtering done in frontend by `sessionID`)
- **Tool parts not rendered**: Only `text` parts handled; tool invocations need separate UI work

