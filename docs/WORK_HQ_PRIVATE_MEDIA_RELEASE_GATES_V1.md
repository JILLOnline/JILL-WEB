# JILL HQ WORK private artwork — controlled release gates (source-only)

**Status: HOLD / NO PRODUCTION MEDIA.** Last reviewed 2026-10-16.
Source branch: `jill/rewards-work`. This document creates NO
authorization to execute a migration, deploy, buy a product, turn on a
route, access customer images, or write any real Cloudflare R2 object.
Neither LIVE nor KEEP is in scope.

## What is actually certified

Owner-provided Windows console outputs establish:
- Phase 18: PNG/JPEG/WebP decoded in real LOCAL Cloudflare workerd and
  re-encoded as sanitized WebP; EXIF Orientation 6 corrected; real
  malformed/animated/oversized input cases rejected; one 1280x720 JPEG
  completed in 328 ms *elapsed* (not billable Worker CPU evidence).
- Phase 19: synthetic local D1 quota+intent committed atomically,
  conditional local R2 PUT/HEAD/GET + matching SHA-256, duplicate and
  overwrite rejection, 404 public route. Emulator left storage class
  unreported: this is **not** real Standard-class proof.
- Phase 20: synthetic local failure recovery for no observed object,
  lost-write acknowledgment and mismatched metadata; quota retained
  and unlinked/ambiguous states; no automatic retry, deletion, refund
  or customer access.
- Phase 21: local D1 authority tables plus Shopify-online-session
  *shape* and verified-detail projection exercised against the
  disabled merchant-only route. Guest, non-Owner staff, wrong shop,
  expired/offline session and forged client claims denied.
  `react-router typegen && tsc --noEmit` also PASS.
  This is **not** a real Shopify production session/route verification.

Real read-only Cloudflare account analytics on 2026-10-16 observed zero
R2 stored objects/bytes and 7 cumulative October operations (HeadBucket,
ListBuckets, PutBucket). This is an account snapshot, NOT a price/billing
guarantee, and cannot prove future $0 usage.

## Current source state and hard separation

| Source / operation | Verified branch state |
| --- | --- |
| Normal/canary App Home Wrangler | WORK D1 only, no R2 or Images binding |
| Merchant inspection | `POST /app/requests/media/inspect`, OFF by default |
| Inspection when fully authorized | 503 `private_media_storage_not_connected` |
| Active migrations | 0001, 0002, 0003 only |
| 0004 registry, 0005 quota, 0006 intent | Inert proposals under `migration-plans/` |
| Worker-safe jSquash codec | Isolated local Worker, not deployed customer path |
| Local recovery observation | Candidate plan, no authenticated production executor |
| Old quarantine source adapter | UNSAFE to wire: unpersisted intent and same-MIME assumption |
| My JILL customer account media access | Not implemented or authorized |
| WORK public customer media upload/preview | OFF |

The `work-private-r2-prewrite-evidence.mjs` model **always returns
`upload_authorized:false`**, even with matching synthetic receipts.
Do not promote any account analytics, client-provided evidence strings
or preview-free local test result to provider-originated authorization.

## Required architecture — merchant-only, no customer-facing files

1. HTTP ingress requires exact CANARY host, explicit separate feature
   flag, same-origin POST check, trusted Shopify SDK
   `authenticate.admin(request)` online session, then registered WORK D1
   Owner policy *before consuming any image bytes*.
   The existing disabled `/app/requests/media/inspect` route is ONLY a
   reference-readiness diagnostic and MUST NOT be extended directly
   into an upload, download or signed URL handler.
2. Bind the intended `submission_id/scope/item_id/index` to the
   independently signed exact WORK Google QA detail response. Reject
   guessed email/phone/shop/customer IDs, arbitrary URLs, other item
   references and legacy public Cloudinary links. Revalidate ownership
   at each stage; no client-supplied `ownerAuthorized` switch.
3. Receive bounded actual bytes (8 MiB max), MIME sniff conservatively,
   limit pixel dimensions/decompression and decode via genuine Worker
   jSquash WASM; correct orientation; encode ONE still WebP, strip all
   EXIF/XMP/ICC data, then validate the output *as WebP*, recompute
   its actual post-sanitization SHA-256 and byte count. Fail closed on
   memory/CPU errors, animation, malformed data or encoder anomalies.
   Do not pass client MIME, original bytes, filenames or EXIF to R2.
