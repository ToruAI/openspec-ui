# Design

## Context

The production database is 380 GB with about 200 writes per second. payments-api cannot lose committed writes and must not serve stale reads after cutover.

## Goals / Non-Goals

**Goals:**
- Under 10 minutes write downtime
- Instant rollback path until the old instance is retired

**Non-Goals:**
- Schema changes
- Switching to a different provider

## Decisions

**Logical replication over in-place upgrade.** The in-place path needs an hour of downtime. Replication lets us build and test the new instance while production keeps serving.

**Reverse replication after cutover.** New writes flow back to the old instance for 14 days, so rolling back does not lose data.

## Risks / Trade-offs

- Sequences are not replicated; we reset them with a safety margin during cutover
- Extension versions differ; tested during rehearsals
