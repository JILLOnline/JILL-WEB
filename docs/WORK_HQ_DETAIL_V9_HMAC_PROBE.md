# WORK Google QA exact-detail v9 — verified deployment, private read-only HMAC probe

The owner independently ran **Google clasp `list-deployments`** after an ambiguous
Google detail creation response. Remote listing visibly included:
- Original QA merchant list/status `@7`, unchanged
- Previous HQ R/W `@8`, unchanged
- **`@9 JILL_HQ_WORK_EXACT_DETAIL_V1`**, newly created
- Editor HEAD, independently present

**Do not run `work:hq:qa:detail:stage` again.** The command's
`qa_detail_creation_unconfirmed_inspect_before_retry` was an ambiguous
confirmation, not evidence creation failed.

## Credential-safe WORK-only probe

Once merged, from the clean latest `jill/rewards-work`:

```powershell
npm.cmd run work:hq:qa:detail:reconcile
npm.cmd run work:hq:qa:detail:probe
```

The first only lists the remote QA deployments and verifies v7/v8 unchanged.
The second:
1. Validates isolated WORK QA script identity and exactly one new detail
   deployment at **version 9**; takes its deployment ID from the current
   verified Google listing (not a typed URL, screen transcription or CLI key).
2. Reads `JILL_HQ_MERCHANT_READ_SECRET` from the exact
   `[WORK.GOOGLE_CUSTOM_ORDERS_QA]` section of the user's pre-existing
   local Windows vault `%USERPROFILE%\JILL-PRIVATE\JILL-SECRETS.txt`.
   Refuses missing or duplicate entries, symlinks, invalid value and
   other sections. It never prints/sends the raw secret outside an
   authenticated HMAC signature, or passes it through CLI arguments.
3. Sends two signed POSTs to only the new Google WORK QA `@9` endpoint
   using a **random, deliberately nonexistent** submission ID:
   - An independently generated wrong key MUST get `unauthorized`.
   - The actual saved WORK QA read key MUST get `not_found`.
4. Rejects HTML/login pages, timeouts, over-4KiB acknowledgement and
   unexpected response operation/code; prints pass/fail codes only.
   The server may internally scan QA rows to find that the ID is absent,
   but no real customer record is returned to the probe.

**No actual status write, email, order intake, secret rotation, Google
deployment, or Cloudflare traffic change**. No LIVE/KEEP/Rewards access.

The new Google endpoint is still not selected by the WORK HQ private
full-detail route. The next reviewed step, only after the HMAC probe
passes, is to pin the exact v9 deployment URL *separately* for detail reads
in `work-google-merchant-detail.mjs`, preserving existing v7 list/status
source. Then stage an inactive WORK Worker with the currently OFF feature
flag and run Owner/D1 security and real Shopify render tests before any
traffic switch.

If the signed probe reports STOPPED, do **not** rotate keys or redeploy
Google. Investigate error code and protected deployment versions first.

## After the HMAC proof: source pin review (no deployment)

The owner completed both the remote deployment reconciliation and signed v9
read-only probe. The next code-only review pins a **separate** v9 detail URL in
`services/jill-order-desk/work-google-merchant-detail.mjs`; the legacy
`work-google-merchant-read.mjs` v7 list/status URL must remain untouched.
This pin does **not** enable any Worker feature flag or publish customer data.

After review/merge to `jill/rewards-work`, run from clean synchronized source:

```powershell
npm.cmd run test:work-hq-google-exact-detail
npm.cmd run test:work-hq-qa-detail-pin
npm.cmd run test:work-hq-detail-view
npm.cmd run work:hq:qa:detail:pin:audit
```

The final command lists Google's WORK QA deployments **read only**, verifies
v7/v8 intact and v9 exactly matches the code's detail pin. It does not use
the private HMAC key, change an endpoint, or touch records.

Only after these checks may an **inactive** WORK canary build be staged with
`JILL_WORK_HQ_DETAIL_ENABLED` still OFF. Separately validate that the
deployed WORK Worker has its server-only read secret and genuine Shopify
Owner + D1 authorization before any proposed feature enablement. For the
first actual request test, use one disposable WORK-only submission, and
confirm per-item personalization and opaque references; no LIVE, KEEP,
Rewards, customer records, mail, statuses, or Shopify payment changes.

## Isolated WORK Cloudflare candidate stage — detail remains OFF

After **live** `work:hq:qa:detail:pin:audit` PASS, prepare exactly one
**inactive** version of the existing canary Worker. The CURRENT verified
100%-deployed canary baseline must match
`52adfbde-afb6-453e-b779-7be6f4e02519`, with four existing secret
bindings, WORK D1, OAuth ON, Owner commissioning OFF, request status writes
ON and exact-detail flag **ABSENT**.

