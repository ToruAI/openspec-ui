# Proposal

## Why

The storefront and the fulfilment service receive payment webhooks from us as plain POSTs. Anyone who finds the URL can mark an order as paid.

## What Changes

- Sign every outgoing webhook with HMAC-SHA256
- Include a timestamp and reject deliveries older than 5 minutes
- Add a signing secret per subscriber with rotation

## Capabilities

### New Capabilities
- `webhooks`: Outgoing event delivery to internal and merchant subscribers

### Modified Capabilities


## Impact

- New `webhook_endpoints` table with secrets
- Storefront and fulfilment verify signatures before processing
