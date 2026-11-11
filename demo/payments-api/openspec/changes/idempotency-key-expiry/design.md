# Design

## Context

Keys are inserted on first use and never touched again. Lookups hit a unique index on (merchant_id, key); deleting old rows in one statement would lock the table for minutes.

## Goals / Non-Goals

**Goals:**
- Bound table growth
- No customer-visible change for clients that retry within minutes

**Non-Goals:**
- Partitioning the table
- Per-merchant retention settings

## Decisions

**24 hours, not 7 days.** Our slowest client retry loop (mobile on poor networks) gives up after 30 minutes; 24 hours leaves a wide margin and matches the provider's own window.

**Expiry checked on read, deleted in batches.** Lookups ignore expired rows immediately, so correctness never depends on the cleanup job; the job deletes 10k rows per batch with a short sleep to avoid replica lag.

## Risks / Trade-offs

- A client that retries after more than 24 hours will repeat the operation; documented in the API guide
