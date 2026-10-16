# JILL million-customer surge architecture (design only)

**Status: NOT LOAD-CERTIFIED; NO LIVE/KEEP CHANGES.**
WORK branch: `jill/rewards-work`. This document is a capacity design,
not permission to spend, deploy or accept unsaved orders.
Owner target: JILL must remain usable even if one million customers
visit in a day. Customer count is NOT identical to one million
independent WORK database transactions or private artwork uploads.

## The hard choice: split commerce from customization

1. **Shopify owns public catalog, cart, checkout, paid order receipts,
   payment and order-of-record.** No WORK Worker, Apps Script, queue or
   private image service may sit synchronously between checkout and
   Shopify's own durable order receipt. Product images use the
   commerce platform's normal optimized delivery path.
2. **My JILL/customer identity** uses verified Shopify customer
   authentication and ownership; never infer account access from
   matching email/phone or a mutable browser field. Keep My JILL
   custom requests distinct from Shopify paid orders.
3. **WORK Custom Order intake** needs a dedicated authenticated,
   rate-limited, idempotent server-owned receipt ledger before it
   may tell anyone a request was saved. The current signed WORK
   Google QA detail is useful for exact-source verification, not
   proof that a future million-request workload can be persisted.
4. **Background notifications, customization rendering, supplier
   jobs and media processing** execute asynchronously only AFTER
   a durable intake record exists. Queue messages carry pointers
   and immutable IDs, NEVER raw image bodies or Shopify tokens.
5. **Artwork** stays an optional, isolated private service. The
   current WORK pilot cap (40 uploads/month, 256 MiB lifetime
   reserved, 8 MiB per sanitized object) remains intact until a
   separately approved re-architecture. The Phase 22 fake-local
   transaction must not be connected to production.
6. **JILL HQ Owner access** is separate from My JILL customer access.
   Every private read/recovery action rechecks identity, exact
   request binding and object state. Raw R2 object URLs are never
   exposed to guests or the public storefront.

## Five independent traffic lanes

| Lane | Priority | Overload behavior |
| --- | --- | --- |
| Shopify storefront / checkout | P0 | Native Shopify checkout; no WORK dependency |
| Accepted orders and durable receipts | P0 | Never lose an acknowledged write; if durability unavailable, STOP acceptance |
| My JILL order status | P1 | Authentication first; bounded/paginated reads; degrade noncritical widgets |
| New custom order intake | P2 | Server-side capacity admission; reject with explicit retry if durable store unavailable; never claim success |
| Artwork / emails / analytics | P3 | Circuit-break, throttle, defer; never consume payment-path capacity |

Do not turn a POST timeout into an automatic second order.
Use stable server-validated idempotency keys and exactly-once
*effects* atop at-least-once delivery: unique constraint on the
accepted event ID, transactional outbox, explicit state machine,
signed Shopify webhooks with de-duplication, deterministic retry
after checking committed state, and dead-letter isolation.
No queue can substitute for the original durable receipt.

## Physical operations: do not oversell handmade capacity

Even perfect software cannot manufacture one million personalized
piñatas tomorrow. Separate SKUs and customer promises into:
- **Ready-to-ship stock:** let Shopify's actual inventory availability
  control checkout. No artificial custom-order backend bottleneck.
- **Made-to-order piñatas, apparel, favors and gift bundles:** publish
  truthful current lead times and inventory/production capacity,
  reserving dated production slots in a durable ledger BEFORE making
  a firm delivery promise. Avoid simultaneous oversubscription with
  atomic reservation and an auditable cancellation/release.
- **Capacity exhausted:** display later dates, waitlist/notification
  or unavailable status. Never silently take an unfulfillable order
  with an impossible delivery date.
- **Shipping and pickup:** capacity/date logic must include working
  days, carrier uncertainty, material supply, staff hours and holiday
  peaks. Track backlog age and promise-date risk; communicate changes
  promptly.
- **Rush orders:** separate explicitly priced and individually
  accepted rush capacity; no automatic rush assumption.
- **Discounts and campaigns:** rate-limit promotions based on
  fulfillment slots, not just CDN/checkout throughput. Keep
  coupon/redemption security independent of the private-artwork gate.

Production-slot enforcement needs a separate Shopify-compatible
reservation/order-state integration and operating-capacity inputs
from the Owner. It is NOT implemented by the synthetic scale forecast.

## 2026 published free-tier reality

