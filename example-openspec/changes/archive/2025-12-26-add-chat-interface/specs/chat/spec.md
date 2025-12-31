## ADDED Requirements

### Requirement: Send Message
The system SHALL allow users to send text messages to the OpenCode server and display responses.

#### Scenario: User sends a message successfully
- **GIVEN** the user has the chat interface open
- **WHEN** the user types a message and submits it
- **THEN** the message is sent to the OpenCode server via the Rust backend
- **AND** the user's message appears in the chat thread
- **AND** the AI response streams back in real-time

#### Scenario: Message send fails due to network error
- **GIVEN** the OpenCode server is unreachable
- **WHEN** the user sends a message
- **THEN** an error message is displayed to the user
- **AND** the user can retry sending the message

### Requirement: Stream Responses
The system SHALL stream AI responses in real-time using Server-Sent Events.

#### Scenario: Response streams incrementally
- **GIVEN** the user has sent a message
- **WHEN** the OpenCode server begins responding
- **THEN** the response text appears incrementally as it streams
- **AND** a loading indicator shows while streaming is in progress
- **AND** the loading indicator disappears when streaming completes

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
- **THEN** both the user message and AI response are saved to the database
- **AND** they persist across page refreshes

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
