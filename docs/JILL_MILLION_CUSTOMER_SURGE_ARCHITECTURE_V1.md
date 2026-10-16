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

## Phase 26 Windows verification — PASS, 2026-10-16

Owner pulled WORK to `fcedb05`; both JS syntax checks and the
actual **LOCAL workerd D1** test exited 0. Console:
`PASS WORK Phase 26 LOCAL intake ledger`, followed by guarded PASS.
The local D1 confirmed immutable first reservation, duplicate/change
in payload or trusted owner binding rejection, only one dispatch,
ambiguity without automatic retry, synthetic confirmed CAS and
no raw PII or false customer acknowledgement.

**Phase 26 passes LOCAL scope, NOT real Google submission endurance.**

## Phase 27 — Signed intake + existing Google QA gateway (source-only)

To get JILL HQ through stronger integration tests, new LOCAL test
coordinator `services/jill-order-desk/app-home/scripts/phase27-local-signed-intake.mjs`
combines:
- REAL existing Shopify app-proxy HMAC verification (synthetic signed
  test requests) before accepting request-body fields or D1 writes;
- local fake-workerd D1 0007 one-shot ledger and HMAC-deduped owner;
- existing unchanged `createCustomOrderWorkProxyRoute` and
  `handleCustomOrderProxy`, including its TWO Google QA confirmations;
- deliberately **mocked Google network** with genuine signed gateway
  request formats, not actual Apps Script;
- only a verified gateway success plus final D1 state may return an
  HTTP 200. Upstream uncertainty, replay, changed-owner or payload
  is fail-closed and never blindly dispatched twice.

`scripts/test-workerd-signed-intake-local.mjs` exercises that
composition in local workerd D1 using purely synthetic forms.
The code lives exclusively in test scripts, is NEVER imported by
the deployed proxy, and fake D1 config is pinned to `remote:false`.

`scripts/verify-work-hq-local-bundle.mjs` also runs an integrated
WORK HQ regression suite: proxy, merchant commands, mail QA,
surge, retention, local OAuth, Owner, intake, media, TypeScript.
It guards exact branch/sync, tracked source integrity,
production Wrangler bindings and active migration membership
before any test. This is local verification, **not** a live
Shopify/Google/Cloudflare rollout check.

**Phase 27 and full HQ bundle await Windows certification.** No
remote schema application, Worker deployment, file upload,
Shopify app update, store customization or paid activation.

### Honest capacity and recovery gap

Phase 26/27 stores ONLY an identity HMAC, owner HMAC and state,
**not an encrypted replayable custom-order payload or transactional
outbox**. It cannot resume a Google write after a crash, nor
complete a million-request intake backlog independently. A future
real production service needs a bounded, encrypted durable source,
separately authenticated receipt-reconciliation mechanism,
queue/outbox, limits, retention, privacy controls and observed
load testing. Shopify-native commerce remains unaffected.

### Provider scaling preference

The owner prefers retaining Cloudflare/Shopify and accepts
evaluating **paid capacity** when real usage justifies it.
Cloudflare Workers Paid and usage-metered R2 Standard, and D1
paid capacity, are available, but no plan, account upgrade,
consent to variable charges, spending cap or remote deployment
is yet specifically approved. Pricing and throttles must be
re-validated at the approval gate.

### Phase 27 clean GitHub CI — PASS

On 2026-10-16 GitHub Actions run
`38981314312` ("My JILL WORK account certification") completed
**success** for commit `4c148334a05b53f6511bbe42295561310e9acfff`:
https://github.com/JILLOnline/JILL-WEB/actions/runs/38981314312

All four jobs passed: Rewards/WORK contracts, Windows Node 24
postinstall, WORK embedded App Home build/typecheck/local workerd
regressions including the newly added synthetic signed-intake
two-Google-confirmation test, and WORK Cloudflare dry-run package.
The separate theme pipeline also returned success.

The newly added `work:hq:local:verify-all` runner builds its
own LOCAL OAuth canary candidate, validates the manifest and
runs focused signed gateway, merchant, QA mail, local OAuth,
media Owner, intake, recovery and TypeScript checks, aborting on
the first failure.

