# Proposal

## Why

Customers who sign in on a phone retype a password they barely remember every time the session expires, and 22% of failed sign-ins end in a reset email. Both platforms offer biometric unlock that the app ignores.

## What Changes

- Offer to enable Face ID, Touch ID or fingerprint after the next successful password sign-in
- Unlock a stored refresh token with biometrics instead of asking for the password
- Fall back to password after 3 failed biometric attempts or when enrollment changes

## Capabilities

### New Capabilities


### Modified Capabilities
- `authentication`: Adds biometric unlock as a way to resume a session

## Impact

- Native module for biometric prompts on both platforms
- Backend issues a device-bound refresh token
- Settings gains a "Biometric unlock" toggle
