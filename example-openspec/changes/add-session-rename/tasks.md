# Tasks: Add Session Rename

## 1. Backend: Patch Endpoint
- [ ] 1.1 Add `update_session` method to `OpenCodeClient` in `opencode.rs`
- [ ] 1.2 Add `PATCH /api/sessions/:id` route in `handlers.rs`
- [ ] 1.3 Accept `{ title: string }` body
- [ ] 1.4 Return updated session or 404
- **Validation**: `curl -X PATCH localhost:8080/api/sessions/{id} -d '{"title":"Test"}'` works

## 2. Frontend: Editable Title
- [ ] 2.1 Add `editingSessionId` state to track which session is being renamed
- [ ] 2.2 Double-click handler to enter edit mode
- [ ] 2.3 Render input field when editing
- [ ] 2.4 Auto-select text on edit start
- **Validation**: Double-click makes title editable

## 3. Frontend: Save/Cancel Logic
- [ ] 3.1 Enter key saves and exits edit mode
- [ ] 3.2 Escape key cancels and restores original
- [ ] 3.3 Click outside saves (blur handler)
- [ ] 3.4 Empty title restores original (no save)
- [ ] 3.5 Call PATCH API on save
- [ ] 3.6 Update sessions state with new title
- **Validation**: Rename persists after refresh

## 4. Unit Tests
- [ ] 4.1 Backend: Test patch endpoint updates title
- [ ] 4.2 Backend: Test patch returns 404 for invalid session
- [ ] 4.3 Frontend: Test double-click enters edit mode
- [ ] 4.4 Frontend: Test Enter saves title
- [ ] 4.5 Frontend: Test Escape cancels edit
- [ ] 4.6 Frontend: Test empty title rejected
- **Validation**: `cargo test` and `bun test` pass

## 5. Manual E2E Testing
- [ ] 5.1 Double-click session, rename, verify saved
- [ ] 5.2 Escape during edit, verify original restored
- [ ] 5.3 Refresh page, verify new title persists
- **Validation**: Full rename flow works

## Order of Execution
1. Backend patch endpoint (task 1)
2. Editable title UI (task 2)
3. Save/cancel logic (task 3)
4. Unit tests (task 4)
5. Manual E2E (task 5)
