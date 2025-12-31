# Tasks: Add Todo List Display

## 1. Backend: Todo Endpoint
- [ ] 1.1 Add `get_todos` method to `OpenCodeClient` in `opencode.rs`
- [ ] 1.2 Add `GET /api/sessions/:id/todos` route in `handlers.rs`
- [ ] 1.3 Return todo array (empty array if none)
- **Validation**: `curl localhost:8080/api/sessions/{id}/todos` returns JSON

## 2. Frontend: TodoList Component
- [ ] 2.1 Create `TodoList` component with collapsible panel
- [ ] 2.2 Display todo items with status icons (checkbox, spinner, empty)
- [ ] 2.3 Style completed items (strikethrough or muted)
- [ ] 2.4 Style in-progress items (highlighted)
- [ ] 2.5 Add to sidebar below session list
- **Validation**: Todo panel visible in sidebar

## 3. Frontend: Todo State Management
- [ ] 3.1 Add `todos` state to App
- [ ] 3.2 Fetch todos when session changes
- [ ] 3.3 Poll todos every 2s while AI is generating (or use SSE)
- [ ] 3.4 Clear todos when switching sessions
- **Validation**: Todos update during AI work

## 4. SSE Integration (Optional Enhancement)
- [ ] 4.1 Listen for `session.todo.updated` events in SSE stream
- [ ] 4.2 Update todos state from SSE instead of polling
- **Validation**: Real-time updates without polling

## 5. Unit Tests
- [ ] 5.1 Backend: Test todos endpoint returns array
- [ ] 5.2 Backend: Test todos endpoint handles empty list
- [ ] 5.3 Frontend: Test TodoList renders items correctly
- [ ] 5.4 Frontend: Test status icons match todo status
- [ ] 5.5 Frontend: Test collapsible behavior
- **Validation**: `cargo test` and `bun test` pass

## 6. Manual E2E Testing
- [ ] 6.1 Send complex task, verify todos appear
- [ ] 6.2 Watch todos update as AI works
- [ ] 6.3 Collapse/expand panel
- **Validation**: Full todo display flow works

## Order of Execution
1. Backend todo endpoint (task 1)
2. TodoList component (task 2)
3. State management (task 3)
4. SSE integration (task 4) - optional, can skip for MVP
5. Unit tests (task 5)
6. Manual E2E (task 6)

## Notes
- Task 4 (SSE) is optional - polling works fine for MVP
- OpenCode SSE may not have todo events - verify before implementing
