# Tasks: Add Delete Session Capability

## 1. Backend Implementation
- [ ] 1.1 Add `delete_session` method to `OpenCodeClient` in `opencode.rs`
- [ ] 1.2 Add `DELETE /sessions/:id` route in `handlers.rs`
- [ ] 1.3 Delete from local SQLite after successful OpenCode delete
- [ ] 1.4 Return appropriate status codes (200 success, 404 not found)
- **Validation**: `curl -X DELETE localhost:8080/api/sessions/{id}` works

## 2. Frontend Implementation
- [ ] 2.1 Add trash icon button to session items in sidebar
- [ ] 2.2 Add confirmation dialog (shadcn AlertDialog)
- [ ] 2.3 Implement delete API call
- [ ] 2.4 Remove session from state after successful delete
- [ ] 2.5 If deleted session was active, switch to another or show empty state
- **Validation**: Can delete sessions via UI with confirmation

## 3. Unit Tests
- [ ] 3.1 Backend: Test delete endpoint returns 200 for existing session
- [ ] 3.2 Backend: Test delete endpoint returns 404 for non-existent session
- [ ] 3.3 Backend: Test delete_session method removes from SQLite
- [ ] 3.4 Backend: Test delete cascades correctly (session + messages)
- [ ] 3.5 Frontend: Test delete button click triggers confirmation dialog
- [ ] 3.6 Frontend: Test confirmed delete calls API and updates state
- [ ] 3.7 Frontend: Test active session deletion switches to another session
- **Validation**: `cargo test` and `npm test` pass with delete tests

## 4. Manual E2E Testing
- [ ] 4.1 Create session, delete it, verify gone from sidebar
- [ ] 4.2 Delete active session, verify switch to another
- **Validation**: Delete flow works end-to-end

## Order of Execution
1. Backend (task 1) - must complete first
2. Frontend (task 2) - depends on backend
3. Unit tests (task 3) - after implementation
4. Manual E2E (task 4) - final verification
