# Tasks: Add Streaming Chat

> **⚠️ SUPERSEDED by `add-direct-sse` (2025-12-27)**
>
> This approach used a backend SSE proxy (`/api/events`) which caused `ERR_INCOMPLETE_CHUNKED_ENCODING`
> errors after idle periods. The `add-direct-sse` proposal connects the frontend directly to OpenCode's
> `/event` endpoint, eliminating the proxy and the chunked encoding issues.

## 1. Backend: SSE Proxy & Async Prompt
- [x] 1.1 Implement `OpenCodeClient::subscribe_events` to connect to OpenCode `GET /event`.
- [x] 1.2 Create `GET /api/events` handler in Actix-web to stream events to frontend.
- [x] 1.3 Update `OpenCodeClient` to support `prompt_async` (`POST /session/:id/prompt_async`).
- [x] 1.4 Update `send_message` handler to use `prompt_async` and return success immediately.
- **Validation**: `curl -N http://localhost:8080/api/events` shows OpenCode events; sending message returns 200 immediately.

## 2. Frontend: Optimistic Updates & SSE
- [x] 2.1 Update `useMyRuntime` `onNew` to append user message to state **immediately** (optimistic).
- [x] 2.2 Implement `EventSource` connection to `/api/events` in `runtime.tsx`.
- [x] 2.3 Handle `message.part.updated` to update partial AI responses in real-time.
- [x] 2.4 Handle `message.updated` to confirm/finalize messages.
- [x] 2.5 Ensure `isRunning` state reflects active generation (start on send, end on completion event).
- **Validation**: Typing a message shows it instantly; AI response streams in character-by-character.

## 3. Integration & Cleanup
- [x] 3.1 Verify tool invocations (if any) are displayed via streaming events.
- [x] 3.2 Remove legacy polling logic from `onNew` (rely on SSE or single refetch if needed).
- [x] 3.3 Ensure session switching reconnects/filters events correctly.
- **Validation**: Full conversation flow is smooth with no "disappearing" messages.

## 4. Code Quality Fixes
- [x] 4.1 Fix stale closure bug in `onNew` callback (use functional update pattern).
- [x] 4.2 Fix race condition - remove fetch inside `setUiMessages` callback.
- [x] 4.3 Remove dead code (`transform_opencode_response_to_ui_message` in handlers.rs).
- [x] 4.4 Fix SSE session filter - OpenCode uses `sessionID` (camelCase), not `session_id`.

## 5. Unit Tests

### 5.1 Frontend: `src/__tests__/runtime.test.tsx`
- [ ] Test `convertAppendMessageToUIMessage` - converts AppendMessage to UIMessage format
- [ ] Test `convertUIMessageToThreadMessage` - maps UIMessage to ThreadMessage with correct status
- [ ] Test SSE `message.part.updated` handler:
  - Creates new assistant message when messageId not found
  - Updates existing text part when message exists
  - Filters events by `session_id`
- [ ] Test SSE `message.updated` handler:
  - Finalizes message with all parts from event data
  - Sets `isRunning` to false
  - Creates message if not found (edge case)
- [ ] Test `onNew` callback:
  - Adds user message optimistically before fetch
  - Sends correct payload to `/api/sessions/:id/messages`
  - Sets `isRunning` to true, then false on error
- [ ] Mock `EventSource` using `vitest` mock class

### 5.2 Backend: `backend/src/opencode.rs` (inline `#[cfg(test)]` module)
- [ ] Test `prompt_async` builds correct URL: `{base_url}/session/{id}/prompt_async`
- [ ] Test `prompt_async` sends correct JSON body: `{ parts: [{ type: "text", text: "..." }] }`
- [ ] Test `subscribe_events` builds correct URL: `{base_url}/event`
- [ ] Test `subscribe_events` sets `Accept: text/event-stream` header

### 5.3 Backend: `backend/src/handlers.rs` (inline `#[cfg(test)]` module)
- [ ] Test `transform_opencode_messages_to_ui` transforms array correctly
- [ ] Test `transform_opencode_messages_to_ui` handles empty/malformed input
- [ ] Test `transform_opencode_sessions_to_ui` transforms session array

**Validation**: `npm test` passes all frontend tests; `cargo test` passes all backend tests.

