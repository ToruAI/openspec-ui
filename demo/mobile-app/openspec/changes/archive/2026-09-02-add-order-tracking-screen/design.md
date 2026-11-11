# Design

## Context

Shipment status comes from the carrier via the fulfilment service and can lag by hours. The web storefront already normalises carrier statuses into five states.

## Goals / Non-Goals

**Goals:**
- Show the same five states as the web
- Make "delivered today" obvious at a glance

**Non-Goals:**
- Live map tracking
- Changing the delivery address from the app

## Decisions

**Pull on focus, no polling.** The list refreshes when the tab gains focus or on pull-to-refresh; polling would drain battery for little gain with hourly carrier updates.

**Timeline as a vertical stepper.** Matches the web layout and reads well with large fonts and screen readers.

## Risks / Trade-offs

- Carrier delays make status look stale; the screen shows "last updated" time to set expectations
