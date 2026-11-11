# Spec Delta

## Purpose
Specifies how payment events are delivered to subscribers and how receivers can trust them.

## ADDED Requirements

### Requirement: Signed deliveries
Every webhook delivery SHALL carry a signature header computed as HMAC-SHA256 over the timestamp and the raw body using the endpoint secret.

#### Scenario: Valid signature
- **WHEN** a subscriber recomputes the HMAC with its secret
- **THEN** the result equals the signature header

### Requirement: Replay window
Receivers MUST reject deliveries whose timestamp is older than 5 minutes.

#### Scenario: Old delivery
- **WHEN** a delivery arrives with a timestamp 10 minutes old
- **THEN** the receiver responds 400 and does not process it
