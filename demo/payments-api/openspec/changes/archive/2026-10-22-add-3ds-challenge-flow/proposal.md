# Proposal

## Why

EU card payments above the SCA threshold fail with a generic error when the bank asks for 3-D Secure. About 6% of EUR orders are lost this way.

## What Changes

- Add a `requires_action` intent state carrying the challenge URL
- Resume the intent when the challenge completes
- Time out abandoned challenges after 15 minutes

## Capabilities

### New Capabilities


### Modified Capabilities
- `payments`: Intents can require customer action before they succeed

## Impact

- Intent state machine gains one state
- Storefront and mobile-app render the challenge in a sheet or redirect
