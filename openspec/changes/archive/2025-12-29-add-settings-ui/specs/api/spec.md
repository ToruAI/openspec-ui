## ADDED Requirements

### Requirement: Configuration API
The API SHALL provide endpoints to retrieve the current application configuration.

#### Scenario: Get Configuration
- **When** a client requests `GET /api/config`,
- **Then** return the full current configuration including sources and port.

### Requirement: Source Updates
The API SHALL support updating the source list at runtime and hot-reloading the configuration.

#### Scenario: Update Sources (Hot Reload)
- **When** a client requests `PUT /api/config/sources` with a list of sources,
- **Then** validate that all source paths exist.
- **If** valid:
    - Update the in-memory configuration.
    - Persist changes to `openspec-ui.json`.
    - Restart/Update file watchers to monitor the new paths.
    - Return `200 OK` with the updated configuration.
- **If** invalid:
    - Return `400 Bad Request` with details about which path is invalid.
    - Do not update configuration or watchers.
