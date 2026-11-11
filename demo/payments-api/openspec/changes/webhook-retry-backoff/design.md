# Design

## Context

Deliveries are rows polled by the worker every second. Retry timing is hard-coded in the worker loop, and there is no concept of a permanently failed delivery.

## Goals / Non-Goals

**Goals:**
- No event is lost during outages up to 72 hours
- Recovering subscribers are not hit by a thundering herd

**Non-Goals:**
- Ordering guarantees between events
- Per-subscriber custom retry policies

## Decisions

**Schedule: 10s, 1m, 5m, 30m, 2h, then every 6h, each with up to 20% jitter.** Covers short blips quickly while capping total attempts near 15 over 72 hours.

**Pause instead of delete.** An endpoint that fails 20 times in a row is paused and the owner is notified; queued events stay and flow again when it is resumed.

**Replay by event id.** Dead-lettered events can be re-queued with one call, which is safer than manual SQL.

## Risks / Trade-offs

- Duplicate deliveries are possible, so receivers must dedupe by event id; documented in the integration guide
