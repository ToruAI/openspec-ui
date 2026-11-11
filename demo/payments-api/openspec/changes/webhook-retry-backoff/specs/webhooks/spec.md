# Spec Delta

## ADDED Requirements

### Requirement: Retry with backoff
The system SHALL retry failed deliveries on an exponential schedule with jitter for up to 72 hours before dead-lettering them.

#### Scenario: Subscriber down for an hour
- **WHEN** a subscriber returns 503 for 60 minutes
- **THEN** the event is delivered successfully on the first retry after it recovers

### Requirement: Endpoint auto-pause
The system MUST pause an endpoint after 20 consecutive failed deliveries and keep its pending events queued.

#### Scenario: Twentieth failure
- **WHEN** an endpoint has failed 19 times in a row and fails again
- **THEN** the endpoint is paused and its owner is notified

## MODIFIED Requirements

### Requirement: Replay window
Receivers MUST reject deliveries whose timestamp is older than 5 minutes. Retried deliveries SHALL be re-signed with a fresh timestamp on every attempt.

#### Scenario: Old delivery
- **WHEN** a delivery arrives with a timestamp 10 minutes old
- **THEN** the receiver responds 400 and does not process it

#### Scenario: Retry is re-signed
- **WHEN** a delivery is retried 2 hours after the first attempt
- **THEN** the retry carries a new timestamp and a valid signature
