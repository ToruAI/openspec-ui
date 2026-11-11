# Design

## Context

The session token currently lives in the keychain and expires after 30 days. When it expires the customer has to sign in with email and password.

## Goals / Non-Goals

**Goals:**
- One-touch resume after the session token expires
- No weaker than password sign-in

**Non-Goals:**
- Biometrics for payments
- Passkeys (considered for a later change)

## Decisions

**Biometric-protected keychain item.** The refresh token is stored with access control that requires biometric presence, so the OS enforces the check rather than app code.

**Invalidate on enrollment change.** If someone adds a fingerprint to the device, the stored token becomes unreadable and the customer signs in with a password again.

**Use the platform library.** A maintained wrapper around LocalAuthentication and BiometricPrompt, instead of custom native code.

## Risks / Trade-offs

- Android devices with weak biometrics; only Class 3 (strong) biometrics are accepted
- Support load from customers locked out after a new phone; the password path always remains
