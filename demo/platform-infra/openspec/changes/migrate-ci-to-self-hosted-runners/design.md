# Design

## Context

The pipeline is defined in the repo and runs unchanged on any runner with the right labels. Jobs currently reinstall all dependencies and rebuild every image layer from scratch.

## Goals / Non-Goals

**Goals:**
- Median pipeline under 6 minutes
- No loss of isolation between jobs

**Non-Goals:**
- Changing CI provider
- Running mobile builds (they need macOS machines)

## Decisions

**Ephemeral runner per job.** Each job gets a fresh pod, so a compromised or messy job cannot affect the next one; the cache lives on a shared volume and in a registry.

**Spot instances with retry.** Interrupted jobs are retried automatically once; savings outweigh the occasional rerun.

## Risks / Trade-offs

- Cache poisoning through the shared volume; caches are keyed by lockfile hash and read-only for pull request jobs from forks
