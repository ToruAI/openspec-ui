# configuration Spec Delta

## ADDED Requirements

### Requirement: Frontend OpenCode URL Configuration
The frontend SHALL read the OpenCode server URL from the `VITE_OPENCODE_URL` environment variable for direct SSE connection.

#### Scenario: Custom OpenCode URL configured
- **GIVEN** the environment variable `VITE_OPENCODE_URL` is set to `http://myopencode:4096`
- **WHEN** the frontend connects to SSE events
- **THEN** the EventSource connects to `http://myopencode:4096/event`

#### Scenario: Default OpenCode URL used
- **GIVEN** the environment variable `VITE_OPENCODE_URL` is not set
- **WHEN** the frontend connects to SSE events
- **THEN** the frontend defaults to `http://localhost:4096`

## MODIFIED Requirements

### Requirement: Configuration Documentation
The project SHALL provide documentation for all configuration options.

#### Scenario: Developer configures for production
- **GIVEN** a developer reads `.env.example`
- **WHEN** they copy it to `.env` and set values
- **THEN** backend uses `OPENCODE_URL` for REST API calls
- **AND** frontend uses `VITE_API_URL` for backend REST calls
- **AND** frontend uses `VITE_OPENCODE_URL` for direct SSE connection