From a clean, synchronized local `jill/rewards-work`, run:

```powershell
npm.cmd run test:work-hq-detail-v9-stage
npm.cmd run work:hq:detail:v9:inspect
```

The inspect command is **read-only**: it queries Google's deployment
listing and Cloudflare version/bindings, but reads no request payload or
secret values. If it stops, do not force staging or edit the active Worker.
The source branch includes a separate operator-invoked staging mode:

```powershell
npm.cmd run work:hq:detail:v9:stage
```

This second command rechecks all gates, runs static security regression
tests, archives the existing ignored local build, builds the WORK canary,
prepares an OAuth-ON / Owner-OFF / existing-writes-ON manifest and uploads
one **inactive** Cloudflare version. It does **not** add
`JILL_WORK_HQ_DETAIL_ENABLED=true`, run `versions deploy`, change a
Shopify app version or overwrite any Cloudflare secret. Following upload,
it checks the candidate's complete binding/resource parity against the
active version and verifies **the original active version still owns 100%
traffic**. If the upload succeeds but post-upload validation stops, an
inactive candidate may exist: DO NOT blindly rerun the stage command.

Do not confuse **code staged** with **full details operational**. The
actual detail loader remains disconnected until a second, strictly
controlled WORK-only opt-in change is inspected, rolled out and tested with
a disposable WORK request by a genuinely authenticated Shopify Owner.
Original Google @7 merchant feed/status management must remain independent.

## Confirmed inactive Cloudflare stage, and controlled OFF release

Owner's 2026-10-15 local log shows the new WORK Cloudflare version
`204d66c3-3296-430d-8288-39c354876600` uploaded **INACTIVE**.
The previous version `52adfbde-afb6-453e-b779-7be6f4e02519`
remains 100% active. All four secret bindings, WORK D1, OAuth ON,
Owner commissioning OFF, merchant status writes ON and full-detail OFF
were certified by the upload script. **Never rerun**
`work:hq:detail:v9:stage`.

The next isolated release is **code-only with full-detail still OFF**.
From the synchronized `jill/rewards-work`, use:

```powershell
npm.cmd run test:work-hq-detail-v9-off-release
npm.cmd run work:hq:detail:v9:off:inspect
```

The `off:inspect` command is **read-only**. It checks the exact
Cloudflare candidate ID/marker, protected active version, binding
identity and absence of unrecognized newer versions, and re-reconciles
Google QA v9. It must pass before:

```powershell
npm.cmd run work:hq:detail:v9:off:release
```

The release command repeats these checks, verifies anonymous WORK
health/login and denial of Owner-only inbox/detail/command endpoints,
then requests the exact local operator confirmation. It switches
**only the pre-staged version** on the isolated WORK canary and tests
the boundary again. If its own candidate becomes unhealthy, it attempts
rollback to the known previous WORK version, but never overwrites an
unexpected independent Cloudflare version. The operator must inspect
Cloudflare if any post-release check stops; do not retry blindly.

Even after this OFF code release, **customer intake detail is not yet
enabled**. Verify the signed-in Shopify WORK Owner inbox and status
management first. Turning detail ON requires a distinct, auditable
WORK-only configuration/Worker candidate and negative authorization
tests before a real disposable request. LIVE, KEEP, Rewards, My JILL,
Shopify app versions, Google QA deployments and customer records
remain outside this change.

## WORK exact detail ON: preparation only, pending signed-in Owner QA

The merchant's 2026-10-15 local release receipt confirms the
**previously inactive** full-detail-v9 code was deployed to WORK Cloudflare
as version `204d66c3-3296-430d-8288-39c354876600` and all remote
checks PASS. Original `52adfbde-afb6-453e-b779-7be6f4e02519` is
retained as a rollback target. The feature remains OFF.

**Before any new upload**, the actual Shopify WORK Owner must open
JILL HQ > Custom Orders, verify the existing inbox loads, filters work,
`Open request workspace` opens a known request, and existing status
controls are still present. Do NOT submit a status change solely for QA.
The original customer details panel should still show
`not_connected` until feature activation. A screenshot or explicit
operator report is required to accept this manual gate.

After that Owner UI check, run from clean synchronized WORK source:

```powershell
npm.cmd run test:work-hq-detail-v9-on-stage
npm.cmd run work:hq:detail:v9:on:inspect
```

`on:inspect` is read-only and refuses mismatched Google v9, wrong
Cloudflare active version, changed WORK D1/secrets, changed OAuth/Owner/
existing write flags, or already-staged ON versions.

Only after the Owner check and inspect PASS, operator may separately run:

```powershell
npm.cmd run work:hq:detail:v9:on:stage
```

