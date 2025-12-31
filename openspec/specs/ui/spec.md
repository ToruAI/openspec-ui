# UI Specification

## Purpose
Provides a read-only dashboard for viewing OpenSpec changes and specifications across multiple repositories.

## Requirements

### 1. General Layout
- **Navigation**: Tabbed navigation between "Kanban" (Changes) and "Specs" views.
- **Header**: Contains global project filter (dropdown), view switcher, and theme toggle.
- **Theme**: Light/Dark mode toggle, persisted in localStorage.
- **Responsiveness**: Mobile-first design.
- **UI Framework**: Shadcn UI (using Tailwind CSS).

### 2. Kanban View (Default)
- **Layout**: Full-width (no max-width constraint). Columns expand equally to fill available space.
- **Filtering**: Filter cards by selected project (from Header).
- **Columns**:
  1. **Draft** (Proposal only, no tasks.md)
  2. **Todo** (Tasks exist, 0% done)
  3. **In Progress** (Tasks started, not all complete)
  4. **Done** (All tasks complete, not archived)
  5. **Archived** (Located in archive/ folder, hidden by default)
- **Cards**: Show change name, repo badge, and task progress (e.g., "3/12").
- **Interaction**: Clicking a card opens the Detail View.
- **Archive Toggle**: Header contains toggle to show/hide Archived column (default: hidden).

### 3. Specs View
- **List**: Grouped by Source/Repo.
- **Items**: Show spec path (e.g., `chat/spec.md`).
- **Interaction**: Clicking a spec displays its content (rendered markdown) in a reader view or modal.

### 4. Detail View (Modal/Drawer)
- **Header**: Change title, status badge, and source repo.
- **Tabs**:
  - **Proposal**: Renders `proposal.md`.
  - **Specs**: List of associated specs (rendered content on click).
  - **Tasks**: Renders `tasks.md`.
  - **Design**: Renders `design.md` (if exists).
- **Empty States**: Gracefully handle missing files (e.g., "No design document found").

### 5. Data & State
- **Hooks**: Custom hooks to fetch data from API.
- **Real-time**: Listen for SSE `update` events and re-validate SWR/TanStack Query cache.

### 6. Settings Dialog
- **Access**: Settings icon/button in the header (gear icon).
- **Modal**: Opens a dialog showing source configuration.
- **Source Management**:
  - List all configured sources with name and path.
  - Visual indication for invalid sources (paths that don't exist) - red border/text.
  - Add new sources via "Add Source" button.
  - Remove sources via delete button.
  - Edit source name and path inline.
  - Save button persists changes and triggers hot-reload.
- **Validation**: Display error messages from backend for invalid paths.
- **Hot Reload**: Changes take effect immediately without server restart.
