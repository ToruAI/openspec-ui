# Proposal

## Why

Refunds are all-or-nothing today. When one item of a three-item order is damaged, support refunds the whole payment and re-charges the customer, or asks engineering to run a script. That is about 30 manual refunds a month.

## What Changes

- Add `POST /v1/payment-intents/{id}/refunds` accepting an amount up to the unrefunded balance
- Track refunded amount per intent and expose it on the intent
- Emit `refund.succeeded` and `refund.failed` webhooks

## Capabilities

### New Capabilities
- `refunds`: Full and partial refunds against a succeeded payment

### Modified Capabilities


## Impact

- New `refunds` table
- Support console gets an amount field on the refund form
- Fulfilment service listens for refund webhooks to restock
