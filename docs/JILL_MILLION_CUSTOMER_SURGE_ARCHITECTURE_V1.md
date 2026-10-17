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

## Phase 29 read-only production binding audit — PASS (Owner Windows)

After synchronizing WORK to commit `94ff3ce`, the Owner executed
`npm.cmd run work:hq:detail:v9:live:audit` with exit code zero.
Cloudflare reported **exact active v34**
`4973b74d-d479-41da-897c-e36129303279` and retained
**rollback v33**
`204d66c3-3296-430d-8288-39c354876600`.
Four existing secret bindings, WORK D1 identity, OAuth ON,
Owner setup OFF, merchant status writes ON, exact detail ON,
Google QA @9 read source and unchanged @7 inbox/status source were
all checked. Live anonymous health/login and restricted-route
denials passed. This is read-only evidence; no customer writes
or Worker changes occurred.

**Pending:** Owner has NOT yet shown an accepted status update
and observed revision increment. Real WORK customer message/email
delivery is also unverified. Preserve the already working v34
before changing anything.

## Phase 30 — LOCAL ONLY WORK v34-compatible UI build preparation

New `scripts/prepare-work-hq-v34-ui-local.mjs` produces only a
local `dist/server/wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json`
artifact, never uploaded or activated. It checks synced clean WORK
source, existing newer provenance classifier/UI, source manifests
with no R2/Images/merchant-write/detail activation flags, then
runs source UI/detail/merchant regressions, TypeScript, and
fresh local canary compilation.

The candidate applies the already-tested OAuth + exact-detail
transforms to the fresh locked base; requires exactly
`JILL_WORK_HOST_STAGE=canary`,
`JILL_WORK_OWNER_BOOTSTRAP_ENABLED=false`,
`JILL_WORK_OAUTH_ENABLED=true`,
`JILL_WORK_MERCHANT_WRITES_ENABLED=true` and
`JILL_WORK_HQ_DETAIL_ENABLED=true`, one exact WORK D1, and
NO R2/Images/Queues/Intake activation or plaintext secrets.
It may change local compiled server and UI code relative to
active v34: **candidate binary/code equivalence with v34 is
NOT VERIFIED** by this transform, nor have the four *deployed*
secret bindings been read in this local preparation. It is not
a production-ready UI-only patch or a staging approval.

Adversarial `scripts/test-work-hq-v34-ui-local.mjs` runs
offline in CI and rejects altered flags, extra secret/plaintext
vars, foreign D1, added R2, changed worker and malformed
source. The owner can verify it and generate the local build:

```powershell
npm.cmd run test:work-hq-v34-ui-local
if ($LASTEXITCODE -ne 0) { throw 'STOP: UI security invariant failed' }
npm.cmd run work:hq:v34:ui:prepare-local
if ($LASTEXITCODE -ne 0) { throw 'STOP: UI local build failed' }
```

**HOLD:** v34 stays active. No `wrangler versions upload/deploy`,
no remote Google Apps Script/D1/R2 operations, no paid feature.
Before a separately authorized inactive staging of a new v35,
review production code/asset differences against audited v34,
all existing four secret and D1 binding parity, route and
compatibility parity, correct Google QA @7/@9 isolation,
anonymous auth denial, and a safe v34 rollback plan. Never
use older UI deployment scripts pinned to obsolete versions.

### Phase 30 first owner Windows run — FAILED and narrow local repair pending certification

The owner pulled to `5526bbf`. The synthetic Phase 30
29-case manifest-policy test, four independent UI/detail/merchant
source tests, React Router TypeScript, and a fresh WORK canary
build all passed. Then the candidate builder stopped at
`work_hq_v34_local_ui_base_invalid`. The subsequently typed
`Write-Host PASS` was **unconditional and invalid evidence**;
this phase has NOT been certified and no new local
`wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json` candidate was written.

Root issue under investigation: generated Cloudflare/Vite Wrangler
manifests can serialize optional *inert* sections (e.g. empty
binding arrays or objects) that the initial Phase 30 validator
rejected merely for being present. The revised validator allows
ONLY precisely empty known optional sections, preserves them in
the candidate, and rejects all nonempty R2, Images, Queues,
services, Durable Objects, unsafe sections or routes. For a
future failure it now reports just the offending field identifier
rather than copying manifest values, binding details or secrets.

