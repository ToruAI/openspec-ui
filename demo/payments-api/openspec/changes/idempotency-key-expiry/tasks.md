# Tasks

## 1. Implementation

- [x] 1.1 Add expires_at column with default now() + 24h
- [x] 1.2 Ignore expired keys in the lookup
- [x] 1.3 Nightly batch delete of expired keys (10k rows per batch)

## 2. Verification

- [x] 2.1 Backfill expires_at for existing keys
- [x] 2.2 Dashboard for table size and cleanup lag
- [x] 2.3 Update client SDK docs
