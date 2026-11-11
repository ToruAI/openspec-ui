// Fernhill Goods shared platform: CI, databases, observability, secrets. Fictional.
export default {
  context: `
platform-infra holds the Terraform, Helm charts and CI configuration shared by storefront, payments-api and mobile-app.
Runs on a managed Kubernetes cluster in one EU region plus a managed Postgres service; everything is declared as code and applied from CI.
Changes to production infrastructure need a plan reviewed by a second engineer and a rollback note in the change.
Specs here describe operational guarantees (recovery objectives, alert routing, retention), not individual resources.
`,
  changes: [
    // ---------------------------------------------------------------- archived
    {
      name: 'add-nightly-database-backups',
      created: '2026-07-20',
      archivedOn: '2026-08-06',
      proposal: {
        why: 'Backups rely on the managed provider\'s default daily snapshot with seven-day retention. Nobody has ever restored one, and payments-api cannot lose more than a few minutes of data.',
        what: ['Enable point-in-time recovery with a 14 day window', 'Take a nightly logical dump to a separate bucket in another region', 'Alert when a backup is older than 26 hours'],
        newCaps: [['database-backups', 'Backup schedule, retention and recovery objectives']],
        impact: ['New bucket and lifecycle rules in Terraform', 'Monthly cost increase of about 40 EUR'],
      },
      design: {
        context: 'The primary database is a managed Postgres instance. Snapshots and PITR live in the same region and account as the instance, so a mistake or compromise there takes backups with it.',
        goals: ['Recovery point under 5 minutes, recovery time under 1 hour', 'One copy outside the primary account and region'],
        nonGoals: ['Cross-region failover', 'Backing up object storage'],
        decisions: [
          ['PITR for fast recovery, dumps for independence', 'PITR gives the small recovery point; the nightly logical dump gives a copy that survives a provider-level problem and can be restored into any Postgres.'],
          ['Write-only credentials for the dump job', 'The job can add objects but not delete or overwrite them; deletion is only by lifecycle rule.'],
        ],
        risks: ['Logical dumps of large tables slow replicas; run against the read replica at 02:00'],
      },
      specs: {
        'database-backups': {
          purpose: 'States how often production databases are backed up, where copies live and how recovery is proven.',
          added: [
            [
              'Point-in-time recovery',
              'Production databases SHALL support recovery to any point within the last 14 days with a recovery point objective of 5 minutes.',
              [['Recover to a timestamp', 'an engineer requests a restore to 10 minutes ago', 'a new instance is available at that state within one hour']],
            ],
            [
              'Independent nightly copy',
              'A logical backup MUST be written every night to storage in a different account and region, and the system SHALL alert when the newest backup is older than 26 hours.',
              [['Missed backup', 'no new backup object exists 26 hours after the last one', 'an alert is sent to the on-call channel']],
            ],
          ],
        },
      },
      tasks: {
        'Terraform': ['Enable PITR with 14 day retention', 'Create the cross-region bucket with lifecycle rules', 'Write-only IAM role for the dump job'],
        'Job and alerts': ['Nightly dump CronJob against the read replica', 'Backup age alert at 26 hours', 'Runbook for restoring from each backup type'],
      },
      done: 'all',
    },
    {
      name: 'add-prometheus-alerting',
      created: '2026-08-17',
      archivedOn: '2026-09-03',
      proposal: {
        why: 'We learn about outages from customers. Metrics are collected but there are no alerts, and the on-call phone has never rung.',
        what: ['Define alert rules for error rate, latency and saturation per service', 'Route pages to on-call and warnings to a team channel', 'Add a weekly rotation schedule and an escalation path'],
        newCaps: [['observability', 'Metrics-based alerting and routing']],
        impact: ['New Alertmanager config and rule files', 'Each service repo owns its own rules in a shared format'],
      },
      specs: {
        observability: {
          purpose: 'Defines which signals page a human, who receives them and how fast they must be acknowledged.',
          added: [
            [
              'Paging alerts',
              'The platform SHALL page the on-call engineer when a customer-facing service has an error rate above 2% for 5 minutes or a p95 latency above 1.5 s for 10 minutes.',
              [['Error spike', 'checkout requests fail at 4% for 6 minutes', 'the on-call engineer is paged with a link to the service dashboard']],
            ],
            [
              'Escalation',
              'An unacknowledged page MUST escalate to the secondary on-call after 10 minutes.',
              [['No acknowledgement', 'the primary on-call does not acknowledge within 10 minutes', 'the secondary on-call is paged']],
            ],
          ],
        },
      },
      tasks: {
        'Rules': ['Error rate and latency rules for the three services', 'Saturation rules for nodes and database connections'],
        'Routing': ['Alertmanager receivers for page and warning', 'On-call schedule and escalation policy', 'Test page sent in staging'],
      },
      done: 'all',
    },
    {
      name: 'move-secrets-to-vault',
      created: '2026-09-14',
      archivedOn: '2026-10-01',
      proposal: {
        why: 'Application secrets are Kubernetes Secret objects created by hand with kubectl. There is no record of who changed what, and rotating the database password last quarter took two days.',
        what: ['Store secrets in a managed secrets service with versioning and audit logs', 'Sync them into pods through the external secrets operator', 'Remove secret values from CI variables and from Helm values files'],
        newCaps: [['secrets-management', 'Where secrets live, who can read them and how they change']],
        impact: ['All services mount secrets through the operator', 'CI runs read secrets by short-lived role, not stored tokens'],
      },
      design: {
        context: 'About 60 secrets across three services and CI. Some are duplicated between CI variables and cluster secrets and have drifted.',
        goals: ['Single source of truth with audit history', 'Rotation without a deploy'],
        nonGoals: ['Replacing per-service API keys issued to customers', 'Hardware-backed keys'],
        decisions: [
          ['External secrets operator over a sidecar', 'No extra process per pod; the operator refreshes secrets and pods pick them up on restart, which fits our rollout tooling.'],
          ['Path per service and environment', 'Policies are per path, so staging cannot read production values.'],
        ],
        risks: ['The secrets service becomes a dependency of pod startup; mitigated by cached last-known values in the cluster'],
      },
      specs: {
        'secrets-management': {
          purpose: 'Sets the rules for storing, reading and rotating application and infrastructure secrets.',
          added: [
            [
              'Central secret store',
              'Production secrets SHALL be stored only in the managed secrets service and MUST NOT appear in source control, CI variables or Helm values.',
              [['Secret scan', 'a pull request adds a value matching a known secret pattern', 'the pipeline fails and names the file']],
            ],
            [
              'Audited access',
              'Every read and write of a production secret MUST be logged with the caller identity and retained for 12 months.',
              [['Read is logged', 'a service account reads a database password', 'an audit entry with the account and timestamp is recorded']],
            ],
          ],
        },
      },
      tasks: {
        'Setup': ['Create secrets service paths and policies per environment', 'Install the external secrets operator'],
        'Migration': ['Import existing secrets', 'Switch payments-api, storefront and workers to operator-synced secrets', 'Delete secrets from CI variables and Helm values', 'Add secret scanning to the pipeline'],
      },
      done: 'all',
    },
    {
      name: 'add-preview-environments',
      created: '2026-10-07',
      archivedOn: '2026-10-23',
      proposal: {
        why: 'Reviewers cannot see UI changes without checking out the branch. Everything is verified on the single shared staging environment, which is often broken by someone else\'s half-merged work.',
        what: ['Create a short-lived environment per pull request in the cluster', 'Post the preview URL on the pull request', 'Delete the environment when the pull request closes or after 7 days'],
        newCaps: [['ci-pipeline', 'Build, test and preview behaviour for pull requests']],
        impact: ['New namespace-per-PR Helm release', 'Wildcard DNS and certificate for preview hostnames', 'Cluster capacity reserved for about 10 concurrent previews'],
      },
      specs: {
        'ci-pipeline': {
          purpose: 'Describes what the pipeline does on every pull request and merge, including preview environments.',
          added: [
            [
              'Preview environment per pull request',
              'The pipeline SHALL deploy every open pull request of a service to its own namespace and post the URL on the pull request.',
              [['PR opened', 'a developer opens a pull request', 'a preview URL is commented within 10 minutes of the first successful build']],
            ],
            [
              'Preview cleanup',
              'Preview environments MUST be deleted when their pull request closes, and no later than 7 days after the last push.',
              [['PR merged', 'a pull request is merged', 'its namespace and database are deleted']],
            ],
          ],
        },
      },
      tasks: {
        'Cluster': ['Wildcard DNS and TLS for previews', 'Namespace template with resource quotas'],
        'Pipeline': ['Deploy job on pull request events', 'Comment the preview URL', 'Cleanup on close and nightly expiry job'],
      },
      done: 'all',
    },

    // ------------------------------------------------------------------ active
    {
      name: 'migrate-ci-to-self-hosted-runners',
      created: '2026-10-19',
      touched: '2026-11-10',
      skipSpecs: true,
      goal: 'Cut CI minutes spend by about 60% and make builds faster with warm caches.',
      proposal: {
        why: 'CI on hosted runners costs 1,900 EUR a month and a median pipeline takes 14 minutes, mostly dependency installs and container builds on cold machines. Developers batch their pushes to avoid waiting, which makes reviews bigger.',
        what: [
          'Run CI jobs on autoscaled runners inside our cluster with a persistent build cache',
          'Keep hosted runners as a fallback for the first month',
          'Label jobs by size so heavy builds do not starve quick lint jobs',
        ],
        impact: ['No change to what the pipeline does, only where it runs, so this change carries no spec deltas', 'New node pool for runners (spot instances)', 'Estimated spend of 700 EUR a month'],
      },
      design: {
        context: 'The pipeline is defined in the repo and runs unchanged on any runner with the right labels. Jobs currently reinstall all dependencies and rebuild every image layer from scratch.',
        goals: ['Median pipeline under 6 minutes', 'No loss of isolation between jobs'],
        nonGoals: ['Changing CI provider', 'Running mobile builds (they need macOS machines)'],
        decisions: [
          ['Ephemeral runner per job', 'Each job gets a fresh pod, so a compromised or messy job cannot affect the next one; the cache lives on a shared volume and in a registry.'],
          ['Spot instances with retry', 'Interrupted jobs are retried automatically once; savings outweigh the occasional rerun.'],
        ],
        risks: ['Cache poisoning through the shared volume; caches are keyed by lockfile hash and read-only for pull request jobs from forks'],
      },
      tasks: {
        'Infrastructure': ['Node pool for runners on spot instances', 'Install the runner controller with autoscaling', 'Shared build cache volume and registry cache'],
        'Pipeline': ['Add runner size labels to jobs', 'Move lint and unit test jobs first', 'Move container builds', 'Keep hosted fallback behind a variable'],
        'Cutover': ['Compare cost and duration for two weeks', 'Remove hosted fallback', 'Document runner maintenance'],
      },
      done: 4,
    },
    {
      name: 'postgres-14-to-16-upgrade',
      created: '2026-10-16',
      touched: '2026-11-10',
      goal: 'Upgrade production Postgres before version 14 reaches end of life, with under 10 minutes of write downtime.',
      proposal: {
        why: 'Postgres 14 reaches end of life in under a year and the provider stops offering patches then. Version 16 also brings faster parallel queries that the order reports need, and improved logical replication that makes this upgrade nearly seamless.',
        what: [
          'Upgrade the production database from 14 to 16 using logical replication to a new instance',
          'Rehearse on a restored copy of production twice before the real cutover',
          'Verify the backup and restore procedure on the new version',
        ],
        modCaps: [['database-backups', 'Restore verification becomes a required step after every major version change']],
        impact: ['New instance and connection strings (secrets rotated through the secrets service)', 'Planned maintenance window of 10 minutes on a Sunday morning', 'Old instance kept read-only for 14 days'],
      },
      design: {
        context: 'The production database is 380 GB with about 200 writes per second. payments-api cannot lose committed writes and must not serve stale reads after cutover.',
        goals: ['Under 10 minutes write downtime', 'Instant rollback path until the old instance is retired'],
        nonGoals: ['Schema changes', 'Switching to a different provider'],
        decisions: [
          ['Logical replication over in-place upgrade', 'The in-place path needs an hour of downtime. Replication lets us build and test the new instance while production keeps serving.'],
          ['Reverse replication after cutover', 'New writes flow back to the old instance for 14 days, so rolling back does not lose data.'],
        ],
        risks: ['Sequences are not replicated; we reset them with a safety margin during cutover', 'Extension versions differ; tested during rehearsals'],
      },
      specs: {
        'database-backups': {
          added: [
            [
              'Restore verification after major changes',
              'After every major database version change or backup configuration change, the team SHALL restore the newest backup into a scratch instance and verify row counts of the largest tables, and MUST record the result before the old instance is retired.',
              [
                ['Verification after upgrade', 'production moves to a new major version', 'a restore into a scratch instance is done and its result is recorded in the change before decommissioning'],
                ['Verification fails', 'row counts differ by more than 0.1%', 'the old instance is kept and an incident is opened'],
              ],
            ],
          ],
        },
      },
      tasks: {
        'Preparation': ['Provision the Postgres 16 instance', 'Enable logical replication and copy the schema', 'Check extensions and collations', 'Rehearse on a production copy (first run)'],
        'Replication': ['Start replication and measure lag', 'Second rehearsal including application smoke tests', 'Write the cutover runbook with rollback steps'],
        'Cutover': ['Announce maintenance window', 'Stop writes and wait for zero lag', 'Reset sequences and switch connection strings', 'Start reverse replication', 'Restore verification of the first backup on 16'],
        'Cleanup': ['Retire the old instance after 14 days', 'Update the runbooks and dashboards'],
      },
      done: 11,
    },
    {
      name: 'centralized-log-retention',
      created: '2026-11-05',
      touched: '2026-11-07',
      goal: 'Keep logs long enough for audits and short enough to stay cheap.',
      proposal: {
        why: 'Logs from all services go to one store with unlimited retention, which now costs 2,300 EUR a month, while the payment audit trail needs 12 months and debug logs are never read after a week. Nobody decided these periods; they are an accident of defaults.',
        what: ['Classify log streams as debug, application and audit', 'Retain debug logs for 7 days, application logs for 30 days and audit logs for 12 months', 'Move audit logs to cheaper archive storage after 30 days'],
        modCaps: [['observability', 'Adds retention classes for logs']],
        impact: ['Log pipeline gains a class label added by each service', 'Expected 70% lower log storage cost', 'Services must tag audit events; payments-api first'],
      },
      design: {
        context: 'Services write JSON logs to stdout; an agent ships them with no classification. Payments audit entries are mixed with debug lines and indistinguishable once shipped.',
        goals: ['Each log line has exactly one retention class', 'Audit logs are never dropped by a cost-saving rule'],
        nonGoals: ['Changing the log store', 'Redacting historical logs'],
        decisions: [
          ['Class decided by the emitting service', 'Services know which events are audit events; the pipeline does not guess, and unlabelled lines default to the 30 day application class.'],
          ['Archive tier for audit logs', 'After 30 days audit logs move to object storage with an index; queries are slower but rare.'],
        ],
        risks: ['A service forgetting the audit label loses the line after 30 days; a CI check lists known audit events and fails if they are unlabelled'],
      },
      specs: {
        observability: {
          added: [
            [
              'Log retention classes',
              'Every log line SHALL belong to one retention class, and the platform MUST keep debug logs 7 days, application logs 30 days and audit logs 12 months.',
              [
                ['Debug log expires', 'a debug log line is 8 days old', 'it is no longer searchable'],
                ['Audit log kept', 'an audit log line is 11 months old', 'it can be retrieved from the archive within 15 minutes'],
                ['Unlabelled line', 'a service emits a line without a class', 'it is treated as application and kept 30 days'],
              ],
            ],
          ],
        },
      },
      tasks: {
        'Pipeline': ['Add class label handling to the log shipper', 'Per-class retention rules in the log store', 'Archive tier for audit logs'],
        'Services': ['Tag audit events in payments-api', 'Default class for unlabelled lines', 'CI check for unlabelled known audit events'],
        'Rollout': ['Dry run: report what would be deleted', 'Enable retention in staging, then production'],
      },
      done: 0,
    },
  ],
  ideas: [
    { createdAt: '2026-11-01T07:50:00Z', title: 'Cost dashboard per service', body: 'Tag cluster and database spend by service and show it weekly. We currently see one bill, so nobody knows if payments-api or the previews cost more.' },
    { createdAt: '2026-11-06T14:20:00Z', title: 'Chaos day before Black Friday', body: 'Kill a database replica and a payments-api pod during working hours with everyone present. Better to find the runbook gaps in a drill than during peak traffic.' },
  ],
};