4. Before a write, use a trusted **server-side** fresh bucket privacy
   check: correct pinned account and exact private bucket, Standard
   storage, no r2.dev public access, no custom domain. Verify account
   usage/operation consumption conservatively; distinguish actual
   provider metrics from cost estimates. Require documented owner
   acceptance that Cloudflare Standard free allowances are NOT hard
   account-wide caps. Another service may consume allowance.
5. On real WORK D1 schema (ONLY after explicit migration approval),
   create the exact canonical private registry row, then commit quota
   reservation and immutable object intent in a single D1 `batch()`.
   Verify expected row counts/receipt. Enforce max 8 MiB object,
   256 MiB lifetime reserved, 40 monthly uploads; reject collisions.
   No R2 PUT before the committed D1 receipt; reservation is not
   proof that billing/account safety is established.
6. Only from a separately approved privileged server executor with
   a pinned WORK-only private Standard R2 binding, perform conditional
   **one-time** PUT using the random committed object key. Use
   quarantined `application/octet-stream`, no-store, attachment
   metadata and immutable SHA/MAC. Reconcile by trusted HEAD + full
   GET and compare actual bytes/hash/metadata. Do not retry on timeout
   or over-write on `etagDoesNotMatch`. If verified, transition
   `reserved -> quarantined_unlinked`; if absent/ambiguous/mismatch,
   `reserved -> ambiguous`. Preserve quota either way. These
   state names do NOT grant a customer URL, preview, or attachment.
7. Do not connect `work-private-r2-quarantine.mjs` unchanged. It
   writes without an atomic persisted intent and expects source MIME
   equality; the real codec outputs WebP.
8. A separate future private-read capability, if ever approved, must
   re-check the caller's role and exact object/Owner relation before
   returning data and must use response headers that prevent public
   caching. NO public R2 domain, stable signed browser URLs, Google
   spreadsheet attachment leaks, HTML embedding or customer delivery
   in this release.

## Explicit gates; no inferred approvals

| Gate | Requirement | Current decision |
| --- | --- | --- |
| A — LOCAL | Real codec, atomic local D1/R2, recovery, Owner tests and TS compile | PASS for LOCAL scope |
| B — design freeze | Source-only exact authenticated upload service with complete live adapter; adversarial integration tests and performance budget | NOT DONE |
| C — retention | Document who can purge, when, audit trail, hold/exception and manual incident response; no silent auto-deletion | NOT DONE |
| D — financial | Fresh provider privacy and entire-account R2 analytics; explicit user acceptance of non-zero-charge residual risk | NOT DONE |
| E — schema | Review proposed 0004–0006 on isolated WORK D1 copy, rollback plan, remote WORK ID check, separate approval before remote apply | NOT APPROVED |
| F — deploy | Explicit separate approval to add pinned WORK-only R2 binding and deploy a disabled-by-default CANARY service; no LIVE/KEEP | NOT APPROVED |
| G — synthetic pilot | New explicit approval for one tiny test-only private object, real quota+intent verification, source and audit; no customer content | NOT APPROVED |
| H — customer rollout | New explicit approval after successful authenticated/unauthorized real CANARY tests, cost evidence and incident drill | NOT APPROVED |

Only Gate A has passed. A previous general `GO` authorizes
continued source-only engineering; it does **not** replace specific
user approval for E, F, G, H, a paid subscription or any real data
operation. A denial at any gate is a STOP with upload disabled.

## Safe rollback / incident response (future, not commands to run now)

- Disable the media-specific flags immediately; existing requests and
  approved non-media merchant command paths should remain isolated.
- Block new reservations before touching R2. Keep exact D1 intent and
  quota audit records. An uncertain PUT outcome is **ambiguous**;
  never assume it failed and blindly PUT again.
- Do not auto-delete, refund, reassign or expose any object. If an
  object exists, retain it privately and escalate for a separate
  audited, owner-approved retention/manual deletion decision.
