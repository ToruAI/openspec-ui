# Design

## Context

About 60 secrets across three services and CI. Some are duplicated between CI variables and cluster secrets and have drifted.

## Goals / Non-Goals

**Goals:**
- Single source of truth with audit history
- Rotation without a deploy

**Non-Goals:**
- Replacing per-service API keys issued to customers
- Hardware-backed keys

## Decisions

**External secrets operator over a sidecar.** No extra process per pod; the operator refreshes secrets and pods pick them up on restart, which fits our rollout tooling.

**Path per service and environment.** Policies are per path, so staging cannot read production values.

## Risks / Trade-offs

- The secrets service becomes a dependency of pod startup; mitigated by cached last-known values in the cluster
