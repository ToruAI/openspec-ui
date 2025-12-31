## ADDED Requirements

### Requirement: Real-time Message Streaming
The system SHALL stream chat messages and tool updates in real-time using Server-Sent Events (SSE).

#### Scenario: AI Response Streaming
- **GIVEN** the user has sent a message
- **WHEN** the AI generates a response
- **THEN** the text SHALL appear incrementally in the UI as it is generated
- **AND** the UI SHALL NOT block waiting for the full response

#### Scenario: Tool Invocation Display
- **GIVEN** the AI decides to use a tool (e.g., file read, bash command)
- **WHEN** the tool is invoked
- **THEN** the UI SHALL display the tool usage and status in real-time via stream events

### Requirement: Optimistic User Feedback
The system SHALL display user interactions immediately without waiting for server confirmation.

#### Scenario: Instant Message Display
- **GIVEN** the user types a message and hits send
- **THEN** the message SHALL appear in the chat history immediately
- **AND** the input field SHALL be cleared
- **AND** a "thinking" or loading state SHALL be indicated

### Requirement: Async Chat Persistence
The system SHALL persist chat messages asynchronously via OpenCode.

#### Scenario: Async Persistence
- **GIVEN** a message is sent via `prompt_async`
- **WHEN** the OpenCode server processes it
- **THEN** the message SHALL be persisted in OpenCode
- **AND** confirmed via a `message.updated` event