- Reverse ONLY a separately reviewed media-specific deployment; do
  not roll back shared OWNER/Shopify/D1 0001–0003 state or touch LIVE
  and KEEP. SQL schema changes are not automatically reversible.
- Verify original WORK checkout, full CI, account R2 settings and all
  public access paths before declaring the incident contained.

## Next deliverable

Build and test a **source-only WORK CANARY upload transaction adapter**
which composes already-proven Owner authorization, actual sanitized
output, D1 reservation, trusted provider metrics/privacy, conditional
private R2 write and recovery. It must have no production binding,
active flag or live deployment, and all testing must use synthetic
Cloudflare local workerd D1/R2. The older adapter is not permitted.
Do not begin remote work until the user separately approves exact
migration/binding/pilot operations and acknowledges billing risk.

## Phase 22 — Full synthetic local transaction source built (NOT CERTIFIED)

New executable script-only LOCAL transaction code:
`services/jill-order-desk/app-home/scripts/phase22-local-media-transaction.mjs`.
**It is NOT a production upload adapter or a WORK Worker route.**
This implementation never accepts a browser HTTP Request; it is
explicitly scoped to the isolated `workerd-phase19` fake D1
`00000000-0000-4000-8000-000000000019` and fake R2
`jill-phase19-local-synthetic-artwork` with `remote:false`.
The normal WORK/canary Wrangler configs are UNCHANGED.

The local test controller composes:
- REAL `readWorkMerchantPermission` over actual local D1 authority,
  with synthetic SDK online session shape. No actual Shopify
  authentication or Google signature execution in this test.
- `chooseWorkOwnerReference` for an exact synthetic projected signed-
  shape canonical detail; rejects foreign IDs, public URLs, guests,
  staff and incorrect shop before decoding bytes.
- Explicitly **synthetic** fresh account/privacy snapshot; this is
  NOT provider-authenticated billing evidence and is NOT the real
  Phase 16 prewrite evidence gate.
- **REAL workerd WASM** PNG/JPEG/WebP -> WebP sanitized pixel output
  through the already locally verified isolated codec Worker.
  Re-inspects the output MIME, dimensions and encoded WebP bytes.
  D1, provider object metadata and SHA-256 use SANITIZED WebP bytes,
  never original upload hashes/types.
- Idempotent canonical D1 registry insertion with MAC conflict
  rejection; atomic D1 `batch()` quota+intent, unique immutable slot,
  monotonic limits. No R2 object before committed reservation.
- Conditional single R2 PUT only against fake local R2, with
  Standard requested, `application/octet-stream` no-store attachment
  headers and MAC/hash metadata. No retry on timeout or lost ACK.
- Independent fake R2 HEAD+GET full hash/metadata readback and guarded
  D1 terminal transition to `quarantined_unlinked` or `ambiguous`.
  Both preserve quota and deny customer preview, URL, download,
  automatic delete/refund/retry.

Local adversarial suite:
`services/jill-order-desk/app-home/scripts/test-workerd-media-local-transaction.mjs`.
It requires genuine WASM codec via synthetic local worker, real local
D1 authority, local D1 proposals and synthetic local R2; tests disabled,
wrong stage/shop, forged session/staff/reference, unsafe provider
snapshot, malformed image and mislabeled type, forged WebP carrying
EXIF despite claiming sanitized headers, duplicate slot,
lost ACK, mismatched metadata, PUT failure, original-vs-output WebP
SHA and negative public route access. CI includes it.

**IMPORTANT: The local `providerSnapshot` string is deliberately
forgeable for synthetic tests; this code can NEVER be invoked with a
real WORK R2 binding. The real Phase 16 account/usage gate stays
`upload_authorized:false`. Neither the old unpersisted quarantine
adapter nor this synthetic test code may be connected to a deployed
upload route.**

**Phase 22 awaits first Windows test**:
```powershell
npm.cmd run test:work-hq-media-local-transaction
if ($LASTEXITCODE -ne 0) {
  throw 'STOP: Phase 22 synthetic transaction test failed'
}
```

Gate B — production-capable, separately authorized service with
provider-authenticated evidence and retention/cost approval —
**NOT complete**. Gate E–H remain NOT APPROVED. LIVE/KEEP and real
Cloudflare data untouched.

