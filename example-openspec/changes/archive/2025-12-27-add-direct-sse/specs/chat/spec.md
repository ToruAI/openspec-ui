# chat Spec Delta

## ADDED Requirements

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

