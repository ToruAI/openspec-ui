## ADDED Requirements

### Requirement: Port Configuration UI
The Settings UI SHALL allow users to modify the server port.

#### Scenario: Changing Port
- **Given** the Settings modal is open,
- **When** I change the "Port" value (e.g., from 3000 to 4000),
- **Then** a warning message appears: "Changing the port requires a server restart."

#### Scenario: Saving Port
- **Given** I have modified the Port value,
- **When** I click "Save",
- **Then** the new port is saved to the configuration file.
- **And** the UI shows a success message instructing me to restart the server manually.
- **And** the current session continues running on the old port until that restart happens.
