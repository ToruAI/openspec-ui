# Proposal

## Why

Reviewers cannot see UI changes without checking out the branch. Everything is verified on the single shared staging environment, which is often broken by someone else's half-merged work.

## What Changes

- Create a short-lived environment per pull request in the cluster
- Post the preview URL on the pull request
- Delete the environment when the pull request closes or after 7 days

## Capabilities

### New Capabilities
- `ci-pipeline`: Build, test and preview behaviour for pull requests

### Modified Capabilities


## Impact

- New namespace-per-PR Helm release
- Wildcard DNS and certificate for preview hostnames
- Cluster capacity reserved for about 10 concurrent previews