Public reference limits (subject to changes, not per-account invoices):
- Workers Free: 100,000 requests/day and 10 ms CPU per invocation.
  Workers memory is 128 MB. Real local WASM 328 ms *elapsed* from
  Phase 18 is **not** proof it fits Workers Free CPU.
  https://developers.cloudflare.com/workers/platform/limits/
- D1 Free: 5 million rows read/day, 100,000 rows written/day,
  500 MB per database and 5 GB total account storage.
  Daily query-limit overages result in errors, not durable buffering.
  https://developers.cloudflare.com/d1/platform/pricing/
  https://developers.cloudflare.com/d1/platform/limits/
- R2 Standard free allowance: 10 GB-month, 1 million Class A and
  10 million Class B operations per month. It is NOT a hard spending
  cap; higher usage can incur charges.
  https://developers.cloudflare.com/r2/pricing/
- Queues Free: 10,000 operations/day (write/read/delete count
  separately), messages retained for 24 hours. Free Queues are
  NOT an unlimited or permanent order ledger.
  https://developers.cloudflare.com/queues/platform/pricing/
  https://developers.cloudflare.com/queues/platform/limits/
- Shopify Admin GraphQL throttles by query cost and store plan;
  throttle status must drive worker pacing. Shopify-native checkout
  remains separate from the WORK backoffice.
  https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits

For illustration ONLY, 1,000,000 WORK requests/day exceeds a
100,000/day Free limit by 10x. 1,000,000 potential 100 KB images
would generate 100 GB of objects before metadata/retention, not a
Free-tier private storage plan. Zero account R2 bytes in a prior
read-only snapshot does not prove capacity for tomorrow.

## Engineering stages (NO automatic upgrades)

**S0 — current:** Shopify-native sales as-is; all WORK media upload
and preview routes disabled; 0004–0006 remote migrations OFF;
signed owner inspection OFF; no R2 binding in deploy manifests.
We cannot honestly promise a million WORK transactions tomorrow.

**S1 — source-only preparation (NOW):** complete a high-load
capacity forecast and denial tests, failure taxonomy, observability
schema, incident runbook, immutable order/source IDs, and bounded
reports. Use synthetic payloads; no new provider account/bill.

**S2 — controlled private CANARY (future separate approvals):**
actually integrate Shopify SDK HMAC/session checks, a durable
idempotent intake/outbox, D1 migrations with validated rollback,
provider-authenticated storage checks, conditional storage, bounded
WASM, throttle-aware workers, dead-letter queues, audit and
retention. Pilot one synthetic image before any customer artwork.
Every provider/migration/cost step needs explicit Owner approval.

**S3 — 10x / 100x / 1000x synthetic load gates:** rehearse
concurrent submissions, duplicates, poisoned messages, Shopify
429 throttles, D1 limits and R2 errors. Collect p50/p95/p99,
queue backlog age, accepted-vs-durable receipts, failure rate,
R2 operations/bytes, CPU and dollars. Prove rollback and switch
off before any staged real customer rollout.

**S4 — million-scale traffic launch:** only with observed throughput,
explicit business budget and a reviewed paid-capacity/fallback plan.
Scale durable intake and sharded/counter views separately from
Shopify checkout; never claim exactly-once network delivery.
Contractual checkout capacity is a Shopify plan/provider decision,
not a promise from WORK scripts.

## Capacity and cost safety contract

- Code-level safety and workload limits are NOT cloud billing caps.
  Enforce both per-customer abuse/size limits AND account-wide
  circuit-breakers, subject to provider authorization.
- A credible cost plan must name a monthly maximum acceptable spend,
  alert thresholds, estimated upload conversion and byte size,
  queue ops per event, and what to stop if spend rises.
- A 30-day quarantine review is a reasonable DEFAULT REVIEW
  SUGGESTION only. It is **not an approved deletion duration**,
  automatic expiry, legal hold decision or quota refund.
- No infinite background retries or unbounded queues. Persist and
  surface failures for an Owner; retry only idempotent jobs with
  bounded attempts after reliable reconciliation.
- No raw customer PII, image keys, HMACs or upload bytes in
  observability fields, queue diagnostics or CDN responses.
- Back-office aggregate queries must not return one million D1 rows
  to a Worker/browser. Use materialized counters and indexed,
  cursor-paginated incident views. Even SQL GROUP BY scans can be
  expensive at million-row scale; measure D1 rows read.
- The present Phase 24 10,000-row source-only report is a
  **small-pilot-only tool**. It is NOT suitable for million-row
  operations without an approved scalable rollup scheme.