## Phase 22 — Windows LOCAL transaction certification (PASS)

Owner synced to commit `e91a0b3` and ran all checks in Windows
PowerShell, 2026-10-16. The two JavaScript `node --check`
commands, `npm.cmd run test:work-hq-media-local-transaction`, and
`npm.cmd run typecheck --prefix services/jill-order-desk/app-home`
(`react-router typegen && tsc --noEmit`) all exited with code 0.
A conditional PowerShell PASS followed these successful steps.

The complete synthetic local test logged
`PASS WORK Phase 22 LOCAL transaction`: actual WebAssembly PNG
to sanitized WebP, actual WORK merchant Owner policy against local D1
with synthetic online-session shape, exact canonical reference,
synthetic provider precheck, atomic D1 monotonic quota/intent,
conditional **fake local R2** PUT and SHA-256 readback, lost-ACK
reconciliation and corrupt-metadata ambiguity, duplicate and invalid
input rejection, no automatic retry, deletion, quota refund, customer
preview, or remote action.

**Certification limit:** An explicitly forgeable
`synthetic_local_phase22_snapshot_only` stands in for Cloudflare
account and bucket evidence; it cannot be used to authorize a real
R2 write or guarantee a $0 bill. Shopify session shape, signed-detail
projection, and D1 policy have not yet been composed into a real
deployed customer upload route. This is LOCAL gate A, not gate B.

The Phase 22 initial "NOT CERTIFIED" note earlier in this document
is historic and superseded by this Windows PASS. Remote WORK upload
is still **HOLD**. 0004–0006 are inert; no WORK/canary R2 binding
or image subscription has been activated.

### Pre-release decision point

For future, separately approved remote work, the existing real
read-only inspectors are:
- `npm.cmd run work:hq:r2:private:inspect`: verifies pinned
  WORK account/D1, private empty Standard bucket, no R2 public URL,
  no custom domain and no normal/canary R2 binding.
- `npm.cmd run work:hq:r2:account:inspect`: reads account-wide
  storage metrics and Cloudflare GraphQL monthly operations. These
  observations can lag or be sampled; no predicted billing/overage
  guarantee can be derived.

The external provider-account scope, *freshness*, billing risk,
retention/incident response, and explicit owner approval are
unresolved production requirements. Do not treat local PASS, either
read-only inspector, or a generic prior GO as permission for a remote
migration, binding, real R2 object write or customer release.

## Phase 23 — Combined REAL Cloudflare read-only evidence preflight

New `scripts/inspect-work-hq-media-release-preflight.mjs`
runs the **two pre-existing, owner-tested Cloudflare read-only
inspectors** in one guarded terminal command:
1. exact WORK account/D1/private empty Standard R2 bucket, no
   public r2.dev URL or custom domain, no normal/canary R2 binding;
2. entire Cloudflare account current Standard/other-class storage
   and month-to-date operations, not solely the target WORK bucket.

The command refuses branch drift/dirty tracked files, unauthorized
arguments, child execution errors, missing/altered provider-readable
receipts, malformed numbers or dates, and `STOP` indications. It
does not print raw Cloudflare bodies, tokens or user files. It
returns a **read-only receipt**, NOT a signed Cloudflare certificate
or an upload/spending authorization. The target bucket must
still be empty; all-account totals may include other buckets.
All-account analytics are potentially delayed/sampled and do not
establish invoice completeness or a $0 spending guarantee.

`scripts/test-work-hq-media-release-preflight.mjs` is an
**offline parser regression** using synthetic versions of the
earlier real read-only inspector logs. It performs no network
operations; CI runs this parser check on the WORK branch.
The combined real inspection needs an owner Windows run
with the existing local Wrangler authentication.

```powershell
npm.cmd run test:work-hq-media-release-preflight
if ($LASTEXITCODE -ne 0) { throw 'STOP: Offline release preflight parser failed' }
npm.cmd run work:hq:media:release:inspect
if ($LASTEXITCODE -ne 0) { throw 'STOP: Cloudflare read-only evidence incomplete' }
```

**Phase 23 real read-only inspector: awaiting Windows result.**
The command does not call a deploy, D1 migration, R2 object API,
or billing-plan activation. Only aggregate usage and bucket privacy
are checked. Uploads, previews, migrations and production
binding remain OFF.

