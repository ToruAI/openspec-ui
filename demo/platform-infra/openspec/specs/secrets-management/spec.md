# secrets-management Specification

## Purpose
Sets the rules for storing, reading and rotating application and infrastructure secrets.

## Requirements

### Requirement: Central secret store
Production secrets SHALL be stored only in the managed secrets service and MUST NOT appear in source control, CI variables or Helm values.

#### Scenario: Secret scan
- **WHEN** a pull request adds a value matching a known secret pattern
- **THEN** the pipeline fails and names the file

### Requirement: Audited access
Every read and write of a production secret MUST be logged with the caller identity and retained for 12 months.

#### Scenario: Read is logged
- **WHEN** a service account reads a database password
- **THEN** an audit entry with the account and timestamp is recorded
