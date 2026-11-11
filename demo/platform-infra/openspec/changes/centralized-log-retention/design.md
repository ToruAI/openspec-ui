# Design

## Context

Services write JSON logs to stdout; an agent ships them with no classification. Payments audit entries are mixed with debug lines and indistinguishable once shipped.

## Goals / Non-Goals

**Goals:**
- Each log line has exactly one retention class
- Audit logs are never dropped by a cost-saving rule

**Non-Goals:**
- Changing the log store
- Redacting historical logs

## Decisions

**Class decided by the emitting service.** Services know which events are audit events; the pipeline does not guess, and unlabelled lines default to the 30 day application class.

**Archive tier for audit logs.** After 30 days audit logs move to object storage with an index; queries are slower but rare.

## Risks / Trade-offs

- A service forgetting the audit label loses the line after 30 days; a CI check lists known audit events and fails if they are unlabelled
