## ADDED Requirements

### Requirement: SSE Proxy Endpoint
The backend SHALL provide an endpoint to stream OpenCode events to the frontend.

#### Scenario: Event Forwarding
- **GIVEN** a client connected to `GET /api/events`
- **WHEN** OpenCode emits a `message.part.updated` event
- **THEN** the backend SHALL forward this event to the connected client
- **AND** preserve the event data structure

### Requirement: Async Prompt Execution
The backend SHALL support asynchronous message submission.

#### Scenario: Submit without blocking
- **GIVEN** a valid user message
- **WHEN** `POST /api/sessions/:id/messages` is called
- **THEN** the backend SHALL call OpenCode `prompt_async`
- **AND** return 200 OK immediately (without waiting for AI generation)

