# authentication Specification

## Purpose
Defines how customers sign in to the app and how the session is kept and ended.

## Requirements

### Requirement: Email sign-in
The app SHALL let a customer sign in with email and password and land on the screen they were trying to open.

#### Scenario: Valid credentials
- **WHEN** a customer enters a correct email and password
- **THEN** the app stores the session and opens the originally requested screen

#### Scenario: Wrong password
- **WHEN** a customer enters a wrong password
- **THEN** an inline error is shown and the password field is cleared

### Requirement: Secure session storage
The app MUST store the session token only in the iOS Keychain or Android Keystore-backed storage.

#### Scenario: Token location
- **WHEN** a customer signs in
- **THEN** no session token is written to AsyncStorage or application logs