## Non-negotiable customer truth

**Never say "order received" or "upload saved" without a durable,
verifiable receipt.** If capacity or the ledger is unavailable,
show an explicit failure/retry path. Shopify's own order receipts
are authoritative for paid checkout; a custom request has a
separate, traceable state and cannot become a paid order just
because WORK queued a task.

**No GO for paid tiers, remote writes or customer media** is
implied by "whatever works" or by the capacity model.

## Source-only verification commands

Run only from a clean synchronized `jill/rewards-work` checkout:
```powershell
npm.cmd run test:work-hq-surge-capacity
if ($LASTEXITCODE -ne 0) { throw 'STOP: WORK capacity invariants failed' }

npm.cmd run work:hq:scale:simulate-million
if ($LASTEXITCODE -ne 0) { throw 'STOP: Million-demand forecast failed' }
```

These print an OFFLINE hypothetical capacity warning, not proof of
throughput. **Do not run a million real requests** or enable paid
services to "test" this plan. Independent controlled synthetic load
testing needs separate authorization, infrastructure sizing and
budget controls.

## Phase 25 — Owner Windows surge forecast PASS, 2026-10-16

Owner fast-forwarded `jill/rewards-work` to `273b785`, ran
`npm.cmd run test:work-hq-surge-capacity` successfully
(25 hypothetical aggregate-only scenarios) and
`npm.cmd run work:hq:scale:simulate-million` successfully
(7 model capacity blockers). The guarded PowerShell PASS followed
both exit-code-zero commands.

The hypothetical case used 1 million Shopify visitors AND
1 million direct WORK requests/day, 3 million D1 row writes/day,
3 million queue operations/day and 100 decimal GB/month of media.
These exceed current *reference* Workers/D1/Queues and pilot
media limits. No traffic was generated and no real capacity,
pricing, latency or durability was measured. Phase 25 is a
**planning-model certification only**.

## Phase 26 — WORK custom-order receipt ledger, source-only (PENDING)

Read-only audit of actual WORK custom-order code:
- `backend/custom-order-gateway.mjs` currently checks the Google
  QA submission response AND makes a second signed Google QA
  receipt query before sending a `received` acknowledgement.
  Preserve this confirmed receipt behavior and the app-proxy HMAC.
- `services/custom-order-cloudflare/limiter.mjs` applies a
  Durable Object global default of **30 submissions/minute**
  and 6/minute per client. This protects WORK but cannot serve
  a hypothetical million submitters without deliberate scaling.
- Google QA synchronous upstream calls (each with bounded timeout)
  are a throughput/dependency bottleneck. No separate durable
  WORK intake/outbox presently absorbs arbitrary upstream delays.
  Never replace a Google receipt with a speculative D1 success.

New completely **inert** proposal
`services/jill-order-desk/intake-ledger-proposals/0007_work_intake_ledger.sql`
is OUTSIDE active migrations/ and outside existing media proposals.
It defines a privacy-minimal D1 submission-key ledger with
payload + independently verified owner binding HMACs, one
first-dispatch attempt, immutable identifiers, no row deletion,
and reserved -> forwarding -> ambiguous/confirmed lifecycle.

Pure non-executing planner
`services/jill-order-desk/work-intake-ledger-plan.mjs` validates
existing WORK form shape, prevents conflicting duplicate IDs and
changed owner identity, and models optimistic state transitions.
It never authenticates Shopify, contacts Google, queues a job,
writes D1 or gives a customer success. The local synthetic
confirmation marker is intentionally NOT a trusted Google receipt;
even a locally 'confirmed' row cannot produce a customer ACK.

Test `services/jill-order-desk/app-home/scripts/test-workerd-intake-ledger-local.mjs`
runs genuine LOCAL Cloudflare D1 against fake `remote:false`
bindings with synthetic orders only. It checks immutable uniqueness,
one-shot dispatch, ambiguity on uncertain upstream outcomes,
rejection of cross-owner/payload replays, no raw email/owner stored
in D1, no public route, no auto-redelivery or fake HTTP receipt.
It does not call an actual Shopify or Google service. CI runs
the test, but the owner's Windows result is **not yet known**.

Later phase (separate explicit approval): design a real verified
WORK app-proxy admission adapter and signed Google reconciliation,
bounded durable queue/outbox with backpressure, dead-letter
resolution and real load/cost measurement. Until then DO NOT
wire phase26 planner to `handler.mjs`, change DO quotas, or
activate 0007 on remote D1. The current proxy remains untouched.
