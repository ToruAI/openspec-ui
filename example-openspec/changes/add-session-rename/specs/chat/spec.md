# chat Specification Delta

## ADDED Requirements

### Requirement: Session Rename
The system SHALL allow users to rename chat sessions.

#### Scenario: User renames session via click
- **GIVEN** the user sees a session in the sidebar
- **WHEN** the user double-clicks the session title
- **THEN** the title becomes an editable text field
- **AND** the current title is selected for easy replacement

#### Scenario: User confirms rename
- **GIVEN** the user is editing a session title
- **WHEN** the user presses Enter or clicks outside
- **THEN** the new title is saved to OpenCode
- **AND** the sidebar updates to show the new title
- **AND** the field returns to non-editable state

#### Scenario: User cancels rename
- **GIVEN** the user is editing a session title
- **WHEN** the user presses Escape
- **THEN** the original title is restored
- **AND** no API call is made

#### Scenario: Empty title rejected
- **GIVEN** the user is editing a session title
- **WHEN** the user clears the field and confirms
- **THEN** the original title is restored
- **AND** the field returns to non-editable state

### Requirement: Backend Rename Endpoint
The backend SHALL proxy session updates to OpenCode.

#### Scenario: PATCH session updates title
- **GIVEN** a valid session ID
- **WHEN** the frontend calls PATCH /api/sessions/:id with { title }
- **THEN** the backend calls OpenCode PATCH /session/:id
- **AND** returns the updated session

#### Scenario: PATCH non-existent session
- **GIVEN** an invalid session ID
- **WHEN** the frontend calls PATCH /api/sessions/:id
- **THEN** the backend returns 404
