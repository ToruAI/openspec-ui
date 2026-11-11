# Proposal

## Why

Signed-in customers retype their shipping address on every order. Repeat buyers are 38% of revenue, and address entry is the slowest step of checkout.

## What Changes

- Let customers save up to 5 addresses in their account
- Preselect the default address at checkout
- Offer to save a new address after a successful order

## Capabilities

### New Capabilities


### Modified Capabilities
- `checkout`: Guest checkout stays as is; signed-in checkout gains saved addresses

## Impact

- New `addresses` table
- Account page gains an "Addresses" section
- Checkout address step reads from saved addresses
