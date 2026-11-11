# Proposal

## Why

The `idempotency_keys` table grew to 140 million rows in three months and now dominates storage. Keys are only useful for the duration of a client retry loop, which is minutes, not forever.

## What Changes

- Expire keys 24 hours after creation
- Delete expired keys in nightly batches
- Treat a key reused after expiry as a brand new request, whatever the body

## Capabilities

### New Capabilities


### Modified Capabilities
- `idempotency`: Define key lifetime

## Impact

- Nightly cleanup job
- Expected 95% reduction in table size
- Client SDK docs updated to state the 24 hour window
