# Design

## Context

Orders copy the address into the order row, so editing a saved address never changes past orders. Address validation already exists in the checkout form and should be reused.

## Goals / Non-Goals

**Goals:**
- One-tap checkout address for returning customers
- Reuse the existing validation rules

**Non-Goals:**
- Address autocomplete from a third-party service
- Multiple recipients per order

## Decisions

**Snapshot addresses onto orders.** Orders keep their own copy so deleting a saved address cannot break order history or invoices.

**Hard limit of 5 addresses.** Keeps the picker usable without a search box; revisit if support hears otherwise.

## Risks / Trade-offs

- Customers with a stale default address ship to the wrong place; the confirm step always shows the address in full