**CI PASS is not owner Windows end-to-end certification**, nor real
Shopify merchant login, live Google QA signing, deployed production
uploads or a one-million-customer measured load test. User Windows
bundled verification remains PENDING. Existing signed WORK gateway,
LIVE, KEEP, remote database/storage and paid plans unchanged.

## Phase 27 Owner Windows bundled local certification — PASS

Owner's 2026-10-16 PowerShell output after pulling
`jill/rewards-work` to `f76de61` shows every step in
`npm.cmd run work:hq:local:verify-all` returned success:
- actual local WORK canary React Router build and local OAuth
  candidate; source locked manifest stayed unchanged;
- existing Shopify app-proxy HMAC, SQLite limiter, merchant commands,
  Google QA mail-outbox, surge forecast and privacy retention;
- local WORK OAuth browser/curl login and cross-site denial;
- private media Owner access, D1 idempotent intake ledger,
  signed Shopify -> mocked Google QA TWO-confirmation bridge,
  real local WASM + synthetic D1/R2 private write/recovery;
- React Router typegen and TypeScript zero errors.

The final printed `PASS WORK HQ LOCAL BUNDLE` and guarded
PowerShell `PASS: JILL HQ complete local verification succeeded`
followed the successful executable checks. CI had independently
passed commit `4c148334` before this Windows run.

**Boundary:** the local OAuth smoke test /app and /app/setup-owner
returned HTTP 410 for anonymous requests, which is expected
denial; they did NOT prove a merchant-signed in HQ screen.
All local D1/R2 data and Google/Shopify credentials were
synthetic. The real WORK release, authenticated Owner UI and
real QA request-to-account tracking still require separate
interactive checks.

## Phase 28 — Read-only live WORK anonymous commissioning evidence

Source-only and safe to run with existing provider credentials
(but it sends none): `scripts/inspect-work-hq-live-anonymous-v1.mjs`
makes exactly four **uncredentialed GETs** against the exact
WORK canary hostname, never follows redirects and does not
read customer content: D1 /healthz; /auth/login; anonymous
/app/requests; anonymous /app/setup-owner. It classifies
`oauth_locked` versus `oauth_login_public_and_private_routes_denied`
without assuming the locked Git manifests reflect the currently
deployed Cloudflare Worker version.

`scripts/test-work-hq-live-anonymous-v1.mjs` mocks all
network calls and adversarially checks wrong host redirects,
foreign Shopify store redirects, public Owner/custom-order
responses, D1 errors, cache errors and inconsistent OAuth
gates. These are OFFLINE assertions, not live evidence.
CI includes them. Read-only script result is PENDING.

The deployed source version, signed-in WORK Owner,
actual Google QA verification, merchant emails, staff grants,
private files and account settings remain unverified by
this inspector. No private routes are called authenticated,
no Customer Account activity, mutations, remote migrations,
deployment or paid upgrades.

## Phase 28 Owner Windows LIVE WORK anonymous audit — PASS

Owner fast-forwarded `jill/rewards-work` to `9029eaa`.
Both `npm.cmd run test:work-hq-live-anonymous-v1`
(27 synthetic adversarial cases) and
`npm.cmd run work:hq:live:anonymous:inspect` exited 0.
The real deployed WORK CANARY returned:
- `GET /healthz`: HTTP 200, WORK D1 healthy.
- `GET /auth/login`: HTTP 200, WORK Shopify login reachable.
- `GET /app/requests`: HTTP 410, anonymous merchant route denied.
- `GET /app/setup-owner`: HTTP 410, anonymous Owner setup denied.

Reported:
`oauth_login_public_and_private_routes_denied`.
The guarded PowerShell PASS correctly followed both exit-0 checks.
The local tests did not inspect real customers, and the live four-GET
read-only probe sent NO Shopify credentials or admin sessions.

**Important non-claims:** HTTP 410 anonymous denial is not evidence
that the signed-in merchant page is usable; this check did not
verify the deployed Worker version or compare runtime bindings.
It did NOT test real Owner access, signed Google QA request retrieval,
actual merchant writes, exact detail, My JILL customer tracking,
billing, media or full end-to-end rollout.

