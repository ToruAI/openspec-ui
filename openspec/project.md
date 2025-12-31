# OpenSpec UI

A read-only dashboard for monitoring OpenSpec changes and specifications across multiple repositories.

## Tech Stack
- **Frontend**: Vite + React + TypeScript
- **Backend**: Rust (Axum or Actix-web)
- **Styling**: Tailwind CSS, CSS variables for theming
- **Real-time**: Server-Sent Events (SSE)

## Conventions
- Mobile-first, responsive design
- Light/dark theme support via CSS variables
- Notion-like simplicity
- No external database - filesystem is the source of truth

## Project Structure
```
openspec-ui/
├── backend/           # Rust binary
├── frontend/          # Vite + React
├── openspec/          # This project's own specs
└── example-openspec/  # Test data
```

## Running
```bash
# Development
cd backend && cargo run -- --config ../config.json
cd frontend && bun dev

# Production
openspec-ui --config /path/to/config.json
```
