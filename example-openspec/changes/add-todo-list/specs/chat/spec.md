# chat Specification Delta

## ADDED Requirements

### Requirement: Todo List Display
The system SHALL display the AI's task list for the current session.

#### Scenario: Todo list shown in sidebar
- **GIVEN** the user has an active session
- **WHEN** the session has todo items
- **THEN** a "Tasks" panel appears in the sidebar
- **AND** the panel is collapsible
- **AND** each todo shows its status and content

#### Scenario: Todo items show progress
- **GIVEN** the AI is working on tasks
- **WHEN** a task status changes
- **THEN** the todo list updates to reflect the change
- **AND** completed tasks show a checkmark
- **AND** in-progress tasks are visually highlighted

#### Scenario: Empty todo list
- **GIVEN** a session has no todo items
- **WHEN** the user views the sidebar
- **THEN** the Tasks panel shows "No tasks" or is hidden
- **AND** no empty state clutters the UI

#### Scenario: Todo list updates during AI work
- **GIVEN** the AI is generating a response
- **WHEN** the AI updates its todo list
- **THEN** the sidebar reflects changes in near real-time
- **AND** new tasks appear as they're created

### Requirement: Backend Todo Endpoint
The backend SHALL proxy todo list requests to OpenCode.

#### Scenario: GET todos returns task list
- **GIVEN** a session has todo items
- **WHEN** the frontend calls GET /api/sessions/:id/todos
- **THEN** the backend calls OpenCode GET /session/:id/todo
- **AND** returns the todo array

#### Scenario: GET todos for empty session
- **GIVEN** a session has no todo items
- **WHEN** the frontend calls GET /api/sessions/:id/todos
- **THEN** the backend returns an empty array
