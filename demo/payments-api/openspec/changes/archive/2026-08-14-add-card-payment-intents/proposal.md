# Proposal

## Why

The storefront creates charges directly against the provider, which splits payment logic across two codebases and makes the mobile app impossible to launch without copying it.

## What Changes

- Add `POST /v1/payment-intents` and `POST /v1/payment-intents/{id}/confirm`
- Store intent state transitions in Postgres
- Return client secrets for the provider SDKs

## Capabilities

### New Capabilities
- `payments`: Create, confirm and track card payments

### Modified Capabilities


## Impact

- New `payment_intents` table
- Storefront switches from direct provider calls to this API
