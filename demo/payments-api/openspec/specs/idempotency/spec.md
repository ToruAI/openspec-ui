# idempotency Specification

## Purpose
Guarantees that retrying a request with the same key never repeats its side effects.

## Requirements

### Requirement: Replay stored response
When a request repeats an Idempotency-Key with an identical body, the API SHALL return the original status code and body without executing the operation again.

#### Scenario: Retry after timeout
- **WHEN** a client repeats a confirm request with the same key
- **THEN** the original 200 response is returned and no second charge is made

### Requirement: Key reuse with different body
The API MUST reject a request that reuses an Idempotency-Key with a different body.

#### Scenario: Different body
- **WHEN** a client sends the same key with another amount
- **THEN** the response is 409 with error code idempotency_key_reused
