# Design

## Context

The provider supports multiple partial refunds per charge but allows only one refund in flight at a time. Refund requests from support can arrive in bursts when an order is closed.

## Goals / Non-Goals

**Goals:**
- Several partial refunds per payment, never exceeding the captured amount
- Safe to retry from the support console

**Non-Goals:**
- Refunds to a different payment method
- Automatic refunds for returns

## Decisions

**Balance is computed from refund rows.** No mutable "refunded_total" column; the sum of non-failed refunds is the source of truth, checked inside the insert transaction.

**Serialise refunds per intent.** A row lock on the intent avoids provider "refund in progress" errors and double-spending the balance.

**Reuse idempotency keys.** Refund creation goes through the same middleware as intents, so retries from the console are safe.

## Risks / Trade-offs

- Lock contention if a bulk close refunds many items at once; the worker batches them per intent