Phase 30 CI now separately reads the actual freshly compiled
WORK canary `dist/server/wrangler.json` with
`scripts/test-work-hq-v34-compiled-manifest.mjs`, rather than
only validating synthetic fixtures. The operator-only
`--inspect-existing-base` mode retains the stricter clean
`jill/rewards-work` branch/sync guard; the CI test supports
detached GitHub Actions checkout without provider network calls.

**Release remains HOLD:** no Wrangler upload, deploy, changes
to WORK v34/v33 traffic, Google QA, LIVE, KEEP, D1/R2, app
permissions, or paid resources. Only mark Phase 30 PASS after
the actual compiled manifest check and owner's guarded Windows
`work:hq:v34:ui:prepare-local` return exit code 0.

### Phase 30 actual CI compiler finding — zero-Queue metadata vs active binding

The first post-build CI inspection (run `38984058261`)
rejected the **actual** generated canary manifest at
`work_hq_v34_local_ui_base_active_queues`. This is materially
better evidence than the synthetic suite: Wrangler/Vite emits
a `queues` configuration section that may be object-shaped.
The first repair still treated `queues` as an array-only field.

The next targeted source correction recognizes only missing,
empty-array, or object-form Queue metadata whose ONLY optional
keys are `producers`/`consumers` and whose arrays have zero
entries. Any actual Queue producer or consumer, unknown Queue
field, value other than an array, new R2/Images/service/unsafe
binding or extra D1 remains a hard stop. Negative tests cover
both schema forms. The compile-and-inspect CI and guarded owner
Windows rerun must PASS before Phase 30 is certified. This
correction does not create or deploy a Queue.

### Phase 30 owner Windows certification — PASS, 2026-10-16

The Owner fast-forwarded `jill/rewards-work` to `746158c`
and ran guarded PowerShell commands successfully:
- `npm.cmd run test:work-hq-v34-ui-local`: **52** synthetic
  allow/deny manifest safety cases passed.
- `npm.cmd run work:hq:v34:ui:prepare-local`: the four
  WORK source regressions, React Router/TypeScript, clean
  canary build, and local candidate creation all passed.
- `npm.cmd run test:work-hq-v34-compiled-manifest`: **PASS**
  against the actual locally compiled WORK canary manifest,
  including inert zero-producer/zero-consumer Queues metadata.
- The conditional `PASS: Phase 30 LOCAL UI candidate fully
  prepared and verified.` appeared only after exit-code-zero
  verification.

Candidate path (local, ignored output, not Git tracked):
`services/jill-order-desk/app-home/dist/server/wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json`.

CI run `38984295118` at commit `746158c` completed
success across all four jobs, including actual generated
Cloudflare canary-manifest validation.
https://github.com/JILLOnline/JILL-WEB/actions/runs/38984295118

The previous first-run failure and subsequent metadata-form
repair are historical and superseded by this certified rerun.

**CERTIFICATION SCOPE:** Phase 30 LOCAL v34-compatible
configuration candidate, compile, and source test integrity
only. The live Worker remained v34; v33 rollback was not
invoked. No candidate version was uploaded, no binary/asset
diff with deployed v34 has been verified, the live four
secrets were not inspected by this local test, and no new
authenticated merchant write was proven. UI release remains
on HOLD pending real read-only v34 parity and explicit Owner
approval for an inactive WORK-only version upload.

## Phase 31 — Read-only v34 metadata vs prepared WORK UI candidate

Source-only `scripts/inspect-work-hq-v34-ui-readiness.mjs`
compares the EXACT locally built Phase 30 candidate manifest
against its compiled base, then reads **only** Cloudflare
deployment status, known v33/v34 version metadata and the
version list, using existing audited Wrangler read-only argument
builders. It reuses the v34-v33 release binding-integrity
contract and additionally checks that the v34 5 plaintext
security flags, 4 secret-binding *names and types*, exact
WORK D1 UUID, compatibility date and fetch handler match
the locally prepared manifest.

