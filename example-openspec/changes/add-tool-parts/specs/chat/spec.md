## ADDED Requirements

### Requirement: Display Tool Usage
The system SHALL display tool invocations and results when the AI uses tools.

#### Scenario: AI uses a tool during response
- **GIVEN** the user sends a message that triggers tool usage
- **WHEN** OpenCode uses a tool (e.g., file read, command execution)
- **THEN** the tool name is displayed in the chat
- **AND** the tool arguments are shown (expandable)
- **AND** the tool result is shown after completion

#### Scenario: Multiple tools used in sequence
- **GIVEN** the AI response involves multiple tool calls
- **WHEN** the response streams in
- **THEN** each tool invocation is displayed in order
- **AND** text content between tool calls is displayed correctly

#### Scenario: Tool execution fails
- **GIVEN** a tool invocation fails or is cancelled
- **WHEN** the result is received
- **THEN** the tool displays as cancelled/failed
- **AND** the error reason is shown if available