The staging action is **not** a release. It runs source security tests,
builds the same WORK Worker code, runs local workerd anonymous-denial
tests using fake secrets and fake D1 while the detail flag is ON,
asks for an explicit on-device confirmation, then uploads **one
INACTIVE version**. The candidate may add only
`JILL_WORK_HQ_DETAIL_ENABLED=true`; the other nine bindings, four
secret IDs, application Worker code/handler fingerprint, D1, OAuth,
Owner setup, status writes, compatibility/runtime and asset routing
must match the active OFF version. Nothing touches Google QA @7/@8/@9,
Shopify app versions, customer data, LIVE, KEEP or Rewards.

Do not assume inactive staging enables customer details. A later
separate reviewed WORK-only release must verify Owner authentication,
D1 permission, anonymous direct-URL denial, real disposable WORK
request projection and preservation of inbox/status operations.

## Recovered inactive ON v34 and exact release (no new upload)

Merchant's read-only Cloudflare recovery verified:

- Active OFF v33 (100%): `204d66c3-3296-430d-8288-39c354876600`.
- ONE inactive ON v34: `4973b74d-d479-41da-897c-e36129303279`.
- Exact v34 marker: `JILL HQ WORK Google v9 exact request detail ON; INACTIVE owner-QA candidate`.
- `verifyWorkDetailOnCandidate` passed: only the explicit
  `JILL_WORK_HQ_DETAIL_ENABLED=true` binding was added; all existing
  four secrets, WORK D1, OAuth, Owner commissioning, writes, code,
  compatibility and asset routing match v33.

Do not run `work:hq:detail:v9:on:stage` again. Do not upload a new
Cloudflare version or rotate credentials.

The separate WORK-only, exact-v34 release script supports:

```powershell
npm.cmd run test:work-hq-detail-v9-on-release
npm.cmd run work:hq:detail:v9:on:release:inspect
```

The inspection is **read-only**, requiring clean synchronized WORK source,
live Google v9 ID matching, v33 100%-active, unique v34 with the exact
marker and no unknown newer versions. It validates all original secret
**bindings** (never reading secret values), D1, authentication and the
original v7 inbox/status source.

After the operator confirms the signed-in Shopify WORK dashboard is
healthy, the release is a separate explicit action:

```powershell
npm.cmd run work:hq:detail:v9:on:release
```

It checks anonymous WORK health/login, exact request, Owner setup and
status-command boundary **before** switching. It requests the exact
operator confirmation before performing `versions deploy` at 100% to
**only** v34. After release it checks the exact active version and repeats
the anonymous boundary checks. On its own release/post-release failure,
the script attempts rollback **only if v34 is current**; any unfamiliar
active version is left untouched and requires manual review.

**Important**: passing anonymous checks does not prove the actual
Owner-bound Google v9 customer detail read succeeds. Immediately after
an ON release, signed-in WORK Owner must open a preexisting authorized
WORK request and confirm customer/event/items, options and P1/P2
personalizations load as expected, no raw JSON/key/Google URL is displayed,
and the inbox/status workspace remains healthy. Hide customer PII in any
shared screenshots. The permitted media view is **reference IDs only**.

If real Owner QA fails, no further status mutations. The
operator-controlled rollback command is:

```powershell
npm.cmd run work:hq:detail:v9:on:rollback
```

It only targets exact v33 and requires v34 currently active plus local
operator confirmation. A successful rollback returns full-detail to OFF;
Google QA deployments, Shopify, My JILL, Rewards, D1 and LIVE/KEEP
are not modified. Do not blindly rerun failed release/rollback commands;
first inspect Cloudflare deployments status.

## WORK v34 post-release acceptance audit (no deployment)

The owner-confirmed Cloudflare release activated exactly
`4973b74d-d479-41da-897c-e36129303279` (v34) at **100% WORK traffic**
with the Google QA v9 full-detail flag ON. Immediately after switching,
the release command reported passing health/login, anonymous detail
denial, Owner setup disabled and status-command Origin denial. Original
OFF v33 `204d66c3-3296-430d-8288-39c354876600` remains available.

The pre-release `on:release:inspect` intentionally refuses to run once
v34 is active; do not repeat the release or staging commands. For
ongoing read-only operational checks, run from a clean synchronized
`jill/rewards-work` working tree:

```powershell
npm.cmd run test:work-hq-detail-v9-live-audit
npm.cmd run work:hq:detail:v9:live:audit
```

The live audit checks v34 is the exact current active Cloudflare Worker,
v33's rollback identity is present, v34 alone adds the certified ON flag,
four existing secret **references** (not values), OAuth/Owner/D1/status
bindings, runtime and source fingerprint are unchanged, and Google v9
is still the certified signed detail deployment independent of the v7
inbox/status source. It then performs **anonymous** health/login/denial
checks only, using a deliberately nonexistent ID. No privileged session,
real request details or customer PII are retrieved.

