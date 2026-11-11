# Tasks

## 1. Schema

- [x] 1.1 Add attempt_count and next_attempt_at to webhook_deliveries
- [x] 1.2 Add dead_lettered status
- [x] 1.3 Add paused_at to webhook_endpoints

## 2. Worker

- [x] 2.1 Replace fixed ticker with due-time query
- [x] 2.2 Implement backoff schedule with jitter
- [ ] 2.3 Re-sign each retry with a fresh timestamp
- [ ] 2.4 Pause endpoints after 20 consecutive failures

## 3. Operations

- [ ] 3.1 Replay endpoint for dead-lettered events
- [ ] 3.2 Dead-letter panel in the ops dashboard
- [ ] 3.3 Document dedupe-by-event-id for receivers
- [ ] 3.4 Load test recovery of 50k queued events
