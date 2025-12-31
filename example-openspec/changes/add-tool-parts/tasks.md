# Tasks: Add Tool Parts to SSE Response

## 1. Research AI SDK Tool Format
- [ ] 1.1 Review AI SDK UI Message Stream protocol for tool parts
- [ ] 1.2 Document required fields for tool-call and tool-result
- [ ] 1.3 Compare with OpenCode part format
- **Validation**: Clear mapping between formats documented

## 2. Update Transform Function
- [ ] 2.1 Extract tool-invocation parts from OpenCode response
- [ ] 2.2 Map to AI SDK `tool-call-begin`, `tool-call-delta`, `tool-result` events
- [ ] 2.3 Preserve tool name, arguments, and results
- [ ] 2.4 Handle tool parts interleaved with text parts
- **Validation**: SSE response includes tool events

## 3. Unit Tests
- [ ] 3.1 Backend: Test transform extracts tool-call from OpenCode response
- [ ] 3.2 Backend: Test transform handles tool-result correctly
- [ ] 3.3 Backend: Test interleaved text and tool parts maintain order
- [ ] 3.4 Backend: Test transform handles response with no tool usage
- [ ] 3.5 Frontend: Test ToolFallback component renders tool name
- [ ] 3.6 Frontend: Test ToolFallback component renders tool arguments
- **Validation**: `cargo test` and `npm test` pass with tool transform tests

## 4. Manual E2E Testing
- [ ] 4.1 Test with OpenCode response that includes tool usage
- [ ] 4.2 Verify text and tools display in correct order
- **Validation**: Tool usage visible in chat UI

## Order of Execution
1. Research (task 1) - understand target format
2. Implementation (task 2) - update transform function
3. Unit tests (task 3) - after implementation
4. Manual E2E (task 4) - final verification

## Notes
- Frontend ToolFallback component already exists and handles rendering
- Only backend transformation needs updating
