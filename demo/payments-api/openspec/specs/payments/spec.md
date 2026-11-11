# payments Specification

## Purpose
Defines how a card payment is created, confirmed and reported back to clients.

## Requirements

### Requirement: Create payment intent
The API SHALL create a payment intent for a positive amount and a supported currency and return its id and a client secret.

#### Scenario: Valid request
- **WHEN** a client posts amount 2450 and currency EUR
- **THEN** the response is 201 with an intent in state requires_payment

#### Scenario: Zero amount
- **WHEN** a client posts amount 0
- **THEN** the response is 422 with error code amount_too_small

### Requirement: Payment state history
Every state change of a payment intent MUST be recorded as an event with a timestamp and its cause.

#### Scenario: Success is recorded
- **WHEN** the provider reports a successful charge
- **THEN** a payment_events row with state succeeded is written

### Requirement: Customer authentication challenge
When the issuer requests 3-D Secure, the API SHALL move the intent to requires_action and return the challenge URL, and MUST resume the intent when the challenge result is reported.

#### Scenario: Challenge required
- **WHEN** the issuer requests authentication during confirm
- **THEN** the intent is requires_action and the response includes a challenge_url

#### Scenario: Challenge abandoned
- **WHEN** the customer does not finish within 15 minutes
- **THEN** the intent moves to failed with reason authentication_timeout
