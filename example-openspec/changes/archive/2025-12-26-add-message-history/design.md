# Design: Fix Message History and Runtime Protocol

## Context

Brain Gate's frontend uses `assistant-ui` for the chat interface. The current implementation uses `useAISDKRuntime` with `useChat` from `@ai-sdk/react`, which expects the backend to implement the AI SDK Data Stream Protocol (streaming responses with specific wire format).

However, OpenCode's HTTP API returns **synchronous JSON responses**, not streams. The backend attempts to transform the response to the stream format (`0:"text"\n`), but this doesn't work because:
1. The response is already complete (not chunked/streaming)
2. The protocol requires proper finish events and message framing
3. `useChat` expects to parse incremental updates, not a single payload

## Goals / Non-Goals

**Goals:**
- Messages display correctly after sending
- Message history loads on session switch
- Simple, maintainable architecture
- Works with OpenCode's synchronous API

**Non-Goals:**
- Real-time streaming (OpenCode doesn't support it for this endpoint)
- WebSocket/SSE integration (future enhancement)
- Optimistic UI updates (keep it simple)

## Decisions

### Decision: Use ExternalStoreRuntime instead of useChat

**Why:** `ExternalStoreRuntime` is designed for backends that don't implement AI SDK's streaming protocol. It gives us full control over:
- Message state management
- When to fetch/refetch messages
- Loading states

**Alternatives considered:**
1. **Fix the streaming protocol** - Would require implementing proper SSE/chunked responses, but OpenCode doesn't stream this endpoint
2. **Use LocalRuntime with ChatModelAdapter** - Still expects streaming; same problem
3. **Poll for updates** - Adds complexity; simpler to just refetch after POST completes

### Decision: Refetch full history after POST

**Why:** OpenCode is the source of truth. After sending a message, we refetch `GET /messages` to get the complete, authoritative message list including the new assistant response.

**Trade-off:** Slightly more network traffic vs. simpler state management and guaranteed consistency.

### Decision: Backend returns JSON, not stream protocol

**Why:** Since we're using `ExternalStoreRuntime`, the frontend no longer expects stream format. Plain JSON is simpler and easier to debug.

## Implementation Pattern

```typescript
// Frontend: useExternalStoreRuntime
const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
const [isRunning, setIsRunning] = useState(false);

const runtime = useExternalStoreRuntime({
  messages,
  setMessages,
  isRunning,
  onNew: async (message) => {
    setIsRunning(true);
    try {
      // POST to backend (waits for OpenCode response)
      await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ messages: [...messages, message] }),
      });
      // Refetch to get updated history including AI response
      const res = await fetch(`/api/sessions/${sessionId}/messages`);
      const updatedMessages = await res.json();
      setMessages(updatedMessages);
    } finally {
      setIsRunning(false);
    }
  },
});
```

```rust
// Backend: send_message returns JSON
async fn send_message(...) -> impl Responder {
    // ... extract user message ...
    
    // Call OpenCode (synchronous, waits for full response)
    let response = OpenCodeClient::send_message(...).await?;
    
    // Transform to UIMessage format and return as JSON
    let assistant_message = transform_to_ui_message(&response);
    HttpResponse::Ok().json(assistant_message)
}
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| No streaming = perceived slowness | Show clear loading indicator; consider skeleton UI |
| Double fetch (POST + GET) | Acceptable trade-off for simplicity; could optimize later |
| State sync issues | ExternalStoreRuntime handles this; we always refetch authoritative state |

## Migration Plan

1. Update backend `send_message` to return JSON (backward compatible for GET)
2. Update frontend to use `useExternalStoreRuntime`
3. Remove unused streaming code
4. Test full flow

**Rollback:** Revert to previous commits if issues arise; no data migration needed.

## Open Questions

- [ ] Should we add optimistic updates for the user message? (Deferred - keep simple first)
- [ ] Should we integrate OpenCode's SSE `/event` endpoint for real-time updates? (Future enhancement)

