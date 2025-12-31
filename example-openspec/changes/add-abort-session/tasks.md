# Tasks: Add Abort Session

## 1. Backend: Abort Endpoint
- [ ] 1.1 Add `abort_session` method to `OpenCodeClient` in `opencode.rs`
- [ ] 1.2 Add `POST /api/sessions/:id/abort` route in `handlers.rs`
- [ ] 1.3 Return success even if session not running (no-op)
- **Validation**: `curl -X POST localhost:8080/api/sessions/{id}/abort` returns success

## 2. Frontend: Stop Button UI
- [ ] 2.1 Track `isGenerating` state (from SSE events)
- [ ] 2.2 Replace send button with stop button when generating
- [ ] 2.3 Use square icon for stop (consistent with chat UIs)
- [ ] 2.4 Style stop button distinctly (e.g., red tint)
- **Validation**: Button transforms during AI response

## 3. Frontend: Abort Integration
- [ ] 3.1 Add abort API call function
- [ ] 3.2 Wire stop button click to abort call
- [ ] 3.3 Update isGenerating state after abort
- [ ] 3.4 Keep partial response visible after abort
- **Validation**: Clicking stop halts generation

## 4. Unit Tests
- [ ] 4.1 Backend: Test abort endpoint returns success
- [ ] 4.2 Backend: Test abort handles non-existent session
- [ ] 4.3 Frontend: Test button transforms to stop when generating
- [ ] 4.4 Frontend: Test abort call made on stop click
- **Validation**: `cargo test` and `bun test` pass

## 5. Manual E2E Testing
- [ ] 5.1 Send message, verify stop button appears
- [ ] 5.2 Click stop, verify generation halts
- [ ] 5.3 Verify partial response remains visible
- **Validation**: Full abort flow works

## Order of Execution
1. Backend abort endpoint (task 1)
2. Stop button UI (task 2)
3. Abort integration (task 3)
4. Unit tests (task 4)
5. Manual E2E (task 5)
