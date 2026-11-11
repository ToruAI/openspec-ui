# Proposal

## Why

Backups rely on the managed provider's default daily snapshot with seven-day retention. Nobody has ever restored one, and payments-api cannot lose more than a few minutes of data.

## What Changes

- Enable point-in-time recovery with a 14 day window
- Take a nightly logical dump to a separate bucket in another region
- Alert when a backup is older than 26 hours

## Capabilities

### New Capabilities
- `database-backups`: Backup schedule, retention and recovery objectives

### Modified Capabilities


## Impact

- New bucket and lifecycle rules in Terraform
- Monthly cost increase of about 40 EUR
