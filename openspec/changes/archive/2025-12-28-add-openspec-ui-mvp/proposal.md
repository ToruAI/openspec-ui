# Change: Add OpenSpec UI MVP

## Why
When working with AI coding assistants using OpenSpec, there's no way to visually monitor:
- What changes/proposals exist across multiple repos
- What the agent is currently working on (task progress)
- The state of specifications

Users need a simple, read-only dashboard to see OpenSpec state at a glance without digging through files.

## What Changes
Build a Vite + React frontend with a Rust backend that:
- Reads OpenSpec folders from multiple configured repos
- Displays changes in a Kanban board (Draft → Todo → In Progress → Done)
- Shows specs in a browsable view
- Provides detail view for each change (proposal, specs, tasks, design)
- Updates in real-time when files change

## Goals
- **Simple**: Notion-like, mobile-first UI
- **Read-only**: No mutations, pure monitoring
- **Multi-repo**: Combined view across all configured OpenSpec sources
- **Real-time**: File watcher pushes updates to UI

## Non-Goals (for MVP)
- Editing proposals, specs, or tasks
- Creating new changes
- Authentication/multi-user
- Cloud deployment (local binary only)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Vite + React  │────▶│   Rust Backend  │────▶ Filesystem
│   (Frontend)    │◀────│   (API + Watch) │◀──── (OpenSpec folders)
└─────────────────┘ SSE └─────────────────┘
```

### Config
Binary runs with: `openspec-ui --config /path/to/config.json`

```json
{
  "sources": [
    { "name": "brain-gate", "path": "/Users/tako/repos/brain-gate/openspec" },
    { "name": "megg", "path": "/Users/tako/repos/megg/openspec" }
  ],
  "port": 3000
}
```

### API Endpoints
```
GET  /api/sources           List configured repos
GET  /api/changes           All changes with status + stats
GET  /api/changes/:id       Change detail (proposal, tasks, specs, design)
GET  /api/specs             All specs across repos
GET  /api/specs/:path       Single spec content
SSE  /api/events            Real-time file change notifications
```

### Kanban Status Logic
| Status | Condition |
|--------|-----------|
| Draft | Has `proposal.md` but NO `tasks.md` |
| Todo | Has `tasks.md`, ALL tasks are `[ ]` |
| In Progress | Has `tasks.md`, SOME `[x]` but not all |
| Done | Located in `archive/` folder |

## UI Views

### 1. Kanban View (default)
- 4 columns: Draft, Todo, In Progress, Done
- Cards show: change name, repo badge, task progress (e.g., "3/12")
- Click card → Detail modal

### 2. Specs View
- Tree/list of all specs from `specs/` folders
- Click spec → Rendered markdown content

### 3. Detail View (modal/drawer)
- Tabs or sections: Proposal | Specs | Tasks | Design
- Rendered markdown content (`design.md` for Design tab, optional)
- Tasks show checkboxes (read-only visual)

## Impact
- New project structure:
  - `backend/` - Rust crate
  - `frontend/` - Vite React app
- New config file format
- New binary: `openspec-ui`

## Open Questions
1. Should archived changes be hidden by default with a toggle to show?
2. Should there be a search/filter feature in MVP?
3. Notification sounds when task status changes?
