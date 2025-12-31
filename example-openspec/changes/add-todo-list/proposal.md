# Change: Add Todo List Display

## Why
Users cannot see the AI's task progress. OpenCode tracks a todo list for each session showing what the AI plans to do and what's completed. This is invisible in Brain Gate, leaving users guessing about progress on multi-step tasks.

## What Changes
- Add backend endpoint to proxy `GET /session/:id/todo` from OpenCode
- Add collapsible "Tasks" panel in sidebar
- Show todo items with status (pending/in_progress/completed)
- Poll or use SSE to update in real-time during AI work

## Impact
- Affected specs: `chat` (ADDED - todo list display)
- Affected code:
  - `backend/src/handlers.rs` (new todo endpoint)
  - `backend/src/opencode.rs` (get_todos method)
  - `src/App.tsx` (TodoList component in sidebar)

## OpenCode API Reference
```
GET /session/:id/todo
Response: Todo[]
```

Todo contains `id`, `content`, `status` (pending/in_progress/completed).
