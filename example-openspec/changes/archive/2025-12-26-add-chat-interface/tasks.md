# Tasks: Add Chat Interface

## 1. Project Setup
- [x] 1.1 Initialize Vite + React + TypeScript project
- [x] 1.2 Configure shadcn/ui with Tailwind CSS
- [x] 1.3 Add assistant-ui components (thread, thread-list)
- [x] 1.4 Initialize Rust backend project (Cargo)
- [x] 1.5 Set up SQLite with migrations

## 2. Backend Implementation
- [x] 2.1 Create HTTP server with CORS support
- [x] 2.2 Implement OpenCode client (HTTP proxy)
- [x] 2.3 Add session management endpoints (create, list, get)
- [x] 2.4 Add message endpoints (send, list, stream)
- [x] 2.5 Implement SSE relay for real-time responses
- [x] 2.6 Add chat history persistence to SQLite

## 3. Frontend Implementation
- [x] 3.1 Create assistant-ui runtime provider
- [x] 3.2 Build Thread component with message rendering
- [x] 3.3 Implement message composer with send functionality
- [x] 3.4 Add streaming response support (AI SDK SSE format implemented)
- [x] 3.5 Style with shadcn/ui and Tailwind

## 4. Integration
- [x] 4.1 Connect frontend to Rust backend
- [x] 4.2 Test end-to-end message flow (e2e_test.sh script added)
- [x] 4.3 Handle error states and loading indicators (toast notifications)
- [x] 4.4 Add configuration for OpenCode server URL

## 5. Testing
- [x] 5.1 Add frontend unit tests (Vitest)
- [x] 5.2 Add backend integration tests
- [x] 5.3 Manual E2E testing

## Implementation Notes (2025-12-26)
- Backend transforms OpenCode response to AI SDK UI Message Stream Protocol (SSE)
- Format: start → start-step → text-start → text-delta → text-end → finish-step → finish → [DONE]
- Header `x-vercel-ai-ui-message-stream: v1` added for AI SDK compatibility
- Error handling via toast notifications in App.tsx
