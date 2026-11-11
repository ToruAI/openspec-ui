# Proposal

## Why

Logs from all services go to one store with unlimited retention, which now costs 2,300 EUR a month, while the payment audit trail needs 12 months and debug logs are never read after a week. Nobody decided these periods; they are an accident of defaults.

## What Changes

- Classify log streams as debug, application and audit
- Retain debug logs for 7 days, application logs for 30 days and audit logs for 12 months
- Move audit logs to cheaper archive storage after 30 days

## Capabilities

### New Capabilities


### Modified Capabilities
- `observability`: Adds retention classes for logs

## Impact

- Log pipeline gains a class label added by each service
- Expected 70% lower log storage cost
- Services must tag audit events; payments-api first
