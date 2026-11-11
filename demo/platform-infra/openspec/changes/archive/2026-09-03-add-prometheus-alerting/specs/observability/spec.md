# Spec Delta

## Purpose
Defines which signals page a human, who receives them and how fast they must be acknowledged.

## ADDED Requirements

### Requirement: Paging alerts
The platform SHALL page the on-call engineer when a customer-facing service has an error rate above 2% for 5 minutes or a p95 latency above 1.5 s for 10 minutes.

#### Scenario: Error spike
- **WHEN** checkout requests fail at 4% for 6 minutes
- **THEN** the on-call engineer is paged with a link to the service dashboard

### Requirement: Escalation
An unacknowledged page MUST escalate to the secondary on-call after 10 minutes.

#### Scenario: No acknowledgement
- **WHEN** the primary on-call does not acknowledge within 10 minutes
- **THEN** the secondary on-call is paged
