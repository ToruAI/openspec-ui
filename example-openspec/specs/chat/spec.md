# chat Specification

## Purpose
Provides a chat interface for users to interact with an AI assistant via the OpenCode backend.
## Requirements
### Requirement: Send Message
The system SHALL allow users to send text messages to the OpenCode server and display responses.

#### Scenario: User sends a message successfully
- **GIVEN** the user has the chat interface open
- **WHEN** the user types a message and submits it
- **THEN** the message is sent to the OpenCode server via the Rust backend
- **AND** the user's message appears in the chat thread
- **AND** the AI response is retrieved (visible after refresh)

#### Scenario: Message send fails due to network error
- **GIVEN** the OpenCode server is unreachable
- **WHEN** the user sends a message
- **THEN** an error message is displayed to the user
- **AND** the user can retry sending the message

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

### Requirement: Session Management
The system SHALL support creating and switching between chat sessions.

#### Scenario: Create new session
- **GIVEN** the user wants to start a new conversation
- **WHEN** the user creates a new session
- **THEN** a new empty chat thread is displayed
- **AND** the previous session is preserved

#### Scenario: Switch between sessions
- **GIVEN** the user has multiple sessions
- **WHEN** the user selects a different session
- **THEN** the chat thread updates to show that session's messages

### Requirement: Chat Message Display
The system SHALL display chat messages from the user and AI assistant.

#### Scenario: User sends message and receives streaming response
- **GIVEN** the user is in an active chat session
- **WHEN** the user sends a message
- **THEN** the user message appears immediately in the chat
- **AND** a loading indicator shows while waiting
- **AND** the AI response streams in real-time via SSE
- **AND** no page refresh is required

### Requirement: Backend Message API
The backend SHALL proxy message operations to OpenCode using async endpoints.

#### Scenario: GET messages returns UIMessage format
- **GIVEN** a session has messages in OpenCode
- **WHEN** the frontend calls GET /api/sessions/:id/messages
- **THEN** the backend fetches from OpenCode GET /session/:id/message
- **AND** transforms the response to UIMessage[] format
- **AND** returns JSON array of { id, role, parts }

#### Scenario: POST message returns immediately
- **GIVEN** the user sends a message
- **WHEN** the frontend calls POST /api/sessions/:id/messages
- **THEN** the backend sends to OpenCode POST /session/:id/prompt_async
- **AND** returns `{ "status": "sent" }` immediately
- **AND** the actual response comes via SSE (direct to frontend)

### Requirement: Real-time Streaming via Direct SSE
The frontend SHALL connect directly to OpenCode's SSE endpoint for real-time message streaming.

#### Scenario: SSE connection established
- **GIVEN** the user opens the application
- **WHEN** a session is active
- **THEN** the frontend establishes an EventSource connection to `${OPENCODE_URL}/event`
- **AND** the connection remains open for real-time updates

#### Scenario: Message streams in real-time
- **GIVEN** the SSE connection is established
- **WHEN** the AI generates a response
- **THEN** `message.part.updated` events stream text incrementally
- **AND** the UI updates in real-time as text arrives
- **AND** `message.updated` event signals completion

#### Scenario: SSE reconnects on disconnect
- **GIVEN** the SSE connection drops
- **WHEN** the browser detects the disconnection
- **THEN** EventSource automatically reconnects
- **AND** no manual intervention is required

#### Scenario: SSE connection fails to OpenCode
- **GIVEN** the user opens the application
- **WHEN** OpenCode server is unreachable
- **THEN** EventSource fires an error event
- **AND** EventSource attempts automatic reconnection
- **AND** the error is logged to console for debugging

### Requirement: Async Message Sending
The frontend SHALL send messages asynchronously and receive responses via SSE.

#### Scenario: User sends message with optimistic update
- **GIVEN** the user types a message
- **WHEN** the user submits the message
- **THEN** the user message appears immediately (optimistic update)
- **AND** the backend calls OpenCode's `prompt_async` endpoint
- **AND** the AI response streams via SSE (not HTTP response)

