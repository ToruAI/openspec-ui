# Tasks: Add Model Selection

## 1. Backend: Provider Endpoint
- [ ] 1.1 Add `get_providers` method to `OpenCodeClient` in `opencode.rs`
- [ ] 1.2 Add `GET /api/providers` route in `handlers.rs`
- [ ] 1.3 Return provider data with connected status and models
- **Validation**: `curl localhost:8080/api/providers` returns provider JSON

## 2. Frontend: Model Selector Component
- [ ] 2.1 Create `ModelSelector` component using shadcn Select/Dropdown
- [ ] 2.2 Fetch providers on app load
- [ ] 2.3 Group models by provider in dropdown
- [ ] 2.4 Display current model in collapsed state
- [ ] 2.5 Add to sidebar footer (below session list)
- **Validation**: Model selector visible in sidebar, shows available models

## 3. Frontend: Model State Management
- [ ] 3.1 Add `selectedModel` state to App (provider + model ID)
- [ ] 3.2 Persist selection in localStorage
- [ ] 3.3 Restore selection on page load
- [ ] 3.4 Use default model from provider response if none selected
- **Validation**: Model selection persists across page refresh

## 4. Frontend: Pass Model to Messages
- [ ] 4.1 Update runtime to include model in prompt_async call
- [ ] 4.2 Modify backend send_message to accept and forward model parameter
- [ ] 4.3 Update OpenCodeClient::prompt_async to include model in request body
- **Validation**: Messages sent with selected model (check OpenCode logs)

## 5. Unit Tests
- [ ] 5.1 Backend: Test providers endpoint returns correct structure
- [ ] 5.2 Backend: Test providers endpoint handles OpenCode error gracefully
- [ ] 5.3 Frontend: Test ModelSelector renders providers correctly
- [ ] 5.4 Frontend: Test model selection updates state
- [ ] 5.5 Frontend: Test localStorage persistence
- **Validation**: `cargo test` and `bun test` pass

## 6. Manual E2E Testing
- [ ] 6.1 Verify model selector shows connected providers
- [ ] 6.2 Select a model, send message, verify in OpenCode that model was used
- [ ] 6.3 Refresh page, verify selection persists
- **Validation**: Full flow works end-to-end

## Order of Execution
1. Backend provider endpoint (task 1) - foundation
2. Model selector component (task 2) - UI scaffold
3. State management (task 3) - persistence
4. Pass model to messages (task 4) - integration
5. Unit tests (task 5) - verification
6. Manual E2E (task 6) - final validation

## Dependencies
- Task 2 depends on Task 1 (needs provider data)
- Task 4 depends on Tasks 2+3 (needs model selection working)
- Tasks 2 and 3 can be developed in parallel
