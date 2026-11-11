# Proposal

## Why

A mobile client retried a confirm call after a timeout and a customer was charged twice. The API currently has no way to tell a retry from a new request.

## What Changes

- Accept an `Idempotency-Key` header on all POST endpoints that move money
- Replay the stored response for a repeated key
- Reject a reused key with a different request body

## Capabilities

### New Capabilities
- `idempotency`: Safe retries for money-moving requests

### Modified Capabilities


## Impact

- New `idempotency_keys` table
- Middleware in front of every POST under `/v1`
