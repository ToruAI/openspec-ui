# chat Specification Delta

## ADDED Requirements

### Requirement: Abort Running Response
The system SHALL allow users to abort an in-progress AI response.

#### Scenario: User aborts during generation
- **GIVEN** the AI is generating a response
- **WHEN** the user clicks the stop button
- **THEN** the backend calls OpenCode abort endpoint
- **AND** SSE streaming stops
- **AND** the partial response remains visible
- **AND** the send button returns to normal state

#### Scenario: Stop button appears during generation
- **GIVEN** the user sends a message
- **WHEN** the AI starts generating
- **THEN** the send button transforms to a stop button
- **AND** the stop button is visually distinct (e.g., square icon)

#### Scenario: Stop button hidden when idle
- **GIVEN** no AI response is in progress
- **WHEN** the user views the chat
- **THEN** the normal send button is shown
- **AND** no stop button is visible

### Requirement: Backend Abort Endpoint
The backend SHALL proxy abort requests to OpenCode.

#### Scenario: POST abort succeeds
- **GIVEN** a session has an active response
- **WHEN** the frontend calls POST /api/sessions/:id/abort
- **THEN** the backend calls OpenCode POST /session/:id/abort
- **AND** returns success status

#### Scenario: POST abort on idle session
- **GIVEN** a session has no active response
- **WHEN** the frontend calls POST /api/sessions/:id/abort
- **THEN** the backend returns success (no-op)
- **AND** no error is shown to user
