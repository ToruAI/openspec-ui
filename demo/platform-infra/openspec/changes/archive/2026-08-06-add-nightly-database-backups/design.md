# Design

## Context

The primary database is a managed Postgres instance. Snapshots and PITR live in the same region and account as the instance, so a mistake or compromise there takes backups with it.

## Goals / Non-Goals

**Goals:**
- Recovery point under 5 minutes, recovery time under 1 hour
- One copy outside the primary account and region

**Non-Goals:**
- Cross-region failover
- Backing up object storage

## Decisions

**PITR for fast recovery, dumps for independence.** PITR gives the small recovery point; the nightly logical dump gives a copy that survives a provider-level problem and can be restored into any Postgres.

**Write-only credentials for the dump job.** The job can add objects but not delete or overwrite them; deletion is only by lifecycle rule.

## Risks / Trade-offs

- Logical dumps of large tables slow replicas; run against the read replica at 02:00
