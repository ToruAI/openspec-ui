# Project Context

## Purpose
Brain Gate is a web application that provides a remote AI chat interface to interact with an OpenCode server running on a VPS. Users can remotely control and execute actions on the OpenCode instance via HTTP, enabling AI-assisted coding and task management from anywhere.

## Tech Stack
- **Frontend**: Vite + React + TypeScript
- **UI Components**: shadcn/ui + assistant-ui (chat interface)
- **Backend**: Rust (Actix-web or Axum)
- **Database**: SQLite
- **Runtime**: Bun (for frontend tooling)
- **Target**: OpenCode Server HTTP API

## Project Conventions

### Code Style
- **TypeScript**: Strict mode enabled, prefer `type` over `interface`
- **Rust**: Follow rustfmt defaults, use clippy for linting
- **Naming**: 
  - TypeScript: camelCase for variables/functions, PascalCase for components/types
  - Rust: snake_case for functions/variables, PascalCase for types
- **Formatting**: Prettier for TypeScript, rustfmt for Rust
- **Linting**: ESLint + Biome for TypeScript, Clippy for Rust

### Architecture Patterns
- **Frontend**: 
  - Feature-based folder structure (`src/features/`)
  - assistant-ui runtime for chat state management
  - shadcn/ui for UI primitives
- **Backend**:
  - Layered architecture: handlers -> services -> repositories
  - SQLite for persistence (chat history, settings)
  - HTTP client to proxy requests to OpenCode server
- **API Communication**:
  - Frontend <-> Rust Backend: REST/JSON
  - Rust Backend <-> OpenCode Server: OpenCode HTTP API

### Testing Strategy
- **Frontend**: Vitest for unit tests, Playwright for E2E
- **Backend**: Rust's built-in test framework, integration tests with SQLite in-memory

### Git Workflow
- **Branching**: Feature branches from `main`
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **PRs**: Required before merging to `main`

## Domain Context
- **OpenCode Server**: AI coding agent with HTTP API (runs on VPS at configurable host:port)
- **Sessions**: Conversations with the AI, can be created, forked, and managed
- **Messages**: User prompts and AI responses within a session
- **Tools**: AI can execute tools (file operations, commands, etc.) via OpenCode

## Important Constraints
- Must handle network latency gracefully (VPS may be remote)
- OpenCode server authentication may be required
- Real-time updates via SSE (Server-Sent Events) from OpenCode
- Mobile-responsive design for remote access

## External Dependencies
- **OpenCode Server**: HTTP API at configurable endpoint (default: `http://localhost:4096`)
  - Key endpoints: `/session`, `/session/:id/message`, `/event` (SSE)
  - See: https://opencode.ai/docs/server for full API spec
- **assistant-ui**: React chat UI components
- **shadcn/ui**: Base UI component library
