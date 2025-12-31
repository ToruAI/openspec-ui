## ADDED Requirements

### Requirement: Connection Status Indicator
The system SHALL display the connection status to backend and OpenCode services.

#### Scenario: All services connected
- **GIVEN** the backend is running and OpenCode is reachable
- **WHEN** the user views the application
- **THEN** a green status indicator is shown
- **AND** hovering shows "Connected" tooltip

#### Scenario: OpenCode disconnected
- **GIVEN** the backend is running but OpenCode is unreachable
- **WHEN** the user views the application
- **THEN** a yellow/orange status indicator is shown
- **AND** a warning message indicates OpenCode is unavailable
- **AND** the send button is disabled or shows warning

#### Scenario: Backend disconnected
- **GIVEN** the backend is not reachable
- **WHEN** the user views the application
- **THEN** a red status indicator is shown
- **AND** an error message indicates the backend is down
- **AND** a retry button is available

#### Scenario: Connection restored
- **GIVEN** services were disconnected
- **WHEN** connectivity is restored
- **THEN** the status indicator updates to green
- **AND** functionality is re-enabled
