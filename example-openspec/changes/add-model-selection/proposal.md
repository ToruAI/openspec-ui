# Change: Add Model Selection

## Why
Users cannot choose which AI model to use. The OpenCode server supports multiple providers (Anthropic, OpenAI, etc.) and models, but Brain Gate hardcodes behavior. Users need to:
- See available providers and models
- Select their preferred model for new messages
- Know which model is currently active

## What Changes
- Add backend endpoint to proxy `GET /provider` from OpenCode
- Add model selector dropdown in sidebar footer
- Store selected model in frontend state
- Pass model choice when sending messages via `prompt_async`

## Impact
- Affected specs: `chat` (ADDED - model selection)
- Affected code:
  - `backend/src/handlers.rs` (new provider endpoint)
  - `backend/src/opencode.rs` (get_providers method)
  - `src/App.tsx` (model selector component in sidebar footer)
  - `src/runtime.tsx` (pass model to message send)

## Scope
This proposal focuses only on model selection. Related features (MCP status, LSP status, slash commands) will be separate proposals.

## OpenCode API Reference
```
GET /provider
Response: {
  all: Provider[],
  default: { [key: string]: string },
  connected: string[]
}
```

Provider contains `id`, `name`, and `models` array.
