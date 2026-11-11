# Tasks

## 1. Data model

- [ ] 1.1 Create refunds table with unique (intent_id, idempotency_key)
- [ ] 1.2 Add refundable_amount to the intent response
- [ ] 1.3 Index refunds by intent and status

## 2. Endpoint

- [ ] 2.1 POST /v1/payment-intents/{id}/refunds
- [ ] 2.2 Row lock the intent while validating balance
- [ ] 2.3 Map provider refund errors to API error codes

## 3. Events

- [ ] 3.1 Emit refund.succeeded and refund.failed webhooks
- [ ] 3.2 Handle provider refund.updated callbacks

## 4. Rollout

- [ ] 4.1 Add amount field to the support console refund form
- [ ] 4.2 Backfill historic full refunds as refund rows
