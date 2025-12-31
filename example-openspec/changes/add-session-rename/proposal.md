# Change: Add Session Rename

## Why
Users cannot rename chat sessions. Titles are auto-generated or default to "New Chat", making it hard to find conversations later. The OpenCode API provides `PATCH /session/:id` with title support, but Brain Gate doesn't use it.

## What Changes
- Add backend endpoint to proxy `PATCH /session/:id` to OpenCode
- Make session titles editable with click-to-edit in sidebar
- Update local state after successful rename

## Impact
- Affected specs: `chat` (ADDED - rename capability)
- Affected code:
  - `backend/src/handlers.rs` (new patch endpoint)
  - `backend/src/opencode.rs` (update_session method)
  - `src/App.tsx` (editable session title in sidebar)

## OpenCode API Reference
```
PATCH /session/:id
Body: { title?: string }
Response: Session
```