The inspector never prints secret values, raw Cloudflare
resource JSON, customer data or images. It cannot upload,
activate, deploy, update Google QA, migrate D1, access R2,
activate media or subscribe to a paid plan. It refuses altered
WORK checkout, missing local candidate or unexpected active
Worker versions.

`scripts/test-work-hq-v34-ui-readiness.mjs` is its synthetic
negative-case regression (no Cloudflare calls) in CI.
Actual read-only Windows inspection is **PENDING**.

**Important limit:** Even a PASS only compares verified
configuration/runtime metadata. The existing v34 code and
browser asset bytes are NOT available to this comparator,
so candidate-server code and asset parity remains unproven
until a separate code/asset review. A rollout may
intentionally change the UI/compiled code; it must preserve
server authentication and authorization behavior and have an
approved safe v34 rollback. Neither a PASS nor prior broad
GO authorizes an inactive Cloudflare version upload or a
traffic switch.

**Merchant-status acceptance is also still PENDING**:
the Owner has not supplied a confirmed `received -> reviewing`
WORK QA revision readback. Do not assume status writes passed.

## Phase 31 Owner Windows read-only parity — PASS

Owner synchronized `jill/rewards-work` to `1e8fb06` on
2026-10-16 and ran both commands with exit code zero:
`npm.cmd run test:work-hq-v34-ui-readiness` (15 synthetic
positive/negative cases) and
`npm.cmd run work:hq:v34:ui:parity:inspect`.
The real read-only Wrangler inspection logged:
- active v34 and retained v33 rollback;
- exactly four secret-binding names/types, exact WORK D1;
- OAuth ON, Owner setup OFF, merchant writes ON, full details ON;
- matching canary compatibility date and fetch handler.

The conditional PowerShell PASS followed the successful checks.
Earlier Phase 31 PENDING above is superseded. No uploaded
version, Cloudflare traffic switch, customer write, remote
migration, LIVE/KEEP changes or paid upgrade occurred.

**Evidence limit:** this establishes *configuration/runtime metadata
parity only*, not a binary or static asset hash match to deployed
v34. The release remains on HOLD until the changed server and
browser output is reviewed under a versioned rollback plan.

## Phase 32 — Historical source delta and LOCAL artifact inventory (PENDING)

The `f75336c6520f7dd75217cc6b6815fc828083a87d` Git
checkpoint predates the known v34 WORK release activity, but
**NO Cloudflare evidence currently binds this commit SHA to
the exact deployed v34 Worker binary**. Do not use it as an
authoritative deployed-source identification.

GitHub tree comparison between this historical checkpoint and
the Phase 31 source commit showed exactly four changed/added
WORK App Home runtime files:
- `app/components/WorkOriginalRequestDetails.tsx`: newer
  strict Cloudinary reference label, no URL/link/media fetch;
- `app/routes.ts`: adds the media inspection route;
- `app/routes/app.requests.media.inspect.tsx`: new
  disabled-by-default Owner-only inspection action;
- `workers/app.ts`: early Origin/disabled feature
  gate for that route; existing custom order command guard
  otherwise remains in place.

The historical diff shows unchanged `backend/`,
`services/custom-order-cloudflare/`, and existing WORK
Wrangler manifests in the selected source scope. It does
NOT show complete code/binary/asset parity with active v34.
There are extra new *test-only* files and private-media
helper modules outside the four in-app runtime paths;
the compiled Worker can still differ even if the routes are
disabled. This is explicitly NOT a \"UI-only\" change.

New source-only
`scripts/review-work-hq-v35-source-delta.mjs` reads
the local `git diff` for those exact runtime/auth/gateway
scopes and fails closed on any addition beyond the four
expected changed runtime files. It verifies the newer safe
reference classifier, disabled media route and local
candidate manifest. It then inventories local
`dist/server` and `dist/client` artifacts, reporting only
file count, total byte size and a deterministic SHA-256
inventory digest, NEVER actual script, customer or secret
contents. It does not access deployed v34 binary/assets.

