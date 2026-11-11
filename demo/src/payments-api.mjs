// Fernhill Goods payments API (Go service in front of the card and bank-debit providers). Fictional.
export default {
  context: `
payments-api is the only service that talks to payment providers; storefront and mobile-app call it over HTTPS.
Go 1.23, Postgres, one worker process for webhooks and retries. Amounts are integers in minor units with an ISO 4217 currency code.
Card data never touches this service: we only handle provider tokens and payment intent ids.
Every endpoint that creates money movement must be idempotent and must write an audit row.
`,
  changes: [
    // ---------------------------------------------------------------- archived
    {
      name: 'add-card-payment-intents',
      created: '2026-08-03',
      archivedOn: '2026-08-14',
      proposal: {
        why: 'The storefront creates charges directly against the provider, which splits payment logic across two codebases and makes the mobile app impossible to launch without copying it.',
        what: ['Add `POST /v1/payment-intents` and `POST /v1/payment-intents/{id}/confirm`', 'Store intent state transitions in Postgres', 'Return client secrets for the provider SDKs'],
        newCaps: [['payments', 'Create, confirm and track card payments']],
        impact: ['New `payment_intents` table', 'Storefront switches from direct provider calls to this API'],
      },
      design: {
        context: 'Providers model a payment as a mutable object; our order system wants an append-only history. We need one internal state machine that both can read.',
        goals: ['One internal payment state machine', 'Provider-agnostic API for clients'],
        nonGoals: ['Saved cards', 'Payouts and reconciliation'],
        decisions: [
          ['Intent states: requires_payment, processing, succeeded, failed, canceled', 'Maps cleanly onto both provider models and keeps the order system free of provider terms.'],
          ['Transitions are rows, not updates', 'A `payment_events` row is written for every state change, which gives us the audit trail for free.'],
        ],
        risks: ['State drift if a provider event is missed; the nightly reconcile job added later closes this gap'],
      },
      specs: {
        payments: {
          purpose: 'Defines how a card payment is created, confirmed and reported back to clients.',
          added: [
            [
              'Create payment intent',
              'The API SHALL create a payment intent for a positive amount and a supported currency and return its id and a client secret.',
              [
                ['Valid request', 'a client posts amount 2450 and currency EUR', 'the response is 201 with an intent in state requires_payment'],
                ['Zero amount', 'a client posts amount 0', 'the response is 422 with error code amount_too_small'],
              ],
            ],
            [
              'Payment state history',
              'Every state change of a payment intent MUST be recorded as an event with a timestamp and its cause.',
              [['Success is recorded', 'the provider reports a successful charge', 'a payment_events row with state succeeded is written']],
            ],
          ],
        },
      },
      tasks: {
        'Data model': ['Create payment_intents and payment_events tables', 'Implement the state machine with transition guards'],
        'Endpoints': ['POST /v1/payment-intents', 'POST /v1/payment-intents/{id}/confirm', 'GET /v1/payment-intents/{id}'],
        'Provider': ['Wrap provider SDK behind a PaymentProvider interface', 'Contract tests against the provider sandbox'],
      },
      done: 'all',
    },
    {
      name: 'add-idempotency-keys',
      created: '2026-08-24',
      archivedOn: '2026-09-08',
      proposal: {
        why: 'A mobile client retried a confirm call after a timeout and a customer was charged twice. The API currently has no way to tell a retry from a new request.',
        what: ['Accept an `Idempotency-Key` header on all POST endpoints that move money', 'Replay the stored response for a repeated key', 'Reject a reused key with a different request body'],
        newCaps: [['idempotency', 'Safe retries for money-moving requests']],
        impact: ['New `idempotency_keys` table', 'Middleware in front of every POST under `/v1`'],
      },
      specs: {
        idempotency: {
          purpose: 'Guarantees that retrying a request with the same key never repeats its side effects.',
          added: [
            [
              'Replay stored response',
              'When a request repeats an Idempotency-Key with an identical body, the API SHALL return the original status code and body without executing the operation again.',
              [['Retry after timeout', 'a client repeats a confirm request with the same key', 'the original 200 response is returned and no second charge is made']],
            ],
            [
              'Key reuse with different body',
              'The API MUST reject a request that reuses an Idempotency-Key with a different body.',
              [['Different body', 'a client sends the same key with another amount', 'the response is 409 with error code idempotency_key_reused']],
            ],
          ],
        },
      },
      tasks: {
        'Storage': ['Create idempotency_keys table with request hash', 'Add unique index on (merchant_id, key)'],
        'Middleware': ['Hash and compare request bodies', 'Store and replay responses', 'Lock concurrent requests that share a key'],
      },
      done: 'all',
    },
    {
      name: 'add-webhook-signing',
      created: '2026-09-15',
      archivedOn: '2026-09-29',
      proposal: {
        why: 'The storefront and the fulfilment service receive payment webhooks from us as plain POSTs. Anyone who finds the URL can mark an order as paid.',
        what: ['Sign every outgoing webhook with HMAC-SHA256', 'Include a timestamp and reject deliveries older than 5 minutes', 'Add a signing secret per subscriber with rotation'],
        newCaps: [['webhooks', 'Outgoing event delivery to internal and merchant subscribers']],
        impact: ['New `webhook_endpoints` table with secrets', 'Storefront and fulfilment verify signatures before processing'],
      },
      specs: {
        webhooks: {
          purpose: 'Specifies how payment events are delivered to subscribers and how receivers can trust them.',
          added: [
            [
              'Signed deliveries',
              'Every webhook delivery SHALL carry a signature header computed as HMAC-SHA256 over the timestamp and the raw body using the endpoint secret.',
              [['Valid signature', 'a subscriber recomputes the HMAC with its secret', 'the result equals the signature header']],
            ],
            [
              'Replay window',
              'Receivers MUST reject deliveries whose timestamp is older than 5 minutes.',
              [['Old delivery', 'a delivery arrives with a timestamp 10 minutes old', 'the receiver responds 400 and does not process it']],
            ],
          ],
        },
      },
      tasks: {
        'Signing': ['Generate per-endpoint secrets', 'Compute and attach the signature header', 'Support two active secrets during rotation'],
        'Receivers': ['Add verification helper to the shared Go client', 'Adopt verification in storefront and fulfilment'],
      },
      done: 'all',
    },
    {
      name: 'add-3ds-challenge-flow',
      created: '2026-10-05',
      archivedOn: '2026-10-22',
      proposal: {
        why: 'EU card payments above the SCA threshold fail with a generic error when the bank asks for 3-D Secure. About 6% of EUR orders are lost this way.',
        what: ['Add a `requires_action` intent state carrying the challenge URL', 'Resume the intent when the challenge completes', 'Time out abandoned challenges after 15 minutes'],
        modCaps: [['payments', 'Intents can require customer action before they succeed']],
        impact: ['Intent state machine gains one state', 'Storefront and mobile-app render the challenge in a sheet or redirect'],
      },
      specs: {
        payments: {
          added: [
            [
              'Customer authentication challenge',
              'When the issuer requests 3-D Secure, the API SHALL move the intent to requires_action and return the challenge URL, and MUST resume the intent when the challenge result is reported.',
              [
                ['Challenge required', 'the issuer requests authentication during confirm', 'the intent is requires_action and the response includes a challenge_url'],
                ['Challenge abandoned', 'the customer does not finish within 15 minutes', 'the intent moves to failed with reason authentication_timeout'],
              ],
            ],
          ],
        },
      },
      tasks: {
        'State machine': ['Add requires_action state and transitions', 'Add 15 minute timeout job'],
        'Clients': ['Return challenge_url in confirm response', 'Handle return-from-challenge redirect in storefront'],
      },
      done: 'all',
    },
    {
      name: 'add-customer-vault',
      created: '2026-10-12',
      archivedOn: '2026-10-29',
      proposal: {
        why: 'Returning customers re-enter their card every time because we hold no reference to a saved payment method.',
        what: ['Create a customer record per account with provider tokens only', 'List and detach saved payment methods', 'Use a saved method when confirming an intent'],
        newCaps: [['customers', 'Customer records and saved payment methods (tokens only)']],
        impact: ['New `customers` and `payment_methods` tables', 'No card numbers are stored; only provider tokens and last4/brand for display'],
      },
      specs: {
        customers: {
          purpose: 'Stores customer references and saved payment method tokens, never raw card data.',
          added: [
            [
              'Saved payment methods',
              'The API SHALL let an authenticated customer list, attach and detach payment methods, exposing only brand, last4 and expiry.',
              [['List methods', 'a customer with two saved cards calls the list endpoint', 'the response contains brand, last4 and expiry for each and no card numbers']],
            ],
            [
              'Pay with saved method',
              'The API MUST accept a saved payment method id when confirming an intent for the same customer and reject it for any other customer.',
              [['Foreign method', 'customer A confirms with a method that belongs to customer B', 'the response is 403 with error code payment_method_not_owned']],
            ],
          ],
        },
      },
      tasks: {
        'Data': ['Create customers and payment_methods tables', 'Map customers to provider customer ids'],
        'API': ['Attach and detach endpoints', 'List endpoint with safe fields only', 'Ownership check on confirm'],
      },
      done: 'all',
    },

    // ------------------------------------------------------------------ active
    {
      name: 'add-partial-refunds',
      created: '2026-11-02',
      goal: 'Support can refund part of an order without escalating to engineering.',
      proposal: {
        why: 'Refunds are all-or-nothing today. When one item of a three-item order is damaged, support refunds the whole payment and re-charges the customer, or asks engineering to run a script. That is about 30 manual refunds a month.',
        what: [
          'Add `POST /v1/payment-intents/{id}/refunds` accepting an amount up to the unrefunded balance',
          'Track refunded amount per intent and expose it on the intent',
          'Emit `refund.succeeded` and `refund.failed` webhooks',
        ],
        newCaps: [['refunds', 'Full and partial refunds against a succeeded payment']],
        impact: ['New `refunds` table', 'Support console gets an amount field on the refund form', 'Fulfilment service listens for refund webhooks to restock'],
      },
      design: {
        context: 'The provider supports multiple partial refunds per charge but allows only one refund in flight at a time. Refund requests from support can arrive in bursts when an order is closed.',
        goals: ['Several partial refunds per payment, never exceeding the captured amount', 'Safe to retry from the support console'],
        nonGoals: ['Refunds to a different payment method', 'Automatic refunds for returns'],
        decisions: [
          ['Balance is computed from refund rows', 'No mutable "refunded_total" column; the sum of non-failed refunds is the source of truth, checked inside the insert transaction.'],
          ['Serialise refunds per intent', 'A row lock on the intent avoids provider "refund in progress" errors and double-spending the balance.'],
          ['Reuse idempotency keys', 'Refund creation goes through the same middleware as intents, so retries from the console are safe.'],
        ],
        risks: ['Lock contention if a bulk close refunds many items at once; the worker batches them per intent'],
      },
      specs: {
        refunds: {
          purpose: 'Describes refunding all or part of a succeeded payment, and how the remaining balance is protected.',
          added: [
            [
              'Partial refund',
              'The API SHALL create a refund for any amount between 1 and the unrefunded balance of a succeeded payment.',
              [
                ['Refund part of a payment', 'a payment of 4500 EUR cents has no refunds and a refund of 1500 is requested', 'the refund is created and the intent shows 3000 refundable'],
                ['Refund exceeds balance', 'only 1000 remains refundable and 1500 is requested', 'the response is 422 with error code refund_exceeds_balance'],
              ],
            ],
            [
              'Refund notifications',
              'The system MUST emit a refund.succeeded or refund.failed webhook once the provider reports the final refund result.',
              [['Provider confirms refund', 'the provider reports a refund as succeeded', 'a refund.succeeded webhook is queued for all subscribers']],
            ],
          ],
        },
      },
      tasks: {
        'Data model': ['Create refunds table with unique (intent_id, idempotency_key)', 'Add refundable_amount to the intent response', 'Index refunds by intent and status'],
        'Endpoint': ['POST /v1/payment-intents/{id}/refunds', 'Row lock the intent while validating balance', 'Map provider refund errors to API error codes'],
        'Events': ['Emit refund.succeeded and refund.failed webhooks', 'Handle provider refund.updated callbacks'],
        'Rollout': ['Add amount field to the support console refund form', 'Backfill historic full refunds as refund rows'],
      },
      done: 0,
    },
    {
      name: 'webhook-retry-backoff',
      created: '2026-10-21',
      touched: '2026-11-09',
      goal: 'A subscriber outage of an hour should not lose events or flood the subscriber when it returns.',
      proposal: {
        why: 'Failed webhook deliveries are retried every 30 seconds for 10 attempts, so any outage longer than five minutes drops events permanently. When fulfilment was down for 40 minutes last month, 212 paid orders were never marked as paid.',
        what: [
          'Retry with exponential backoff and jitter for up to 72 hours',
          'Add a dead-letter state and a replay endpoint for dropped events',
          'Pause an endpoint automatically after 20 consecutive failures',
        ],
        modCaps: [['webhooks', 'Delivery guarantees: retry schedule, dead-lettering and manual replay']],
        impact: ['`webhook_deliveries` gains attempt count and next_attempt_at', 'Worker scheduler changes from a fixed ticker to a due-time query', 'Ops dashboard shows dead-lettered deliveries'],
      },
      design: {
        context: 'Deliveries are rows polled by the worker every second. Retry timing is hard-coded in the worker loop, and there is no concept of a permanently failed delivery.',
        goals: ['No event is lost during outages up to 72 hours', 'Recovering subscribers are not hit by a thundering herd'],
        nonGoals: ['Ordering guarantees between events', 'Per-subscriber custom retry policies'],
        decisions: [
          ['Schedule: 10s, 1m, 5m, 30m, 2h, then every 6h, each with up to 20% jitter', 'Covers short blips quickly while capping total attempts near 15 over 72 hours.'],
          ['Pause instead of delete', 'An endpoint that fails 20 times in a row is paused and the owner is notified; queued events stay and flow again when it is resumed.'],
          ['Replay by event id', 'Dead-lettered events can be re-queued with one call, which is safer than manual SQL.'],
        ],
        risks: ['Duplicate deliveries are possible, so receivers must dedupe by event id; documented in the integration guide'],
      },
      specs: {
        webhooks: {
          modified: [
            [
              'Replay window',
              'Receivers MUST reject deliveries whose timestamp is older than 5 minutes. Retried deliveries SHALL be re-signed with a fresh timestamp on every attempt.',
              [
                ['Old delivery', 'a delivery arrives with a timestamp 10 minutes old', 'the receiver responds 400 and does not process it'],
                ['Retry is re-signed', 'a delivery is retried 2 hours after the first attempt', 'the retry carries a new timestamp and a valid signature'],
              ],
            ],
          ],
          added: [
            [
              'Retry with backoff',
              'The system SHALL retry failed deliveries on an exponential schedule with jitter for up to 72 hours before dead-lettering them.',
              [['Subscriber down for an hour', 'a subscriber returns 503 for 60 minutes', 'the event is delivered successfully on the first retry after it recovers']],
            ],
            [
              'Endpoint auto-pause',
              'The system MUST pause an endpoint after 20 consecutive failed deliveries and keep its pending events queued.',
              [['Twentieth failure', 'an endpoint has failed 19 times in a row and fails again', 'the endpoint is paused and its owner is notified']],
            ],
          ],
        },
      },
      tasks: {
        'Schema': ['Add attempt_count and next_attempt_at to webhook_deliveries', 'Add dead_lettered status', 'Add paused_at to webhook_endpoints'],
        'Worker': ['Replace fixed ticker with due-time query', 'Implement backoff schedule with jitter', 'Re-sign each retry with a fresh timestamp', 'Pause endpoints after 20 consecutive failures'],
        'Operations': ['Replay endpoint for dead-lettered events', 'Dead-letter panel in the ops dashboard', 'Document dedupe-by-event-id for receivers', 'Load test recovery of 50k queued events'],
      },
      done: 5,
    },
    {
      name: 'idempotency-key-expiry',
      created: '2026-10-14',
      touched: '2026-11-05',
      goal: 'Keep the idempotency table from growing forever without breaking legitimate retries.',
      proposal: {
        why: 'The `idempotency_keys` table grew to 140 million rows in three months and now dominates storage. Keys are only useful for the duration of a client retry loop, which is minutes, not forever.',
        what: ['Expire keys 24 hours after creation', 'Delete expired keys in nightly batches', 'Treat a key reused after expiry as a brand new request, whatever the body'],
        modCaps: [['idempotency', 'Define key lifetime']],
        impact: ['Nightly cleanup job', 'Expected 95% reduction in table size', 'Client SDK docs updated to state the 24 hour window'],
      },
      design: {
        context: 'Keys are inserted on first use and never touched again. Lookups hit a unique index on (merchant_id, key); deleting old rows in one statement would lock the table for minutes.',
        goals: ['Bound table growth', 'No customer-visible change for clients that retry within minutes'],
        nonGoals: ['Partitioning the table', 'Per-merchant retention settings'],
        decisions: [
          ['24 hours, not 7 days', 'Our slowest client retry loop (mobile on poor networks) gives up after 30 minutes; 24 hours leaves a wide margin and matches the provider\'s own window.'],
          ['Expiry checked on read, deleted in batches', 'Lookups ignore expired rows immediately, so correctness never depends on the cleanup job; the job deletes 10k rows per batch with a short sleep to avoid replica lag.'],
        ],
        risks: ['A client that retries after more than 24 hours will repeat the operation; documented in the API guide'],
      },
      specs: {
        idempotency: {
          added: [
            [
              'Key expiry',
              'The API SHALL treat an Idempotency-Key as unknown 24 hours after its first use, and MUST execute a request that reuses an expired key as a new request.',
              [
                ['Within window', 'a client repeats a key 3 hours after first use', 'the stored response is replayed'],
                ['After window', 'a client repeats a key 30 hours after first use', 'the request is processed as new and a new response is stored'],
              ],
            ],
          ],
        },
      },
      tasks: {
        'Implementation': ['Add expires_at column with default now() + 24h', 'Ignore expired keys in the lookup', 'Nightly batch delete of expired keys (10k rows per batch)'],
        'Verification': ['Backfill expires_at for existing keys', 'Dashboard for table size and cleanup lag', 'Update client SDK docs'],
      },
      done: 'all',
    },
    {
      name: 'add-sepa-direct-debit',
      created: '2026-10-27',
      touched: '2026-11-04',
      goal: 'Let German and Dutch customers pay by bank debit, which they prefer to cards.',
      proposal: {
        why: 'In Germany and the Netherlands, 40% of online shoppers prefer bank-based payment methods, and our card-only checkout converts 11 points lower there than in the rest of the EU.',
        what: ['Add SEPA Direct Debit as a payment method type on payment intents', 'Collect and store the mandate (IBAN token, name, acceptance timestamp)', 'Treat a debit as pending for up to 5 business days'],
        newCaps: [['sepa-debit', 'Mandates and delayed-settlement debit payments']],
        modCaps: [['payments', 'Intents can stay in processing for days and may fail after the customer left']],
        impact: ['New `mandates` table', 'Order system must handle "paid, may still fail" for debit orders', 'Storefront adds a bank-debit option behind a per-country flag'],
      },
      design: {
        context: 'Card payments settle in seconds, so the order system treats succeeded as final. A SEPA debit can be reversed for up to 8 weeks after settlement and fails asynchronously within 5 business days.',
        goals: ['Accept debits without releasing goods before funds are likely safe', 'Reuse the intent API so clients change little'],
        nonGoals: ['Other bank methods (iDEAL, Bancontact)', 'Recurring debits'],
        decisions: [
          ['Release goods when the intent reaches processing', 'We accept the reversal risk for orders under 300 EUR, backed by a per-customer limit; larger debit orders wait for succeeded.'],
          ['Mandate is its own entity', 'Mandates outlive a payment and must be shown on request, so they are stored separately with the acceptance evidence.'],
        ],
        risks: ['Dispute and reversal handling is new for support', 'Delayed failures produce unpaid shipped orders; the limit above caps exposure'],
      },
      specs: {
        'sepa-debit': {
          purpose: 'Covers accepting SEPA Direct Debit payments, including mandate evidence and delayed results.',
          added: [
            [
              'Mandate acceptance',
              'The API SHALL require a recorded mandate acceptance with timestamp and customer IP before confirming a SEPA debit intent.',
              [['Missing acceptance', 'a client confirms a SEPA intent without mandate acceptance', 'the response is 422 with error code mandate_required']],
            ],
            [
              'Delayed failure',
              'The system MUST move a processing SEPA intent to failed and notify subscribers if the bank rejects the debit within 5 business days.',
              [['Bank rejects debit', 'the provider reports insufficient funds on day 3', 'the intent becomes failed with reason insufficient_funds and a payment.failed webhook is sent']],
            ],
          ],
        },
        payments: {
          modified: [
            [
              'Payment state history',
              'Every state change of a payment intent MUST be recorded as an event with a timestamp and its cause. For delayed-settlement methods, the processing state MAY last up to 5 business days.',
              [
                ['Success is recorded', 'the provider reports a successful charge', 'a payment_events row with state succeeded is written'],
                ['Long processing', 'a SEPA debit has been submitted', 'the intent stays in processing and each provider update is recorded'],
              ],
            ],
          ],
        },
      },
    },
  ],
  ideas: [
    { createdAt: '2026-10-30T08:22:00Z', title: 'Daily reconciliation report against provider payouts', body: 'Compare our succeeded intents to provider payout lines every morning and post mismatches to the finance channel. Today finance does this by hand once a month.' },
    { createdAt: '2026-11-07T13:10:00Z', title: 'Idempotent refunds from the support console', body: 'The console double-posts if an agent clicks twice. Generate the key client-side from the form session so a double click maps to one refund.' },
  ],
};
