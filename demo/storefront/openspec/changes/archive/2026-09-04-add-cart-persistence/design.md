# Design

## Context

The current cart is a Zustand store seeded from localStorage. Prices are re-read from the catalog on every render, so a stored cart never holds stale prices.

## Goals / Non-Goals

**Goals:**
- Cart survives refresh, new tab and login
- No visible flicker on first paint

**Non-Goals:**
- Cross-device sync for anonymous visitors
- Reserving stock while an item is in a cart

## Decisions

**Server-side storage over localStorage.** localStorage cannot follow a customer to a second device, and merge-on-login needs the server anyway.

**Cart cookie is httpOnly.** The cart id is opaque and only the API reads it, which keeps it out of reach of third-party scripts.

## Risks / Trade-offs

- Extra round trip on first paint; mitigated by inlining the cart summary in the layout response
