# Tasks

## 1. Storage

- [x] 1.1 Create idempotency_keys table with request hash
- [x] 1.2 Add unique index on (merchant_id, key)

## 2. Middleware

- [x] 2.1 Hash and compare request bodies
- [x] 2.2 Store and replay responses
- [x] 2.3 Lock concurrent requests that share a key
