## MODIFIED Requirements

### Requirement: Source Path Validation
The system SHALL validate source paths and monitor directories for file changes.

#### Scenario: Ideas directory monitoring
- **WHEN** a source path includes an `ideas/` directory
- **THEN** the system watches for changes in the `ideas/` directory alongside `changes/` and `specs/`

#### Scenario: Ideas directory listing
- **WHEN** scanning a source directory
- **THEN** the system recognizes and parses ideas from the `ideas/` directory if it exists
