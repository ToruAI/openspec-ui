# Change: Add Idea Capture

## Why
Users often have raw ideas while away from their development environment and want to quickly capture them. Currently, OpenSpec requires creating a full proposal structure which is too heavy for quick thought capture. This feature allows users to jot down ideas that AI agents can later flesh into full proposals.

## What Changes
- Add idea capture UI with simple title and description input
- Create `ideas/` directory structure for storing raw ideas
- Add API endpoints for creating, listing, and deleting ideas
- Add AI agent workflow to convert ideas to full proposals (clarifying questions → proposal generation)
- Ideas view in UI to manage raw ideas
- Real-time updates via SSE

## Impact
- Affected specs: api, ui
- Affected code: backend (new handlers), frontend (new components, views)
