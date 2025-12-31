# Tasks: Add Archived Status

## 1. Backend
- [x] 1.1 Add `Archived` variant to `ChangeStatus` enum
- [x] 1.2 Update `compute_status` to return `Done` for all tasks complete, `Archived` for archive folder
- [x] 1.3 Update tests for new status logic

## 2. Frontend - Kanban
- [x] 2.1 Add "Archived" to COLUMNS array
- [x] 2.2 Add state for `showArchived` (default: false)
- [x] 2.3 Filter out archived changes when `showArchived` is false
- [x] 2.4 Update mobile swipe to handle dynamic column count

## 3. Frontend - Header
- [x] 3.1 Add toggle button/switch for "Show Archived"
- [x] 3.2 Pass `showArchived` state to KanbanBoard
- [x] 3.3 Persist preference in localStorage

## 4. Testing
- [x] 4.1 Verify Done shows only completed (non-archived) changes
- [x] 4.2 Verify Archived column appears when toggle is on
- [x] 4.3 Verify toggle state persists across page refresh
