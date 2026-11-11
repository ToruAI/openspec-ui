# Proposal

## Why

Checkout requires an account. Analytics show 58% of carts are abandoned at the "Create account" step.

## What Changes

- Let visitors check out with only an email address
- Send an order confirmation email with a tracking link
- Offer account creation after payment instead of before

## Capabilities

### New Capabilities
- `checkout`: Collect shipping details, pay and confirm an order

### Modified Capabilities


## Impact

- Checkout flow reduced from 4 steps to 3
- `orders.customer_id` becomes nullable; guest orders store the email
