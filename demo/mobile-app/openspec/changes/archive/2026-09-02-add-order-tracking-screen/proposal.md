# Proposal

## Why

"Where is my order?" is our top support topic. Customers must open an email to find the tracking link, which the app could show directly.

## What Changes

- Add an Orders tab listing recent orders with status
- Add an order detail screen with a delivery timeline
- Open the carrier tracking page from the detail screen

## Capabilities

### New Capabilities
- `order-tracking`: Order list, status timeline and carrier tracking

### Modified Capabilities


## Impact

- New Orders tab in the bottom navigation
- Uses existing `/orders` and `/orders/{id}/shipments` endpoints
