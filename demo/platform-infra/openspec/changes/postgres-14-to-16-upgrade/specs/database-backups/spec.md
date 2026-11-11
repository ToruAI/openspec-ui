# Spec Delta

## ADDED Requirements

### Requirement: Restore verification after major changes
After every major database version change or backup configuration change, the team SHALL restore the newest backup into a scratch instance and verify row counts of the largest tables, and MUST record the result before the old instance is retired.

#### Scenario: Verification after upgrade
- **WHEN** production moves to a new major version
- **THEN** a restore into a scratch instance is done and its result is recorded in the change before decommissioning

#### Scenario: Verification fails
- **WHEN** row counts differ by more than 0.1%
- **THEN** the old instance is kept and an incident is opened