Offline synthetic negative tests in
`scripts/test-work-hq-v35-source-review.mjs` run in CI.
The real Windows read-only inventory is PENDING:
`npm.cmd run work:hq:v35:source:review-local`.

**HOLD:** even PASS does not approve inactive v35 upload,
new media routes, remote D1, customer storage, billing or
traffic switch. Before approval, independently tie the
baseline commit to the actual deployed v34 code if possible,
review the newly compiled security-critical Worker and route,
compare browser assets to the authenticated version, and
establish safe v35→v34 rollback rather than assuming v33
rollback is enough. WORK, LIVE and KEEP remain unchanged.

### Phase 32 first Windows result — asset-inventory failure (NOT CERTIFIED)

On 2026-10-16 the owner synchronized WORK to `1dc5dd9`.
`npm.cmd run test:work-hq-v35-source-review` passed
**22** synthetic checks, including exact four-file runtime
delta acceptance. The actual
`npm.cmd run work:hq:v35:source:review-local`
stopped with `work_hq_v35_source_review_unexpected_build_file`
during `local_build_inventory`.
The later manually entered `Write-Host PASS` does **not**
certify Phase 32 because the guarded STOP already occurred.

Cause established from independent successful GitHub Vite/Cloudflare
canary build logs: the compiler emits a normal extensionless
`dist/client/.assetsignore` file, which was forbidden by the
initial extension-only inventory allowlist. Its expected presence
does not authorize broader dotfile inclusion or any new provider
binding.

The narrow repair permits **only**
`dist/client/.assetsignore` (maximum 4096 bytes), still
rejects unrelated hidden files, nested copies, unknown
extensions, symlinks and overlarge assets, and continues to
include its hash in the local inventory. New isolated
temporary-filesystem regressions enforce this boundary.
CI additionally runs the actual compiled client/server
inventory check after the WORK canary build; it sends no
Cloudflare requests and performs no deployment.

**Pending:** CI proof of this full compiled inventory and
owner Windows rerun with guarded exit codes. Even a
successful retry certifies only the local source delta and
artifact inventory, **not** comparison with actual deployed
v34 Worker and browser bytes. Version staging and switching
remain HOLD. LIVE, KEEP, Google QA, remote D1/R2 and paid
plans untouched.

### Phase 32 Owner Windows rerun — PASS, 2026-10-16

Owner fast-forwarded to `59387f9` and ran the guarded
`npm.cmd run test:work-hq-v35-source-review` successfully:
**29** offline source and filesystem adversarial cases.

`npm.cmd run work:hq:v35:source:review-local` completed
successfully against the Owner's existing local build:
- exactly **four** changed WORK runtime files relative to
  historical pre-v34 Git checkpoint `f75336c`;
- existing authentication/gateway source and source Wrangler
  manifests unchanged in the inspected Git scope;
- strict legacy-reference presentation and disabled-by-default
  media inspection guard present;
- **29** local compiled Worker + client artifact files;
- **2,847,869** bytes total;
- deterministic local artifact inventory SHA-256
  `4c50e14fcc7045fe65b68fdee7e49cee2bb11fc2f1907b0db81733a4ed4d8e60`.

The guarded exit-code checks succeeded after both commands.
This supersedes the first-run STOP caused by
`dist/client/.assetsignore`. GitHub Actions CI
`38986801665`, commit `59387f9`, also completed
all four jobs successfully, including the actual built-asset
inventory.

**CERTIFIED ONLY:** local historical source-delta boundary and
locally compiled artifact inventory. The SHA-256 is a fingerprint
of *local* candidate output, not a Cloudflare-deployed version
digest. It does not establish source commit provenance of
v34, byte-equivalence to v34's server bundle, or asset-delivery
correctness. No remote actions or customer writes were
performed by this phase.

### Phase 33 release sequencing recommendation (HOLD)

Do not treat the newly compiled candidate as a cosmetic-only UI
hotfix: historical Git comparison confirms a new media-inspection
route and Worker ingress guard, albeit disabled by default. A
safer v35 release should minimize this extra runtime surface or
explicitly review and negative-test it before staging.

