## MODIFIED 2. Kanban View (Default)

### 2. Kanban View (Default)
- **Layout**: Full-width (no max-width constraint). Columns expand equally to fill available space.
- **Filtering**: Filter cards by selected project (from Header).
- **Columns**:
  1. **Ideas** (Raw ideas from `ideas/` directory)
  2. **Todo** (Tasks exist, 0% done)
  3. **In Progress** (Tasks started, not all complete)
  4. **Done** (All tasks complete, not archived)
  5. **Archived** (Located in archive/ folder, hidden by default)
- **Cards**: Show change/idea name, repo badge, and status.
- **Interaction**: Clicking a card opens the Detail View.
- **Archive Toggle**: Header contains toggle to show/hide Archived column (default: hidden).

## ADDED Requirements

### Requirement: Idea Capture Interface
- **Quick Input**: "New Idea" button in header opens a dialog.
- **Fields**: Title, Description (optional), Project/Source selection.
- **Result**: Submitting creates a file in `ideas/` and updates the board immediately.

### Requirement: Idea Detail View
- **Edit**: Users can edit title and description of ideas.
- **Delete**: Users can delete ideas (with confirmation).
- **Metadata**: Shows creation time and source.
