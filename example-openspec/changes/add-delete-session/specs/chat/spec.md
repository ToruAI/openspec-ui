## ADDED Requirements

### Requirement: Delete Session
The system SHALL allow users to delete individual chat sessions.

#### Scenario: User deletes a session successfully
- **GIVEN** the user has multiple chat sessions
- **WHEN** the user clicks the delete button on a session
- **THEN** a confirmation dialog appears asking to confirm deletion
- **AND** after confirmation, the session is deleted from OpenCode
- **AND** the session is removed from the local database
- **AND** the session disappears from the sidebar

#### Scenario: User cancels deletion
- **GIVEN** the user clicked delete on a session
- **WHEN** the confirmation dialog appears and user clicks Cancel
- **THEN** the session is not deleted
- **AND** the dialog closes

#### Scenario: Delete active session
- **GIVEN** the user is viewing a session (it's the active session)
- **WHEN** the user deletes that session
- **THEN** the session is deleted
- **AND** the UI switches to another available session
- **OR** shows the empty state if no sessions remain

#### Scenario: Delete fails due to network error
- **GIVEN** the OpenCode server is unreachable
- **WHEN** the user tries to delete a session
- **THEN** an error message is displayed
- **AND** the session remains in the list