Before **any** separately authorized inactive WORK v35 upload:
1. Capture deployed v34's code/artifact provenance or explicitly
   label byte parity unresolved and require a full code-diff
   security review; use v34 as the *immediate* rollback target.
2. Verify synthetic signed-in Owner request detail, request
   command/CSRF, Google QA @7/@9 isolation, media-inspect OFF,
   cross-shop access denial, and absence of new storage bindings.
3. Certify a **single real WORK QA** Received→Reviewing status
   mutation with verified Google receipt, incremented revision,
   reload persistence; this has not been observed.
4. Require an explicit owner decision for the exact inactive
   upload/version, and a separate decision for traffic release.
   An inactive upload is NOT a merchant-visible change.
5. Run post-release WORK-only Owner smoke checks, then roll back
   to known-good v34 upon authentication, inbox, command or
   detail regressions. Do not touch LIVE/KEEP or paid services.

These are release gates, not instructions to stage/deploy now.


### Phase 33 compiled local workerd guard — SOURCE ADDED, NOT CERTIFIED

This phase adds `app-home/scripts/test-workerd-v35-media-off-compiled.mjs`
and registers `test:workerd-v35-media-off` in App Home and the
`merchant_app_home` CI job, after the genuine canary React Router build.

The regression derives its *local-only* runtime flags using the existing
audited `prepareWorkHqV34LocalUi` transform. It places a disposable
manifest next to the generated `dist/server/index.js` entry, forces
`D1 remote:false`, injects only synthetic secrets, then uses
Cloudflare's **local workerd harness**. It executes the actual
**compiled candidate** rather than only invoking the source handler.

It asserts the media-inspection feature flag is **absent**, OAuth/details/
merchant-command flags are preserved, Owner setup OFF, the temporary local
D1 is healthy, anonymous same-origin media GET/POST cannot invoke the
Shopify/Google route and instead return HTTP 503
`private_media_not_enabled`, foreign/missing-Origin POST returns
HTTP 403 `invalid_origin`, a foreign LIVE host returns HTTP 421,
and the original merchant command Origin denial remains HTTP 403.
The ephemeral manifest is removed after the test. No uploaded artifact,
real Cloudflare R2/D1, customer data, Shopify/Google call, live deployment,
traffic switch or paid service is involved.

Run on Windows **after this change is merged into**
`jill/rewards-work` and the operator has a freshly built compatible
`dist/server/wrangler.json`:

```powershell
npm.cmd run test:workerd-v35-media-off --prefix services/jill-order-desk/app-home
if ($LASTEXITCODE -ne 0) {
  throw 'STOP: Phase 33 compiled WORK media-off regression failed'
}
```

**Do not mark Phase 33 certified until CI and the guarded local command
pass.** Even then, this is a synthetic compiled Worker ingress test,
NOT an authenticated WORK merchant status mutation, provider-backed
source/binary proof of deployed v34, v34-v35 browser asset comparison,
rollback execution, or permission to upload a v35 version. The
v34 `4973b74d-d479-41da-897c-e36129303279` remains the expected
immediate rollback target for any future **separately authorized** WORK
rollout. LIVE, KEEP, media, billing and remote databases remain HOLD.


### Phase 33 Owner Windows verification — PASS, 2026-10-16

Owner fast-forwarded `jill/rewards-work` to `a7bb623` and ran
`npm.cmd run test:workerd-v35-media-off --prefix services/jill-order-desk/app-home`.
The real LOCAL compiled canary workerd test returned exit zero:
**6 media-disabled/Origin/foreign-host/command denials**, preserved v34
security flags, synthetic secrets and emulated D1. The guarded
PowerShell PASS followed only after the successful command. The PR
`#125` CI run also completed four out of four jobs SUCCESS.

**CERTIFIED ONLY:** local compiled workerd media-inspection-OFF
ingress boundary. The absence of any active R2 binding, any v35 upload,
real merchant mutation or deployed-v34 code/asset provenance remain
separate. No LIVE/KEEP, Google QA, remote D1/R2 or billing change.

### Phase 34 synthetic canonical merchant status and readback (PENDING)

