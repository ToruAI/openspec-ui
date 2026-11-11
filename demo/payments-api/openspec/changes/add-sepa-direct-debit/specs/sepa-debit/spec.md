# Spec Delta

## Purpose
Covers accepting SEPA Direct Debit payments, including mandate evidence and delayed results.

## ADDED Requirements

### Requirement: Mandate acceptance
The API SHALL require a recorded mandate acceptance with timestamp and customer IP before confirming a SEPA debit intent.

#### Scenario: Missing acceptance
- **WHEN** a client confirms a SEPA intent without mandate acceptance
- **THEN** the response is 422 with error code mandate_required

### Requirement: Delayed failure
The system MUST move a processing SEPA intent to failed and notify subscribers if the bank rejects the debit within 5 business days.

#### Scenario: Bank rejects debit
- **WHEN** the provider reports insufficient funds on day 3
- **THEN** the intent becomes failed with reason insufficient_funds and a payment.failed webhook is sent
