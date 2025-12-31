# Change: Add Message History Loading

## Why
When switching between chat sessions, the message history is not displayed. Users lose context when switching sessions. OpenCode stores all messages and provides `GET /session/:id/message` to retrieve them, but Brain Gate doesn't fetch or display this history.

## What Changes

### Backend
- Add `get_messages` method to `OpenCodeClient` - calls OpenCode `GET /session/:id/message`
- Update `GET /api/sessions/:id/messages` endpoint to proxy to OpenCode (not SQLite)
- Transform OpenCode `{ info: Message, parts: Part[] }[]` format to assistant-ui format
- Remove SQLite message storage (OpenCode is source of truth)

### Frontend
- Switch from `useChatRuntime` to `useAISDKRuntime` with `useChat` hook
- Fetch history from backend when session changes
- Pass history as `initialMessages` to `useChat`
- Show loading state while fetching history

## OpenCode API
```
GET /session/:id/message?limit=N
Returns: { info: Message, parts: Part[] }[]

Message.info: { id, role, ... }
Message.parts: [{ type: "text"|"tool-invocation"|"tool-result", text?, ... }]
```

## Impact
- Affected specs: `chat` (MODIFIED - add history loading)
- Affected code:
  - `backend/src/opencode.rs` (add get_messages method)
  - `backend/src/handlers.rs` (update get_messages to proxy OpenCode)
  - `src/runtime.tsx` (switch to useAISDKRuntime with initialMessages)
  - `src/App.tsx` (fetch history on session change)