New offline-only regression
`scripts/test-work-hq-phase34-local-status-readback.mjs` executes:
- the real Node merchant command handler and signed v7/v9 source readers;
- the ACTUAL repository Google QA source verifier, canonical event writer,
  append helper, cache invalidation, HMAC read handlers, canonical list
  and exact request detail in a JavaScript sandbox;
- an *in-memory fixture* standing in for Google Sheets and a synthetic
  Owner Shopify session/D1 authority record, not real provider sessions.

It verifies a synthetic `received` revision 1 becoming
`reviewing` revision 2; independent signed list/detail reads returning
revision 2; append-only status and Owner actor; duplicate operation key
causing no second append; stale different-key command returning conflict;
invalid Origin denied; no real outgoing email or new worksheet.
CI runs it without any accounts or secrets.

Run only after merging the tested source into `jill/rewards-work`:

```powershell
npm.cmd run test:work-hq-phase34-local-status-readback
if ($LASTEXITCODE -ne 0) {
  throw 'STOP: Phase 34 synthetic canonical status readback failed'
}
```

**PENDING** until CI and Windows exit code zero. Even success certifies
ONLY the synthetic local status lifecycle, not real WORK QA event writes,
actual Google @7/@9 currently deployed code, live authenticated Shopify
Owner actions, real My JILL status propagation, or deployed v34 asset
provenance. Do not exercise the actual merchant button without separate
explicit Owner QA authorization and a disposable preexisting WORK request.
Never test against a genuine customer request or LIVE/KEEP. No version
staging, R2 uploads, remote D1 migrations or paid capacity changes.

### Phase 34 Owner Windows certification — PASS, 2026-10-17

The Owner fast-forwarded WORK to `c277f03` and ran
`npm.cmd run test:work-hq-phase34-local-status-readback` with exit code 0.
The test printed `PASS WORK Phase34 OFFLINE synthetic status receipt`
followed by explicit HOLD about synthetic-only sheet rows, sessions,
keys, and provider responses. The guarded PowerShell PASS message
occurred only after the successful process exit. GitHub PR #126 CI
completed all four jobs successfully.

**CERTIFIED ONLY:** simulated WORK status revision 1 Received ->
revision 2 Reviewing, authentic repository QA source HMAC verifier and
canonical event writer executed against *in-memory* sheet fixtures,
cache invalidation, independent signed v7/v9 readers, idempotent retry,
stale update denial and foreign Origin denial. No real Google QA
event was appended or read back, no current Shopify Owner session
was used, and deployed Cloudflare v34 code/browser asset provenance
was not proven.

### Phase 35 owner QA read-only preflight — SOURCE ONLY (PENDING)

A narrow operator preflight
`scripts/inspect-work-hq-phase35-qa-preflight.mjs --inspect`
runs ONLY the two previously audited read-only inspectors:

1. `audit-work-hq-detail-v9-live.mjs` verifies exact active WORK
   Cloudflare v34 and preserved v33 rollback, pinned Google QA @9
   deployment (separate @7 list/status), plus anonymous private-route
   denial. It cannot read a signed-in Owner's private requests.
2. `inspect-work-hq-v34-ui-readiness.mjs --inspect` cross-checks
   existing active v34 metadata and the locally compiled candidate
   security flag/D1/secret binding names/types without downloading
   Worker binaries, modifying versions or reading secret values.

All child outputs are treated as untrusted; the wrapper requires
exact unique sanitized PASS/HOLD/READ ONLY markers from each, refuses
missing/duplicate/error receipts, verifies a clean synced WORK Git
checkout, and never echoes raw provider stdout/stderr. It prints
fixed status labels only. Its separate OFFLINE parser adversarial
regression `test:work-hq-phase35-qa-preflight` runs in CI.

After merging and pulling the certified change:

```powershell
npm.cmd run test:work-hq-phase35-qa-preflight
if ($LASTEXITCODE -ne 0) { throw 'STOP: Phase35 offline preflight regression failed' }

npm.cmd run work:hq:phase35:qa:preflight
if ($LASTEXITCODE -ne 0) { throw 'STOP: WORK Phase35 read-only evidence missing' }
```

