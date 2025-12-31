## ADDED Requirements

### Requirement: Port Configuration API
The API SHALL support updating the server port in the persisted configuration.

#### Scenario: Update Port
- **When** a client sends a configuration update that includes a new `port` value,
- **Then** validate the port is a valid u16 integer (1-65535).
- **And** persist the change to `openspec-ui.json`.
- **But** DO NOT attempt to re-bind the server socket at runtime (server continues on old port).
