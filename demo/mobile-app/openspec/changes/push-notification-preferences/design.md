# Design

## Context

The notification service sends to every registered device of an opted-in customer. There is no category on a message today; the "shipped" and "delivered" senders call it directly.

## Goals / Non-Goals

**Goals:**
- A category on every message
- One preference store for push and email

**Non-Goals:**
- Quiet hours
- Per-device settings

## Decisions

**Server-side preferences.** Preferences live in the backend, not on the device, so reinstalling the app or switching phones keeps them.

**Transactional messages ignore marketing opt-out.** Delivery updates are tied to an order the customer placed, so they stay on unless the customer switches that category off.

## Risks / Trade-offs

- Legal review needed for the offers category copy and default state (off until opted in)
