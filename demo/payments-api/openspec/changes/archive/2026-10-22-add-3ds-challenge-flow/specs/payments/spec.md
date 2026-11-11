# Spec Delta

## ADDED Requirements

### Requirement: Customer authentication challenge
When the issuer requests 3-D Secure, the API SHALL move the intent to requires_action and return the challenge URL, and MUST resume the intent when the challenge result is reported.

#### Scenario: Challenge required
- **WHEN** the issuer requests authentication during confirm
- **THEN** the intent is requires_action and the response includes a challenge_url

#### Scenario: Challenge abandoned
- **WHEN** the customer does not finish within 15 minutes
- **THEN** the intent moves to failed with reason authentication_timeout
