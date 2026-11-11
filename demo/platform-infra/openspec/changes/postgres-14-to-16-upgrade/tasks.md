# Tasks

## 1. Preparation

- [x] 1.1 Provision the Postgres 16 instance
- [x] 1.2 Enable logical replication and copy the schema
- [x] 1.3 Check extensions and collations
- [x] 1.4 Rehearse on a production copy (first run)

## 2. Replication

- [x] 2.1 Start replication and measure lag
- [x] 2.2 Second rehearsal including application smoke tests
- [x] 2.3 Write the cutover runbook with rollback steps

## 3. Cutover

- [x] 3.1 Announce maintenance window
- [x] 3.2 Stop writes and wait for zero lag
- [x] 3.3 Reset sequences and switch connection strings
- [x] 3.4 Start reverse replication
- [ ] 3.5 Restore verification of the first backup on 16

## 4. Cleanup

- [ ] 4.1 Retire the old instance after 14 days
- [ ] 4.2 Update the runbooks and dashboards
