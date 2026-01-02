# Change: Add Idea Capture

## Why
Users often have raw ideas while away from their development environment and want to quickly capture them. Currently, OpenSpec requires creating a full proposal structure (proposal.md, tasks.md, etc.) which is too heavy for quick thought capture. This feature allows users to jot down ideas that AI agents can later convert into full proposals using the `/openspec-proposal` command.

## What Changes
- Add idea capture UI with simple title and description input
- Create `ideas/` directory structure for storing raw ideas in each OpenSpec source
- Add API endpoints for creating, listing, updating, and deleting ideas
- Display Ideas as the first column in the Kanban board (replacing Draft column)
- Add edit functionality for ideas (title and description only)
- Remove separate Ideas view - all idea management happens in Kanban board
- Real-time updates via SSE

## Key Design Decisions
1. **Ideas as Kanban Column**: Ideas are integrated into the main workflow, not a separate view. The Kanban board now has columns: Ideas → Todo → In Progress → Done → Archived
2. **Agent-Driven Conversion**: AI agents use `/openspec-proposal` command to convert ideas into full proposals. No UI conversion workflow needed.
3. **Minimal Idea Editing**: Users can only edit title and description. All other metadata (id, timestamps) is managed by the system.
4. **Storage Format**: Ideas stored as Markdown files with YAML frontmatter in `ideas/` directory, similar to change artifacts.

## Impact
- Affected specs: api, ui
- Affected code: backend (new handler for PUT /api/ideas/:id), frontend (KanbanBoard, remove IdeasView)
- Breaking changes: Draft column removed from Kanban board, Ideas column added in its place
