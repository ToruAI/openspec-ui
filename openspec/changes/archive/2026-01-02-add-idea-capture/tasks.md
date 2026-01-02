## 1. Backend - Idea Storage
- [x] 1.1 Define idea data structure (id, title, description, createdAt, updatedAt)
- [x] 1.2 Add `ideas/` directory parsing to config manager
- [x] 1.3 Implement idea file persistence (Markdown format with YAML frontmatter)

## 2. Backend - API Endpoints
- [x] 2.1 Add GET /api/ideas - list all ideas
- [x] 2.2 Add POST /api/ideas - create new idea
- [x] 2.3 Add DELETE /api/ideas/:id - delete idea
- [x] 2.4 Add PUT /api/ideas/:id - update idea (title and description only)
- [x] 2.5 Add SSE event for idea changes

## 3. Frontend - Idea Capture UI
- [x] 3.1 Create IdeaCapture component (title + description input)
- [x] 3.2 Add "New Idea" button in Header

## 4. Frontend - Kanban Board Integration
- [x] 4.1 Update KanbanBoard columns to: Ideas, Todo, In Progress, Done, Archived (remove Draft column)
- [x] 4.2 Render IdeaCard components in Ideas column
- [x] 4.3 Display idea metadata (title, description preview, created timestamp) in cards
- [x] 4.4 Add click handler on IdeaCard to open IdeaDetailModal
- [x] 4.5 Filter ideas by selected source (same as changes)

## 5. Frontend - Idea Management
- [x] 5.1 Add edit mode to IdeaDetailModal (reuse IdeaCapture with pre-filled data)
- [x] 5.2 Integrate PUT /api/ideas/:id endpoint for editing
- [x] 5.3 Add delete confirmation dialog for ideas
- [x] 5.4 Add SSE listener for real-time idea updates

## 6. Frontend - Cleanup
- [x] 6.1 Remove IdeasView component (ideas now shown in Kanban)
- [x] 6.2 Remove Ideas tab from navigation (no longer needed)
- [x] 6.3 Remove view preference persistence for Ideas (no longer separate view)
- [x] 6.4 Remove unused code and imports related to separate Ideas view

## 7. Backend - Update Handler
- [x] 7.1 Implement `update_idea()` function in parser.rs
- [x] 7.2 Add PUT /api/ideas/:id route handler in main.rs
- [x] 7.3 Ensure updated idea file maintains proper YAML frontmatter format
- [x] 7.4 Trigger SSE update event on idea modification

