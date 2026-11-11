# Proposal

## Why

Application secrets are Kubernetes Secret objects created by hand with kubectl. There is no record of who changed what, and rotating the database password last quarter took two days.

## What Changes

- Store secrets in a managed secrets service with versioning and audit logs
- Sync them into pods through the external secrets operator
- Remove secret values from CI variables and from Helm values files

## Capabilities

### New Capabilities
- `secrets-management`: Where secrets live, who can read them and how they change

### Modified Capabilities


## Impact

- All services mount secrets through the operator
- CI runs read secrets by short-lived role, not stored tokens
