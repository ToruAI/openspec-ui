# Proposal

## Why

In Germany and the Netherlands, 40% of online shoppers prefer bank-based payment methods, and our card-only checkout converts 11 points lower there than in the rest of the EU.

## What Changes

- Add SEPA Direct Debit as a payment method type on payment intents
- Collect and store the mandate (IBAN token, name, acceptance timestamp)
- Treat a debit as pending for up to 5 business days

## Capabilities

### New Capabilities
- `sepa-debit`: Mandates and delayed-settlement debit payments

### Modified Capabilities
- `payments`: Intents can stay in processing for days and may fail after the customer left

## Impact

- New `mandates` table
- Order system must handle "paid, may still fail" for debit orders
- Storefront adds a bank-debit option behind a per-country flag
