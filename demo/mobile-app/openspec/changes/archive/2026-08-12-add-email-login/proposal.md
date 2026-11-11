# Proposal

## Why

The first app release shipped with guest browsing only. Customers cannot see their orders or saved items in the app, which is the most requested feature in store reviews.

## What Changes

- Add email and password sign-in and sign-up screens
- Store the session token in the platform keychain
- Add password reset via the existing web flow

## Capabilities

### New Capabilities
- `authentication`: Signing in, staying signed in and signing out

### Modified Capabilities


## Impact

- New auth stack and navigation guard
- Backend session endpoint reused from the web storefront
