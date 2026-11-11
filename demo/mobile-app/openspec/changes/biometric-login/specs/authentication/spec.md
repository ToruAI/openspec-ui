# Spec Delta

## ADDED Requirements

### Requirement: Biometric unlock
The app SHALL let a signed-in customer enable biometric unlock, and MUST then require a successful biometric check to resume an expired session.

#### Scenario: Offer after sign-in
- **WHEN** a customer signs in with a password on a device with enrolled biometrics
- **THEN** the app offers to enable biometric unlock

#### Scenario: Enrollment changed
- **WHEN** the customer adds a new fingerprint to the device
- **THEN** biometric unlock is disabled and the next sign-in uses the password

#### Scenario: Three failures
- **WHEN** biometric verification fails three times
- **THEN** the app falls back to the password screen
