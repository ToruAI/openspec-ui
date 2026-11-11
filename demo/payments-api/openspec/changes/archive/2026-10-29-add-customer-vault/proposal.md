# Proposal

## Why

Returning customers re-enter their card every time because we hold no reference to a saved payment method.

## What Changes

- Create a customer record per account with provider tokens only
- List and detach saved payment methods
- Use a saved method when confirming an intent

## Capabilities

### New Capabilities
- `customers`: Customer records and saved payment methods (tokens only)

### Modified Capabilities


## Impact

- New `customers` and `payment_methods` tables
- No card numbers are stored; only provider tokens and last4/brand for display
