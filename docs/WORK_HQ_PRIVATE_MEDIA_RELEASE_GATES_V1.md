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
