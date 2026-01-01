## 1. Backend - Idea Storage
- [x] 1.1 Define idea data structure (id, title, description, createdAt, updatedAt)
- [x] 1.2 Add `ideas/` directory parsing to config manager
- [x] 1.3 Implement idea file persistence (Markdown format with YAML frontmatter)

## 2. Backend - API Endpoints
- [x] 2.1 Add GET /api/ideas - list all ideas
- [x] 2.2 Add POST /api/ideas - create new idea
- [x] 2.3 Add DELETE /api/ideas/:id - delete idea
- [x] 2.4 Add SSE event for idea changes

## 3. Frontend - Idea Capture UI
- [x] 3.1 Create IdeaCapture component (title + description input)
- [x] 3.2 Add "New Idea" button in Header
- [x] 3.3 Create IdeasView component (list ideas, quick actions)
- [x] 3.4 Add Ideas tab to main navigation

## 4. Frontend - Idea Management
- [x] 4.1 Implement idea list display with created date
- [x] 4.2 Add delete confirmation dialog for ideas
- [x] 4.3 Add SSE listener for real-time idea updates
- [x] 4.4 Persist view preference (Kanban/Specs/Ideas)
