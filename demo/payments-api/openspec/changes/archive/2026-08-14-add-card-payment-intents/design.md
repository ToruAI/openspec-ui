# Design

## Context

Providers model a payment as a mutable object; our order system wants an append-only history. We need one internal state machine that both can read.

## Goals / Non-Goals

**Goals:**
- One internal payment state machine
- Provider-agnostic API for clients

**Non-Goals:**
- Saved cards
- Payouts and reconciliation

## Decisions

**Intent states: requires_payment, processing, succeeded, failed, canceled.** Maps cleanly onto both provider models and keeps the order system free of provider terms.

**Transitions are rows, not updates.** A `payment_events` row is written for every state change, which gives us the audit trail for free.

## Risks / Trade-offs

- State drift if a provider event is missed; the nightly reconcile job added later closes this gap
