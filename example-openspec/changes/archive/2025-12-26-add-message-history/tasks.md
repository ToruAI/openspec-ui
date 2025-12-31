# Tasks: Fix Message History and Runtime Protocol

## 1. Backend: Simplify Message Response
- [x] 1.1 Update `send_message` handler to return JSON instead of stream protocol
- [x] 1.2 Return the assistant message in UIMessage format after OpenCode responds
- [x] 1.3 Remove `transform_opencode_to_ai_sdk` function (no longer needed)
- [x] 1.4 Keep `get_messages` endpoint unchanged (already correct)
- **Validation**: `POST /api/sessions/:id/messages` returns `{ id, role, parts }` JSON

## 2. Frontend: Switch to ExternalStoreRuntime
- [x] 2.1 Install `@assistant-ui/react` if not present (for useExternalStoreRuntime)
- [x] 2.2 Create new runtime hook using `useExternalStoreRuntime`
- [x] 2.3 Implement `onNew` callback: POST message, wait for response, refetch history
- [x] 2.4 Implement `setMessages` to allow runtime to update state
- [x] 2.5 Track `isRunning` state during message send cycle
- [x] 2.6 Update Chat.tsx to use new runtime with managed message state
- **Validation**: Sending a message shows loading, then displays response

## 3. Integration Testing
- [x] 3.1 Test: Send message → response appears in chat
- [x] 3.2 Test: Refresh page → history loads correctly
- [x] 3.3 Test: Switch sessions → correct history shows
- [x] 3.4 Test: New session → empty state, can send messages
- **Validation**: Full chat flow works end-to-end

## 4. Cleanup
- [x] 4.1 Remove unused AI SDK streaming imports
- [x] 4.2 Remove `transform_opencode_to_ai_sdk` from handlers.rs
- [x] 4.3 Update any tests affected by the change
- **Validation**: No dead code, tests pass

## Order of Execution
1. Backend (task 1) - simplify response format
2. Frontend (task 2) - switch runtime
3. Integration (task 3) - verify flow works
4. Cleanup (task 4) - remove dead code
