# Design

## Context

Card payments settle in seconds, so the order system treats succeeded as final. A SEPA debit can be reversed for up to 8 weeks after settlement and fails asynchronously within 5 business days.

## Goals / Non-Goals

**Goals:**
- Accept debits without releasing goods before funds are likely safe
- Reuse the intent API so clients change little

**Non-Goals:**
- Other bank methods (iDEAL, Bancontact)
- Recurring debits

## Decisions

**Release goods when the intent reaches processing.** We accept the reversal risk for orders under 300 EUR, backed by a per-customer limit; larger debit orders wait for succeeded.

**Mandate is its own entity.** Mandates outlive a payment and must be shown on request, so they are stored separately with the acceptance evidence.

## Risks / Trade-offs

- Dispute and reversal handling is new for support
- Delayed failures produce unpaid shipped orders; the limit above caps exposure
