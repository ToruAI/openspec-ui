# Spec Delta

## ADDED Requirements

### Requirement: Log retention classes
Every log line SHALL belong to one retention class, and the platform MUST keep debug logs 7 days, application logs 30 days and audit logs 12 months.

#### Scenario: Debug log expires
- **WHEN** a debug log line is 8 days old
- **THEN** it is no longer searchable

#### Scenario: Audit log kept
- **WHEN** an audit log line is 11 months old
- **THEN** it can be retrieved from the archive within 15 minutes

#### Scenario: Unlabelled line
- **WHEN** a service emits a line without a class
- **THEN** it is treated as application and kept 30 days