Both commands must pass on Owner Windows before recording a
**fresh read-only preflight**. Even PASS is **NOT** a release gate
for actual merchant writes; it does not prove a signed-in Owner
session, status mutation, My JILL persistence, customer mail delivery,
deployed v34 Worker binary/asset provenance, inactive v35 upload
safety, rollback execution or cost containment.

**Real QA mutation remains separately approval-gated.** When
separately authorized, use exactly one preexisting disposable
WORK-only QA request with confirmed `received` status/revision,
record sanitized before/after revision + status, click only the
existing WORK JILL HQ Save verified update once, require a
source acknowledgement, then reload and independently observe the
new canonical revision in WORK. If stale/error/unknown commit status
appears, STOP; do not generate a new operation_id or click repeatedly.
Never touch real customers, LIVE/KEEP, Google PROD, R2, D1 migrations,
billing or paid upgrades.

### Phase 35 Owner Windows certification — PASS, 2026-10-17

The Owner ran `test:work-hq-phase35-qa-preflight` (38 synthetic
accept/reject fixtures) and `work:hq:phase35:qa:preflight`
successfully, followed by the guarded Windows PASS. Cloudflare
returned active v34 `4973b74d-d479-41da-897c-e36129303279`,
preserved v33 `204d66c3-3296-430d-8288-39c354876600`,
Google QA @9/@7 pin isolation and anonymous Owner-only route
denials. Four WORK secrets/D1/OAuth/security flags were checked
by binding metadata only. No original request, signed-in Owner
or secret value was read by the preflight.

**CERTIFIED ONLY:** fresh read-only WORK provider metadata and
anonymous-route inspection. This is not binary/asset provenance,
an authenticated merchant status write or a version-release grant.

### Phase 36 anonymous v34 public browser asset sample — SOURCE ONLY (PENDING)

Source-only read-only inspector:
`scripts/inspect-work-hq-v34-public-assets.mjs --inspect`.
The inspector runs only on clean synced WORK, requires a local
compiled client tree and uses the pinned read-only Wrangler
`deployments status` command to check v34 active before AND
after a bounded anonymous public asset sample. It performs:

- One anonymous GET `/auth/login` on the fixed WORK canary
  workers.dev origin; no cookies, tokens or customer details.
- Up to eight same-origin `/assets/<basename>.js|css` GETs
  discovered in HTML `src`/`href` attributes. No redirects,
  cross-domain fetches, user-provided URLs or arbitrary paths.
- Bounded 512-KiB login HTML, at most 2 MiB per asset,
  byte-level SHA256 comparing each downloaded public file with
  the corresponding existing local `dist/client/assets` file.
- Aggregate file counts, matches, differences, missing paths,
  bytes and sample SHA256 only. No raw HTML, source or metadata
  is printed, stored, uploaded or committed.
- Explicit STOP on unexpected v34 deployment change, missing
  public asset references, malformed response, oversized
  payload, unsafe path, absent build or checkout drift.

CI runs only the synthetic `test:work-hq-phase36-public-assets`
parser/hash tests, with no remote HTTP calls. An actual owner
run is required for any public asset evidence.

After the reviewed change is merged and synced, run:

```powershell
npm.cmd run test:work-hq-phase36-public-assets
if ($LASTEXITCODE -ne 0) { throw 'STOP: Phase36 offline public asset fixtures failed' }

npm.cmd run work:hq:phase36:public-assets:inspect
if ($LASTEXITCODE -ne 0) { throw 'STOP: Phase36 anonymous public v34 asset sample unverified' }
```

**Scope restriction:** Observed client files may match or differ
from the newly built candidate; this is data, not a gate that
declares a release safe. It is never a complete v34 static asset
inventory, Worker script download/byte comparison, source commit
provenance, or security audit of authenticated endpoints.
Cloudflare Workers version-detail metadata has a script content
etag, but the published version-detail schema does not include
the full version-specific compiled Worker or asset bundle.
STOP does not authorize fallback to another worker URL or an
unapproved API token. The real WORK QA merchant mutation remains
separately approval-gated. No versions deployed, Google QA writes,
R2/D1 remote operations, LIVE/KEEP, paid service or traffic changes.
