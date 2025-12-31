# Tasks: Direct SSE Connection to OpenCode

## Phase 1: Configuration

- [x] Add `VITE_OPENCODE_URL` to `.env.example` with default `http://localhost:4096`
- [x] Add `getOpencodeUrl()` function to `src/lib/config.ts`
- [x] Add test for `getOpencodeUrl()` in `src/lib/__tests__/config.test.ts`

## Phase 2: Frontend SSE Update

- [x] Update `src/runtime.tsx` to import `getOpencodeUrl`
- [x] Change SSE EventSource URL from `${API_URL}/api/events` to `${OPENCODE_URL}/event`
- [x] Verify `message.part.updated` events still processed correctly
- [x] Verify `message.updated` events still processed correctly

## Phase 3: Backend Cleanup

- [x] Remove `get_events` handler from `backend/src/handlers.rs`
- [x] Remove `/events` route registration from handlers config
- [x] Remove `subscribe_events` function from `backend/src/opencode.rs`
- [x] Remove unused imports (futures_util, Bytes, Duration no longer needed in handlers)
- [x] Run `cargo check` to verify no compilation errors

## Phase 4: Verification

- [x] Start OpenCode server, backend, and frontend
- [x] Send a message and verify streaming works end-to-end
- [x] Wait 30+ seconds idle and verify no `ERR_INCOMPLETE_CHUNKED_ENCODING`
- [x] Test page refresh reconnects SSE correctly

## Phase 5: SSE Handler Testing (Production Hardening)

- [x] Extract SSE event handlers into `src/lib/sse-handlers.ts` (pure functions, testable)
- [x] Write tests for session ID filtering (accept matching, reject non-matching)
- [x] Write tests for `message.part.updated` handling (text append, missing message)
- [x] Write tests for `message.updated` handling (create new, update existing, skip user messages)
- [x] Write tests for `session.idle` and `session.status` handling
- [x] Write tests for malformed/unknown events (graceful handling)
- [x] Update `runtime.tsx` to use extracted handlers
- [x] Run tests: `npm test` (43 SSE handler tests passing)

## Phase 6: Cleanup

- [x] Archive `add-streaming-chat` with note that it's superseded by `add-direct-sse`
- [x] Minimize `config.test.ts` (low-value tests) → deleted entirely
