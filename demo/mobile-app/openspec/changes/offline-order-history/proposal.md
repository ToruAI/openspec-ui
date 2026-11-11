# Proposal

## Why

The Orders tab shows a spinner and then an error without a connection, even though the same data was on screen minutes earlier. Customers check delivery status on the move, often with poor signal, and reviews mention it.

## What Changes

- Cache the last 20 orders and their shipments in local storage
- Show cached data immediately and refresh in the background
- Show an "Offline, last updated 14:05" banner when the refresh fails

## Capabilities

### New Capabilities


### Modified Capabilities
- `order-tracking`: Order list and detail remain usable without connectivity

## Impact

- Local database (SQLite) added for order data
- Cache is cleared on sign-out
- No change to server APIs