## Phase 23 owner Windows verification — PASS (READ ONLY)

Owner's October 2026 Windows run returned success for BOTH:
- `npm.cmd run test:work-hq-media-release-preflight`: 18
  valid/invalid read-only receipt cases passed, no mutations.
- `npm.cmd run work:hq:media:release:inspect`: live read-only
  Cloudflare WORK preflight verified exact private Standard
  `jill-work-private-artwork` bucket empty, r2.dev URL disabled,
  no custom domains and NO configured WORK/canary deploy R2
  binding. October 2026 account analytics reported **0 Standard
  bytes**, **0 objects**, and **7 R2 operations** in the observed
  month. The concluding PowerShell conditional PASS was valid.

These values are observations, NOT complete current Cloudflare
invoices or projected bills. Metrics may be delayed or sampled.
No hard $0 monthly/account-wide cap follows from these results.
The earlier "awaiting Windows" note above is historic.
**Phase 23 read-only verification is certified, NOT customer uploads.**

## Phase 24 — Retention and incident decision model (source only)

New source-only `work-private-media-retention-review.mjs`:
takes only four projection fields—`state`, `byte_length`,
`created_at_ms` and `updated_at_ms`—and produces aggregate
counts, retained D1 intent bytes and record/change ages grouped
by `reserved`, `ambiguous`, `quarantined_unlinked`, and
`revoked`. It rejects any extra fields including customer
identities, R2 object keys, reference MACs or raw URLs; it
never queries Cloudflare, deletes, previews, retries, refunds,
returns a real provider attestation, or claims an expiry date.
If reserved quota remains while the selected intent projection
has no rows, the result still requires Owner review.

`scripts/test-work-hq-media-retention-review.mjs` is an
OFFLINE synthetic adversarial test, registered in CI. Its result
must be verified on Windows. This is NOT a management UI or
a scan of real WORK D1; 0004–0006 remain unapplied.

### Pending decisions before ANY real retention implementation

- Owner-selected timeframe for ordinary completed/private files,
  unfinished reservations, ambiguous writes and revoked records.
  **No automatic expiration period is established.**
- Privacy/legal hold exceptions and incident escalation procedures.
- Separately authenticated manual operator authorization for
  irreversible R2 delete, require exact object/intent audit and
  independent provider HEAD verification before and after.
- Log evidence without leaking object keys, hashes, images,
  customer names/email/phone or secrets.
- Treat D1 `revoked` only as an accounting/state indicator;
  it does not certify object deletion, refund, fee reversal,
  customer access removal from other systems or legal erasure.
- Distinguish retention of object contents from audit record
  retention; current SQL 0004–0006 prohibits deleting records.
  Separate reviewed policy/migration may be required to honor
  actual deletion requests; never override D1 triggers casually.
- Require explicit user approval at the actual release step.
  Merely observing an age or exceeded review threshold never
  creates delete authority.

Phase 24 is **source-built, runtime verification pending.**
Keep all phases source-only; no real R2 access or database change.

### Phase 24 first Windows failure and targeted repair — awaiting rerun

The owner's 2026-10-16 Windows Phase 24 offline test stopped at an
adversarial `null` input. The review's destructured function argument
threw an uncontrolled JavaScript `TypeError` before entering the
fail-closed checks. The test correctly rejected this as a failure;
**Phase 24 was NOT certified**.

Source repair: `summarizeWorkPrivateMediaRetention(input={})` now validates
an exact four-field top-level envelope (`rows`, `nowMs`,
`quotaReservedBytes`, `quotaLifetimeReservations`) before destructuring.
Invalid outer types, null, extra PII/object-key fields, and absent
fields now throw the stable policy error
`work_media_retention_observation_unverified`. This is a strictness
improvement, not a bypass. The offline adversarial test adds invalid
outer-envelope cases. Neither file performs remote I/O or storage
mutations. No LIVE, KEEP, deploy, D1 migration, R2 operation, or
billing change occurred.

Require a Windows exit-code-0 rerun of
`npm.cmd run test:work-hq-media-retention-review` after pulling
`jill/rewards-work`. Do not print PASS outside a guarded success branch.
