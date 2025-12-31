# Change: Add Archived Status

## Why
Currently "Done" conflates two different states:
1. All tasks completed (ready for review/deploy)
2. Change has been archived (historical record)

Users need to:
- See completed work that's ready for review separately from archived history
- Hide/show archived changes (they clutter the board)

## What Changes

### Backend
- Add new `Archived` status to `ChangeStatus` enum
- Update `compute_status`:
  - `Done` = all tasks checked (`done == total && total > 0`)
  - `Archived` = located in `archive/` folder
- Add 5th column to Kanban logic

### Frontend
- Add "Archived" column (5th column, rightmost)
- Add toggle to show/hide archived changes (default: hidden)
- Update mobile swipe to include 5 columns (or 4 if archived hidden)

## Status Flow
```
Draft → Todo → In Progress → Done → Archived
                                ↑
                                └── All tasks [x]
                                         ↓
                              (manual archive via openspec CLI)
```

## Impact
- Affected specs: `ui/spec.md`
- Backend: `parser.rs` (ChangeStatus enum, compute_status)
- Frontend: `KanbanBoard.tsx`, `Header.tsx` (toggle)
