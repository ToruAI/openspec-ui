# configuration Specification

## Purpose
Environment-based configuration for backend and frontend URLs, allowing deployment flexibility.
## Requirements
### Requirement: Backend OpenCode URL Configuration
The backend SHALL read the OpenCode server URL from the `OPENCODE_URL` environment variable.

#### Scenario: Custom OpenCode URL configured
- **GIVEN** the environment variable `OPENCODE_URL` is set to `http://myserver:4096`
- **WHEN** the backend starts
- **THEN** the backend connects to `http://myserver:4096` for OpenCode API calls
- **AND** the configured URL is logged on startup

#### Scenario: Default OpenCode URL used
- **GIVEN** the environment variable `OPENCODE_URL` is not set
- **WHEN** the backend starts
- **THEN** the backend defaults to `http://127.0.0.1:4096`

### Requirement: Frontend API URL Configuration
The frontend SHALL read the backend API URL from the `VITE_API_URL` environment variable.

#### Scenario: Custom API URL configured
- **GIVEN** the environment variable `VITE_API_URL` is set to `http://mybackend:8080`
- **WHEN** the frontend is built or started in dev mode
- **THEN** all API calls use `http://mybackend:8080` as the base URL

#### Scenario: Default API URL used
- **GIVEN** the environment variable `VITE_API_URL` is not set
- **WHEN** the frontend is built or started in dev mode
- **THEN** the frontend defaults to `http://localhost:8080`

### Requirement: Configuration Documentation
The project SHALL provide documentation for all configuration options.

#### Scenario: Developer configures for production
- **GIVEN** a developer reads `.env.example`
- **WHEN** they copy it to `.env` and set values
- **THEN** backend uses `OPENCODE_URL` for REST API calls
- **AND** frontend uses `VITE_API_URL` for backend REST calls
- **AND** frontend uses `VITE_OPENCODE_URL` for direct SSE connection

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

