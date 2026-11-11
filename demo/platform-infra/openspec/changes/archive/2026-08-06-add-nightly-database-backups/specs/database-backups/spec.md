# Spec Delta

## Purpose
States how often production databases are backed up, where copies live and how recovery is proven.

## ADDED Requirements

### Requirement: Point-in-time recovery
Production databases SHALL support recovery to any point within the last 14 days with a recovery point objective of 5 minutes.

#### Scenario: Recover to a timestamp
- **WHEN** an engineer requests a restore to 10 minutes ago
- **THEN** a new instance is available at that state within one hour

### Requirement: Independent nightly copy
A logical backup MUST be written every night to storage in a different account and region, and the system SHALL alert when the newest backup is older than 26 hours.

#### Scenario: Missed backup
- **WHEN** no new backup object exists 26 hours after the last one
- **THEN** an alert is sent to the on-call channel
