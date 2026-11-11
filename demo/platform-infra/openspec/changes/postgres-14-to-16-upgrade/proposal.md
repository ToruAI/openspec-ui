# Proposal

## Why

Postgres 14 reaches end of life in under a year and the provider stops offering patches then. Version 16 also brings faster parallel queries that the order reports need, and improved logical replication that makes this upgrade nearly seamless.

## What Changes

- Upgrade the production database from 14 to 16 using logical replication to a new instance
- Rehearse on a restored copy of production twice before the real cutover
- Verify the backup and restore procedure on the new version

## Capabilities

### New Capabilities


### Modified Capabilities
- `database-backups`: Restore verification becomes a required step after every major version change

## Impact

- New instance and connection strings (secrets rotated through the secrets service)
- Planned maintenance window of 10 minutes on a Sunday morning
- Old instance kept read-only for 14 days
