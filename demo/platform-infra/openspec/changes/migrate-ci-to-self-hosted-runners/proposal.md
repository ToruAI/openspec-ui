# Proposal

## Why

CI on hosted runners costs 1,900 EUR a month and a median pipeline takes 14 minutes, mostly dependency installs and container builds on cold machines. Developers batch their pushes to avoid waiting, which makes reviews bigger.

## What Changes

- Run CI jobs on autoscaled runners inside our cluster with a persistent build cache
- Keep hosted runners as a fallback for the first month
- Label jobs by size so heavy builds do not starve quick lint jobs

## Capabilities

### New Capabilities


### Modified Capabilities


## Impact

- No change to what the pipeline does, only where it runs, so this change carries no spec deltas
- New node pool for runners (spot instances)
- Estimated spend of 700 EUR a month
