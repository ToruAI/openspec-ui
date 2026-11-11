# Proposal

## Why

Failed webhook deliveries are retried every 30 seconds for 10 attempts, so any outage longer than five minutes drops events permanently. When fulfilment was down for 40 minutes last month, 212 paid orders were never marked as paid.

## What Changes

- Retry with exponential backoff and jitter for up to 72 hours
- Add a dead-letter state and a replay endpoint for dropped events
- Pause an endpoint automatically after 20 consecutive failures

## Capabilities

### New Capabilities


### Modified Capabilities
- `webhooks`: Delivery guarantees: retry schedule, dead-lettering and manual replay

## Impact

- `webhook_deliveries` gains attempt count and next_attempt_at
- Worker scheduler changes from a fixed ticker to a due-time query
- Ops dashboard shows dead-lettered deliveries
