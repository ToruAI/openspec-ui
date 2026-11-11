# Spec Delta

## Purpose
Describes refunding all or part of a succeeded payment, and how the remaining balance is protected.

## ADDED Requirements

### Requirement: Partial refund
The API SHALL create a refund for any amount between 1 and the unrefunded balance of a succeeded payment.

#### Scenario: Refund part of a payment
- **WHEN** a payment of 4500 EUR cents has no refunds and a refund of 1500 is requested
- **THEN** the refund is created and the intent shows 3000 refundable

#### Scenario: Refund exceeds balance
- **WHEN** only 1000 remains refundable and 1500 is requested
- **THEN** the response is 422 with error code refund_exceeds_balance

### Requirement: Refund notifications
The system MUST emit a refund.succeeded or refund.failed webhook once the provider reports the final refund result.

#### Scenario: Provider confirms refund
- **WHEN** the provider reports a refund as succeeded
- **THEN** a refund.succeeded webhook is queued for all subscribers
