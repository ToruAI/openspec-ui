# Spec Delta

## ADDED Requirements

### Requirement: Key expiry
The API SHALL treat an Idempotency-Key as unknown 24 hours after its first use, and MUST execute a request that reuses an expired key as a new request.

#### Scenario: Within window
- **WHEN** a client repeats a key 3 hours after first use
- **THEN** the stored response is replayed

#### Scenario: After window
- **WHEN** a client repeats a key 30 hours after first use
- **THEN** the request is processed as new and a new response is stored
