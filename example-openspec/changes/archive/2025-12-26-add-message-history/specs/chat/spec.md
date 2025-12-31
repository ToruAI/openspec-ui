## ADDED Requirements

### Requirement: Chat Message Display
The system SHALL display chat messages from the user and AI assistant in real-time.

#### Scenario: User sends message and receives response
- **GIVEN** the user is in an active chat session
- **WHEN** the user sends a message
- **THEN** the user message appears immediately in the chat
- **AND** a loading indicator shows while waiting for the AI response
- **AND** the AI response appears when received from OpenCode
- **AND** the loading indicator disappears

#### Scenario: Message state managed by ExternalStoreRuntime
- **GIVEN** the frontend uses ExternalStoreRuntime
- **WHEN** the runtime's onNew callback is triggered
- **THEN** the system POSTs the message to the backend
- **AND** waits for the response (synchronous, not streaming)
- **AND** refetches the full message history from the backend
- **AND** updates the displayed messages

### Requirement: Backend Message API
The backend SHALL proxy message operations to OpenCode and transform responses.

#### Scenario: GET messages returns UIMessage format
- **GIVEN** a session has messages in OpenCode
- **WHEN** the frontend calls GET /api/sessions/:id/messages
- **THEN** the backend fetches from OpenCode GET /session/:id/message
- **AND** transforms the response to UIMessage[] format
- **AND** returns JSON array of { id, role, parts }

#### Scenario: POST message returns assistant response
- **GIVEN** the user sends a message
- **WHEN** the frontend calls POST /api/sessions/:id/messages
- **THEN** the backend extracts the user message content
- **AND** sends it to OpenCode POST /session/:id/message
- **AND** waits for the complete response (not streaming)
- **AND** returns the assistant message in UIMessage format as JSON

## MODIFIED Requirements

### Requirement: Chat History
The system SHALL persist chat history and restore it on page load.

#### Scenario: History loads on startup
- **GIVEN** the user has previous chat messages
- **WHEN** the user opens the application
- **THEN** the previous messages are loaded and displayed
- **AND** the user can continue the conversation

#### Scenario: New messages are persisted
- **GIVEN** the user sends a message
- **WHEN** the AI responds
- **THEN** both the user message and AI response are stored by OpenCode
- **AND** they persist across page refreshes

#### Scenario: History loads on session switch
- **GIVEN** the user has multiple sessions with messages
- **WHEN** the user switches to a different session
- **THEN** a loading indicator appears briefly
- **AND** the previous messages for that session are displayed
- **AND** the user can continue the conversation in that session

#### Scenario: Empty session shows welcome
- **GIVEN** the user switches to a new session with no messages
- **WHEN** the session loads
- **THEN** the welcome message and suggestions are shown
- **AND** no loading indicator flashes unnecessarily