Latest GitHub Actions `My JILL WORK account certification` for
commit `9029eaa`, run 38982121088, completed SUCCESS; the
separate `JILL Theme Core Pipeline`, run 38982121106, also succeeded.
Both are CI/source checks; the owner's real browser test remains
outstanding.

### Phase 29 next: signed-in WORK HQ merchant acceptance test (NO mutation)

Open **Shopify Admin for `jill-work.myshopify.com`** using the
actual registered account Owner, open **Apps → JILL HQ → Custom
Orders** in the embedded Shopify interface (not a public direct
Worker URL or LIVE Admin session).

Verify the JILL HQ landing page shows merchant identity recognized,
its Custom Orders navigation appears, the inbox shows
`Verified WORK source` and an accurate count, and an existing
disposable WORK QA request can open its workspace. The list
is a signed, nine-field canonical projection; customer contact
details are deliberately not shown in the inbox.

Check the exact-detail pane separately: depending on the actual
deployed WORK flag it may be disabled/unavailable. Do not confuse
missing detailed panel with an inbox-source failure. Do not click
status updates/send emails or submit new orders until a separately
reviewed mutation acceptance test is authorized.

If any step fails, report only route-level status, visible
state banners (`source_not_connected`, `source_unavailable`,
`access_denied`, or `ready`), whether there are request cards,
and sanitized timing **labels**. Never paste cookies, browser
tokens, full unredacted customer names/emails/phones, URLs with
session parameters or raw Google QA response bodies.

PASS requires a verified signed-in Owner, correct WORK shop,
a signed source showing the expected existing disposable
requests, and a request-workspace render. It is NOT proven by
anonymous route checks alone. LIVE and KEEP remain out of scope.

## Phase 29 — Owner WORK QA exact request visible (2026-10-16)

The owner supplied a screenshot of **JILL HQ / Original request ·
Items & personalization** in a disposable WORK QA customer request.
It visibly renders **Verified revision 2**, a named product
(Coloring Books) with quantity 1, customer/event fields, and
request-level planning/personalization, including a pickup
fulfillment and date. This provides strong human evidence that
the deployed merchant request workspace and exact-detail source
are functioning with the WORK QA fixture. It does not by itself
prove browser session claims beyond the route's separately
reviewed authentication code, correct inbox counts, or mutation
write success.

**UI deployment drift identified:** Screenshot shows a full legacy
Cloudinary delivery URL rendered literally under request-level
references and the older notice 'Reference IDs only'. Current
reviewed Git source (source commit `9c5b96e`) instead calls
`describeWorkReference`; the strict provenance classifier
(commit `99158a5`, then `eab95a3`) displays only legacy image
filename and refuses to build public link/preview/download. This
points to deployed WORK presentation source predating the
improvement. No screenshot-derived URL/customer email is copied
into this audit. There is no evidence that the correct source
version is deployed. Full URL in an Owner-only view is not proof
of a public HTTP authorization bypass; do not call it one.

**Do not run** old `work:hq:ui:deploy` blindly: its existing
guard pins an earlier active canary version and will not safely
stage current code over the audited v34 exact-detail deployment.
First run existing read-only
`npm.cmd run work:hq:detail:v9:live:audit` to establish exact
active WORK version and current Google QA @9 evidence; STOP on
mismatch. A future UI candidate must preserve all existing
v34 bindings, Shopify OAuth/Owner grants, Google @7/@9 source,
write flags, private-media OFF, and rollback version. Require
separate exact-version approval before any Cloudflare version
upload/switch. Nothing has been deployed in this phase.

**Next real merchant mutation acceptance:** On this disposable
WORK QA request ONLY, and after checking its displayed current
status/revision, use **Update status** to advance an allowed
transition (e.g. `received -> reviewing`), keep customer message
and customer-visible note blank, then click **Save verified
update** once. Expect verified source ACK/revision increment;
if uncertain or stale, stop—do not blindly repeat. Reload
Custom Orders and verify the same request shows the confirmed
new revision/status, including direct detail navigation. Email
delivery is NOT tested by a status-only update with no message.
This is an intentional write to the disposable QA request
ledger, not a billing/Shopify paid-order operation.

Private media preview, customer-account linkage, Quotes/Invoices,
fulfillment and 1m-customer load capacity are separate gates.
