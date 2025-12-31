# Design: Add Chat Interface

## Context
Brain Gate is a web app to remotely interact with an OpenCode server via HTTP. The chat interface is the primary way users communicate with the AI agent. The frontend uses assistant-ui for the chat UI, while a Rust backend acts as a proxy to the OpenCode server.

## Goals / Non-Goals

**Goals:**
- Simple, responsive chat interface
- Real-time streaming responses
- Persistent chat history
- Clean separation between frontend and backend

**Non-Goals:**
- Multi-user support (single user for now)
- Thread management UI (future enhancement)
- File attachments (future enhancement)

## Decisions

### Frontend Architecture
- **Decision**: Use assistant-ui with custom runtime connecting to Rust backend
- **Alternatives**: 
  - Direct OpenCode connection (rejected: need backend for persistence/auth)
  - Custom chat components (rejected: assistant-ui provides excellent UX)

### Backend Framework
- **Decision**: Rust with Axum for HTTP server
- **Alternatives**:
  - Actix-web (good but Axum has better ergonomics)
  - Node.js (rejected: Rust for performance and type safety)

### Data Flow
```
User Input -> React -> Rust Backend -> OpenCode Server
                                            |
                                            v
User Display <- React <- Rust Backend <- SSE Stream
```

### Message Format
- Frontend sends: `{ content: string, session_id?: string }`
- Backend proxies to OpenCode: `POST /session/:id/message`
- Responses streamed via SSE from `/event` endpoint

### State Management
- **Decision**: assistant-ui runtime handles chat state
- Chat history persisted to SQLite on backend
- Frontend fetches history on session load

## Risks / Trade-offs
- **SSE complexity**: Relaying SSE through Rust adds complexity
  - Mitigation: Use proven async patterns with tokio
- **Latency**: Extra hop through Rust backend
  - Mitigation: Backend can be colocated with OpenCode on VPS

## Migration Plan
N/A - greenfield implementation

## Open Questions
- Should we support multiple OpenCode server connections?
- Do we need authentication between frontend and Rust backend?