The live audit **cannot** prove the signed-in Owner actually sees the
original submitted order. For that remaining acceptance criterion, the
merchant must open the WORK JILL HQ request workspace, verify actual
customer/event/items/options, variation allocations, personalization
groups and opaque file reference IDs, and confirm the inbox/management
screen stays healthy. Any abnormal original details or unexpected access
must be investigated immediately before adding downstream features.

Do not misinterpret reference IDs as usable media files: secure reference
preview/download remains **unconnected**, and quote/payment/fulfillment
workflows remain separate. A follow-up secure-media architecture must
first establish the actual storage authority and Owner-scoped retrieval
mechanism; do not construct direct public download links from opaque IDs.

## Live audit CLI recovery — read-only, no new Cloudflare version

One WORK operator run showed the synthetic `test:work-hq-detail-v9-live-audit`
PASS, but the first real `work:hq:detail:v9:live:audit` stopped with
`cloudflare_read_failed`. This means a Wrangler metadata read returned
a nonzero exit, NOT that full detail became disabled, v34 rolled back,
or data was modified. At that time the failed wrapper omitted the exact
step and hid Wrangler diagnostics.

The recovered audit now uses the **same option order** as the successful
v34 release and owner's separate Wrangler inspection commands and
prints a fixed `READ ONLY FAILURE PHASE` for the failing read:

- `cloudflare_deployment_status`
- `cloudflare_baseline_v33_view`
- `cloudflare_candidate_v34_view`
- `cloudflare_version_listing`
- `cloudflare_certification`
- `anonymous_work_boundary`

Only the status, two known-version views and version listing are
requested; no uploads, deploys, secret retrieval, customer reads or D1
mutations. If the audit still stops, capture that phase and run **only**
the matching known read-only Wrangler command directly to expose its
native error. Never repeat ON/OFF release or stage because of an audit
failure.

## Browser Owner acceptance verified — reference URL provenance (2026-10-16)

The WORK Owner opened an existing QA request in Shopify JILL HQ after
activating Cloudflare detail-ON v34. The actual **Original request · Items
& personalization** panel displayed verified revision **2**, the QA
customer/event, one **Coloring Books** product and variant, quantity 1,
pickup, saved request-level attributes, and one Cloudinary URL under
request-level references. The test submission selected no per-unit
personalization, so this is proof of real Owner detail reads but **not**
a P1/P2 multi-group acceptance test. That needs a separate disposable
WORK request; do not mutate this original QA submission for testing.

Source investigation found the storefront form's existing
`theme/assets/jill-custom-order.js` uploads artwork via Cloudinary's
image/upload API using an upload preset and stores each returned
`secure_url` in the immutable original intake `reference_ids`.
Therefore these values are sometimes **legacy delivery URLs, not opaque
IDs**. The same QA reference was independently found as a PNG in the
connected Cloudinary library with delivery type `upload` and no
explicit access-control restriction. An HTTPS URL does not itself make
artwork private. Do not blindly embed or hyperlink these URLs in JILL HQ,
or represent them as Owner-authenticated media.

The source-only WORK UI follow-up now classifies a narrowly validated
legacy Cloudinary URL for labeling, shows only the safe filename rather
than its full delivery URL, and keeps previews/downloads disabled.
Unknown URL shapes and malformed references remain unverified.
Classification is **display-only** and never grants media permission,
contact with the external URL, access to customer data or billing.

**Private media prerequisite before any clickable preview**:
1. Establish the actual Cloudinary cloud/store boundary and current
   unsigned preset policy separately for WORK vs LIVE. Preserve old
   references; do not delete/rotate customer images as a quick fix.
2. Add an Owner+D1-authorized resolver for the exact canonical
   `submission_id`, checking that each media reference belongs to that
   specific request. Never let an arbitrary caller-supplied URL or ID
   become a media download authorization.
3. Require a provider-verified immutable asset identity and private
   delivery policy. New originals/proofs should use authenticated/private
   asset storage (Cloudinary authenticated delivery or private R2), with
   short-expiry scoped access issued **after** ownership verification.
   Existing public-style Cloudinary assets may need an explicit migration
   before privacy can be promised.
4. Test wrong staff, wrong shop, guessed request IDs, copied URLs,
   multiple items, P1/P2 groups, image/PDF limits and missing files with
   synthetic data before enabling any real preview route.

This work adds no Cloudinary asset mutations, Worker deployment,
Shopify publication, LIVE/KEEP modifications, status event write,
customer email, or public media links.
