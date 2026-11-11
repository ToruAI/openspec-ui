# Proposal

## Why

Carts live in React state, so a refresh or a switch from phone to laptop empties them. Support reported 40 tickets last month from customers who lost a cart.

## What Changes

- Persist the cart server-side, keyed by an anonymous cart cookie
- Merge the anonymous cart into the account cart on login
- Expire carts after 30 days of inactivity

## Capabilities

### New Capabilities
- `shopping-cart`: Cart contents that survive reloads, devices and login

### Modified Capabilities


## Impact

- New `carts` and `cart_items` tables
- Cart API replaces the client-side store
