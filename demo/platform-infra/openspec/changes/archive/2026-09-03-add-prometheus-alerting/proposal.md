# Proposal

## Why

We learn about outages from customers. Metrics are collected but there are no alerts, and the on-call phone has never rung.

## What Changes

- Define alert rules for error rate, latency and saturation per service
- Route pages to on-call and warnings to a team channel
- Add a weekly rotation schedule and an escalation path

## Capabilities

### New Capabilities
- `observability`: Metrics-based alerting and routing

### Modified Capabilities


## Impact

- New Alertmanager config and rule files
- Each service repo owns its own rules in a shared format
