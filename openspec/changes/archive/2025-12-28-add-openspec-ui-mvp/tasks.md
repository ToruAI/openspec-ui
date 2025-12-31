# Tasks: Add OpenSpec UI MVP

## 1. Project Setup
- [x] 1.1 Initialize Rust backend with Cargo (`backend/`)
- [x] 1.2 Initialize Vite + React + TypeScript frontend (`frontend/`)
- [x] 1.3 Add Tailwind CSS to frontend
- [x] 1.4 Install Shadcn UI and dependencies
- [x] 1.5 Create config.json for development with example-openspec
- [x] 1.6 Setup workspace scripts (dev, build)

## 2. Backend: Config & CLI
- [x] 2.1 Add clap for CLI argument parsing
- [x] 2.2 Implement config file loading (JSON)
- [x] 2.3 Validate source paths exist (warn if invalid)
- [x] 2.4 Setup Axum server with configurable port
- [x] 2.5 Add static file serving for frontend build

## 3. Backend: OpenSpec Parser
- [x] 3.1 Create types for Source, Change, Spec, TaskStats
- [x] 3.2 Implement directory scanner for changes/ folder
- [x] 3.3 Implement directory scanner for specs/ folder
- [x] 3.4 Implement directory scanner for archive/ folder
- [x] 3.5 Parse `tasks.md` ONLY to count [x] vs [ ] (regex) for stats
- [x] 3.6 Compute change status from artifacts and task stats

## 4. Backend: API Endpoints
- [x] 4.1 Implement `GET /api/sources`
- [x] 4.2 Implement `GET /api/changes` (list all with status)
- [x] 4.3 Implement `GET /api/changes/:id` (full detail with raw markdown)
- [x] 4.4 Implement `GET /api/specs` (list all)
- [x] 4.5 Implement `GET /api/specs/:id` (content)
- [x] 4.6 Add CORS middleware for dev

## 5. Backend: File Watcher & SSE
- [x] 5.1 Add notify crate for file watching
- [x] 5.2 Watch all source directories
- [x] 5.3 Implement SSE endpoint `/api/events`
- [x] 5.4 Push generic `update` event on any file change
- [x] 5.5 Debounce rapid file changes

## 6. Frontend: Core Layout
- [x] 6.1 Initialize Shadcn UI (theme, components)
- [x] 6.2 Create App shell with header and tab navigation
- [x] 6.3 Create Kanban view placeholder
- [x] 6.4 Create Specs view placeholder
- [x] 6.5 Add theme toggle (light/dark)
- [x] 6.6 Implement Project Filter in Header
- [x] 6.7 Implement CSS variables for theming
- [x] 6.8 Make layout responsive (mobile-first)

## 7. Frontend: API Hooks
- [x] 7.1 Create `useSources` hook
- [x] 7.2 Create `useChanges` hook
- [x] 7.3 Create `useChange(id)` hook for detail
- [x] 7.4 Create `useSpecs` hook
- [x] 7.5 Create `useSpec(id)` hook for content
- [x] 7.6 Create `useSSE` hook for real-time updates

## 8. Frontend: Kanban View
- [x] 8.1 Create KanbanBoard component with 4 columns
- [x] 8.2 Create ChangeCard component
- [x] 8.3 Display repo badge and task progress on cards
- [x] 8.4 Make columns scrollable on mobile
- [x] 8.5 Add click handler to open detail

## 9. Frontend: Specs View
- [x] 9.1 Create SpecsList component grouped by source
- [x] 9.2 Create SpecItem component
- [x] 9.3 Add click to expand/view spec

## 10. Frontend: Detail View
- [x] 10.1 Create DetailModal/Drawer component
- [x] 10.2 Add tabs: Proposal | Specs | Tasks | Design
- [x] 10.3 Render all artifacts as Markdown (using `react-markdown` or similar)
- [x] 10.4 Add close button and escape key handler

## 11. Frontend: Real-time Updates
- [x] 11.1 Connect to SSE on app load
- [x] 11.2 Handle `update` events (refetch all active queries)

## 12. Polish & Testing
- [x] 12.1 Add loading states for all data fetches
- [x] 12.2 Add error states with retry buttons
- [x] 12.3 Add empty states with helpful messages

## 13. Build & Distribution
- [x] 13.1 Create production build script
- [x] 13.2 Embed frontend build into Rust binary
- [x] 13.3 Add release build config
- [x] 13.4 Test single binary distribution
- [x] 13.5 Write README with usage instructions
