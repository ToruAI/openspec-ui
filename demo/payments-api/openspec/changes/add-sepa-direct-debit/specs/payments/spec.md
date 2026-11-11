# Spec Delta

## MODIFIED Requirements

### Requirement: Payment state history
Every state change of a payment intent MUST be recorded as an event with a timestamp and its cause. For delayed-settlement methods, the processing state MAY last up to 5 business days.

#### Scenario: Success is recorded
- **WHEN** the provider reports a successful charge
- **THEN** a payment_events row with state succeeded is written

#### Scenario: Long processing
- **WHEN** a SEPA debit has been submitted
- **THEN** the intent stays in processing and each provider update is recorded
