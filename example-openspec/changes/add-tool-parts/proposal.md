# Change: Add Tool Parts to SSE Response

## Why
The backend's `transform_opencode_to_ai_sdk` function only extracts `text` parts from OpenCode responses, dropping all tool-related parts. When OpenCode uses tools (file operations, commands, etc.), users see nothing about what it's doing. The `ToolFallback` component exists in the frontend but never receives data.

OpenCode returns parts with types like:
- `text` - extracted (working)
- `tool-invocation` - dropped (broken)
- `tool-result` - dropped (broken)

## What Changes
- Update `transform_opencode_to_ai_sdk` to include tool parts
- Map OpenCode tool parts to AI SDK tool-call/tool-result format
- Frontend ToolFallback component will render tool usage

## Impact
- Affected specs: `chat` (MODIFIED - add tool display)
- Affected code:
  - `backend/src/handlers.rs` (transform function)
- No frontend changes needed (ToolFallback already exists)
