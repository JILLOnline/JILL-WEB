# JILL HQ WORK — Private Media Authorization Foundation (source-only)

Status: **WORK source foundation and regression tests only; NOT deployed,
NOT connected to a private storage registry, and NO media download/preview
route exists.** This file does not authorize a Cloudflare deployment,
secret rotation, customer-file modification, Shopify publication, or
LIVE/KEEP change.

## Why this phase exists

The real Shopify WORK Owner detail panel for Request #3190A3B7
displayed Google QA @9's verified revision 2, customer/event information,
one Coloring Books product, and an original reference value. The
existing storefront upload flow writes a Cloudinary `secure_url` directly
into the original `reference_ids` array. Cloudinary metadata confirms
the specific QA PNG uses standard `upload` delivery without an explicit
asset access-control restriction. Neither HTTPS nor a saved URL establishes
private access or ownership. Existing reference URLs must be preserved
as immutable source evidence, not copied into unguarded clickable previews.

The original WORK Owner detail panel remains trusted for *reading request
information*, but private media delivery is a separate trust boundary.
The test request used no per-unit personalization, so the P1/P2 cases
below are synthetic, not new real customer submissions.

## Implemented access-intent contract

`services/jill-order-desk/work-private-media-intent.mjs` exposes
`inspectWorkOwnerMediaIntent` and `chooseWorkOwnerReference`. Neither
is wired to HTTP, downloads files, sends a Cloudinary request, builds a
URL, creates a signed grant, writes D1, or mutates Google.

Callers must supply verified server-held Shopify Admin session context,
a server-side Owner authorizer that checks **online Shopify staff + WORK
D1 permission**, and the certified exact-ID Google @9 reader. Authentication
must happen before reading any protected request details. The module
requires a response bound to the WORK shop, exact submission ID, Owner
role and server-auth source; this is a *defense-in-depth contract* and
**not a replacement for those actual verification services**.

Attachment selection accepts only `{scope:'request',index}` or
`{scope:'item',itemId,index}`. The actual reference value is always
taken from the authorized, immutable, canonical request. It refuses
caller-supplied URL, href, media ID, guessed item, out-of-bounds index,
foreign request, altered source projection or missing Owner authorization.
Response is a frozen, bounded **disabled-intent descriptor**; never a raw
URL, public asset ID, file blob or signed download link.

Reference categories:
- Legacy Cloudinary image URL: `preview_disabled`, reason
  `legacy_public_delivery_requires_migration`.
- Opaque reference ID: `preview_disabled`, reason
  `private_asset_registry_not_connected`.
- Unknown external URL or malformed reference: `preview_disabled`,
  reason `unverified_reference`.

These labels are explanations, not grants. Do not treat the module's
`source` field or its pure predicate as cryptographic authorization;
wire it only behind the real existing WORK Shopify/D1 server auth path.

## Synthetic acceptance tests

`npm.cmd run test:work-hq-private-media-intent` validates:

- Two selected items and a synthetic custom Coloring Books quantity 2
  with **P1 Ava/unit-1** and **P2 Mia/unit-2**, preserved exactly in the
  existing verified full-request projection.
- Request-level legacy Cloudinary URL and two item-level references
  resolve only to disabled, safe, non-URL metadata.
- Refusal of copy-pasted link selectors, foreign requests, guessed item IDs,
  forged/absent Owner grants, wrong shop or missing server authentication.
- Crucially, **no Google detail source call before the Owner grant**.
- No Cloudinary, D1, Google, Shopify or Worker network calls in the test.

## Required before a first private preview can be switched ON

1. Establish Cloudinary account boundary and current upload-preset policy
   for WORK and LIVE. Do not assume the connected Cloudinary account is
   uniquely scoped to WORK. The original QA PNG is *not currently
   demonstrated private*. No automatic moves/renames/deletes.
2. Choose verified provider storage for **future private originals**:
   Cloudinary `authenticated`/private delivery or a distinct WORK R2
   bucket. Configure and audit separate, dedicated WORK secrets and storage
   metadata outside the current original intake.
3. Add persistent per-request asset registry with unique
   `(shop,submission_id,scope,item_id,reference_index)` ownership,
   immutable provider asset ID, content hash, MIME/type validation, creation
   source, and visibility. Link existing URL references through an
   explicit owner-approved verified migration, never a URL guess.
4. Add WORK-only server media route that authenticates **Shopify Admin
   online Owner and D1** before asset lookup and each short-lived grant,
   prevents SSRF/redirects and uses provider-authenticated delivery;
   forbid public URL passthrough.
5. Deny unverified assets, wrong-shop/wrong-request/stale or revoked
   grants, alternative staff roles, overly large/bad MIME files, executable
   SVG/HTML, and customer-only routes. Keep private artwork and credentials
   out of browser payloads and logs.
6. Independently certify a disposable WORK request with two real
   personalization groups and owned attachments, before any actual
   preview activation. Preserve original canonical Google status/events.

**Do not run a Worker deployment on the strength of these synthetic
tests.** This is a source-level trust contract for the next isolated
WORK media integration, not a completed media service.

## Registry phase 2 — immutable source reference binding (source-only)

A new pure helper, `work-private-media-registry.mjs`, prepares a
**pending, disabled-only** registry record. It derives a keyed HMAC from
the exact canonical original reference **and** shop, submission ID,
request/item scope, item ID, and index. That prevents a matching digest
from authorizing a reference copied to another request, item, or slot.
It uses domain-separated SHA-256 HMAC; no raw URL, provider public ID,
email, address or file content is stored in the drafted record.

The HMAC intentionally omits revision: canonical source status updates
may increase the revision without changing the original submitted media
reference. Replacing or changing the original reference itself invalidates
the binding. The operator must provision a **dedicated WORK-only registry
MAC key** separately before any real persistence. Do not reuse a LIVE
key, the existing Google HMAC secret or a browser-exposed API key.
No new key has been created or installed by this source change.

`draftWorkMediaRegistryBinding` takes a previously Owner-verified
detail projection, a canonical submission ID, a request/item selector
and the private MAC key. It returns only a frozen record in
`pending_verification`. `inspectWorkMediaRegistryBinding` accepts
only the exact bounded pending row and compares MACs in constant time.
Even a correctly matching record returns `preview_disabled`,
`provider_storage_not_verified`. A row that claims `verified`,
includes a provider or an arbitrary URL is rejected. These helpers
**are not authentication or storage attestation**, and MUST only run
after the real Shopify online Admin + WORK D1 Owner gate.

Proposed WORK D1 schema — **DESIGN ONLY, NOT A DEPLOYABLE MIGRATION**:

```sql
-- DO NOT APPLY. Separate review, WORK D1 ID inspection,
-- dedicated secret provisioning and migration approval are required.
CREATE TABLE jill_work_private_media_registry (
  shop TEXT NOT NULL CHECK(shop='jill-work.myshopify.com'),
  submission_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('request','item')),
  item_key TEXT NOT NULL DEFAULT '',
  reference_index INTEGER NOT NULL
    CHECK(reference_index BETWEEN 0 AND 19),
  reference_mac TEXT NOT NULL
    CHECK(length(reference_mac)=64),
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK(status IN ('pending_verification','revoked','quarantined')),
  provider TEXT,
  provider_asset_immutable_id TEXT,
  provider_private_attestation_id TEXT,
  content_sha256 TEXT,
  mime_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(shop,submission_id,scope,item_key,reference_index),
  CHECK((scope='request' AND item_key='') OR
        (scope='item' AND length(item_key)>0))
);
```

The actual storage schema, provider-verified attestation, access
revocations, provider identity, content hash and safe private delivery
must be audited **before** a migration becomes executable. A pure HMAC
does not make an existing unsigned Cloudinary upload private, does not
prove file ownership at the provider, and must never become a standalone
permission to fetch. Future media grants require per-request Owner auth
plus *current* authoritative storage verification.

Offline test: `npm.cmd run test:work-hq-media-registry`.
It checks revision stability, different MACs for copied references in
other items/slots, changed secret/source rejection, malformed fields,
false `verified` statuses, URL injections, and P1/P2 preservation.
It performs no network or D1 operations.

**No new D1 migration file is present.** WORK v34 continues active
with the previous UI and media previews disabled.

## Phase 3 — WORK D1 registry SQL plan (NOT applied)

The tested MAC contract now has an explicit SQL **proposal** at
`services/jill-order-desk/migration-plans/0004_work_private_media_registry.sql`.

**Its location is intentional:** the real Cloudflare migration directory
`services/jill-order-desk/migrations/` still ends at 0003. The
0004 proposal is *not* discovered by routine Wrangler D1 migrations,
and no migration should be applied until an explicit owner-approved
WORK-only preflight verifies the database identity and retention policy.
The existing WORK Worker v34 remains unchanged.

The proposed schema provides:
- A single pending row per WORK shop + canonical request + scope +
  item + reference index. Request-level rows use empty `item_key`,
  while item-level rows require a non-empty item key.
- Only 64-character lowercase HMAC-SHA256 **reference fingerprints**,
  status and timestamps; no provider ID, source URL, file bytes, customer
  name/email, tokens or registry MAC key values.
- A foreign key to WORK staff authority; a hard-coded WORK-only shop
  check, index 0–19, uniqueness by reference location and HMAC.
- Immutable identity/MAC (UPDATE rejected), DELETE rejected, and
  irreversible `pending_verification` → `revoked` or `quarantined`
  transitions; rows cannot start with a `verified` status.
- No preview authorization, even for a properly matched pending row.

`npm.cmd run test:work-hq-media-registry-sql-plan` uses **in-memory**
Node SQLite, first loads the existing 0001–0003 migrations, then
validates 0004 twice (idempotence). Tests reject invalid shop, references,
scope, item, index, MAC syntax, statuses, duplicate bindings, direct
identifier/MAC rewrites, DELETE, and revoked→pending transitions. The
existing session and inbox tables stay untouched. There is **no network
connection**, real D1 database, Cloudflare deployment, key provisioning,
or artwork request involved.

Before moving the proposal to the real migration folder: separately
review release timing, backup/export strategy, WORK D1 database ID,
dedicated MAC key provisioning, actual Owner-authenticated insert/read
adapter, migration/test compatibility with production D1 (not just SQLite),
and explicit dry-run and rollback procedures. **Do not execute
`wrangler d1 migrations apply` based on this document.**

## Phase 4 — read-only real WORK D1 preflight (NO migration)

The proposal and keyed binding code have now passed local Windows tests,
including isolated in-memory SQLite. The next approved checkpoint is
**metadata only** on the real WORK Cloudflare account.

Use `work:hq:media:d1:inspect` from clean, synchronized
`jill/rewards-work`. It is a read-only inspector, not a migration command.
The code refuses unrecognized CLI arguments or SQL, checks the exact
canary Worker v34 and its D1 binding UUID, compares the WORK D1 name/UUID
against Cloudflare's account inventory, and executes **only** constant metadata SELECT queries against
`sqlite_master` and (when present) the `d1_migrations` filename ledger.
It confirms whether the four foundational JILL WORK tables are present,
whether the optional 0003 inbox index is missing/present, and that the
private-media registry does **not** already exist. It requires the source 0004 proposal to remain outside
the real `migrations/` directory. The command repeats the v34 active
version check before returning success.

The query never selects customer rows, access tokens, contact details,
messages, file references, or artwork. The script never calls D1 migrations,
`INSERT`, `UPDATE`, `DELETE`, asset storage, secret provisioning,
Cloudflare traffic deployment, Google Apps Script, or Shopify writes.

Offline syntax and negative tests:

```powershell
npm.cmd run test:work-hq-media-d1-preflight
```

Only after the offline test passes and operator explicitly chooses a
**read-only remote inspection**, run:

```powershell
npm.cmd run work:hq:media:d1:inspect
```

The inspector fails closed if Wrangler's JSON shape is not recognized.
It prints `READ ONLY FAILURE PHASE` so the exact metadata command can
be checked manually. A failure is **not** permission to migrate or
rotate keys.

**Migration remains forbidden at this checkpoint.** Work still required:
a dedicated WORK registry MAC secret in the user's local owner-controlled
secret vault; a reviewed D1 backup/rollback plan; the exact sanctioned
WORK migration command and database ID; then a separate staff-authorized
server adapter and real provider-private asset attestation. Neither a
matched registry row nor a public Cloudinary URL establishes media privacy.

## Observed real WORK D1 baseline — 0003 table absent (read-only receipt)

Owner's read-only Wrangler schema query returned exactly four
JILL-prefixed tables: `jill_merchant_audit`,
`jill_merchant_authority`, `jill_merchant_grants`, and
`jill_shopify_sessions`. No media registry is present. In particular
`jill_work_verified_inbox_index` is **absent**, despite migration
`0003_work_verified_inbox_index.sql` existing in Git. Cloudflare
reported `rows_written: 0` and `changed_db: false`.

The original preflight required five tables and failed with the
ambiguous message `work_media_schema_unexpected_or_registry_already_exists`.
We have now reconciled that validator to identify the observed
**four-table pre-0003** state separately from the future **five-table**
state. Both are supported *read-only observations*, and neither grants
permission to apply a migration. Any unrecognized JILL table, missing
core table, or already-present registry **still fails closed**.

The repaired inspector additionally checks the presence of Cloudflare's
`d1_migrations` metadata table. If present, it selects **migration
filenames only**, never session/customer rows. It explicitly distinguishes
a 0003 ledger entry from the absence of the 0003 table: a ledger claiming
0003 applied while the table is missing is a **STOP** condition. A missing
ledger or an unrecorded 0003 is a **HOLD** pending separate assessment.

**Important:** The presence/absence of a table by itself does not prove
whether a migration was run, skipped, manually created or later dropped.
Do not run `wrangler d1 migrations list` or
`wrangler d1 migrations apply` in this incident without reviewing the
database's existing migration ledger and the exact WORK-only rollout.
There are still **no actual D1 writes, keys, file previews or deployments**
as part of this diagnostic change.

## Post-0003 WORK D1 baseline / media 0004 read-only gate

On 2026-10-16 the Owner **successfully applied** migration
`0003_work_verified_inbox_index.sql` to the exact WORK D1 database.
Wrangler reported one migration applied; the release script and a
separate read-only postflight verified **five** expected JILL tables,
**three** migration-ledger entries, and **one initial empty** inbox-index
row. WORK Worker v34 remained active, fast inbox remained **OFF**, and
there were no changes to LIVE, KEEP, Rewards or Google QA.

The following new command **only inspects metadata**:

```powershell
cd C:\Users\itzen\JILL-WEB
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run test:work-hq-media-0004-readiness
if ($LASTEXITCODE -ne 0) { throw 'STOP: Offline test failed' }
npm.cmd run work:hq:media:0004:inspect
if ($LASTEXITCODE -ne 0) { throw 'STOP: Read-only 0004 audit failed' }
```

The gate pins Worker v34, the exact WORK D1 UUID, five JILL tables,
three recorded migrations, one empty 0003 seed, absence of the
`jill_work_private_media_registry` table, and the **inert**
`migration-plans/0004_work_private_media_registry.sql` file outside
the active Wrangler migration directory.

The result deliberately reports **HOLD**, not a release authorization.
The proposal contains no private storage backing, signed media delivery,
proof that existing Cloudinary links have been made private, or provisioned
HMAC registry key. A pending row cannot produce a usable image URL.

Remaining gates before ANY actual 0004 D1 migration or image-preview route:
- Dedicated WORK-only 32–512 byte HMAC key provisioned securely under
  Owner control; never checked into Git or exposed to customer accounts.
- Real private-storage choice and provider-side privacy proof, including
  rules for the existing *public* Cloudinary `image/upload` references.
- Exact authenticated Shopify online Owner + WORK D1 grants wired to the
  canonical signed Google QA @9 full-detail reader, before any media
  registry lookup or asset access.
- Independently reviewed authorized asset-copy/migration process, with
  immutable source binding, short-lived signed delivery, revocation,
  audit logs and explicit retention/deletion policy.
- A separately approved WORK-only 0004 migration and its own fresh
  recovery checkpoint, preflight, tests and verified postflight.
  Do not reuse the 0003 approval or claim the 0003 bookmark establishes
  recoverability for a later migration.

**No remote 0004 schema writes, secret provisioning, Cloudinary/R2
upload/download, private-link generation or Worker deployment is part
of this source phase.**


## Phase 5 — WORK private artwork ingress bytes contract (source only)

Owner's 2026-10-16 read-only remote inspection PASS confirms the
expected v34 WORK D1 database, migration 0003 complete, five JILL
tables, three ledger records, and one initial empty inbox cache row.
The 0004 registry remains absent/inert. No private-storage capability
or media authorization is implied by this result.

New pure server-side boundary:
`services/jill-order-desk/work-private-media-ingest-contract.mjs`
exports `inspectWorkPrivateArtworkBytes({bytes,declaredMime})`.

- Accepts **byte arrays only**, never a Cloudinary link, external URL,
  reference ID, customer-controlled storage path or asset identifier.
- Limits input to **8 MiB** and validates declared MIME against a
  PNG/JPEG/WebP signature. PNG additionally checks its IHDR
  dimensions, with maximum side 10,000 pixels and area 40 megapixels.
  SVG, HTML, PDF, ZIP, arbitrary content, HEIC/HEIF and unmatched
  MIME signatures are rejected from this staging path.
- Produces only an immutable fingerprint/size/type candidate with
  `storage_state:not_written`, `privacy_attested:false` and
  `delivery_state:disabled`. It returns no file content, private or
  public URL, provider ID, object key or delivery token.
- **Not full image decoding, sanitization, malware scanning, or
  provider-side private object validation.** In particular, checking
  format headers alone cannot detect every malformed or malicious
  image. A future authenticated ingestion service must decode and
  safely re-encode artwork, enforce dimensions/resource budgets,
  write to dedicated private WORK storage and independently attest the
  written object's confidentiality and ownership.
- Must be called **after** actual Shopify online Owner + WORK D1
  authorization, not directly from an anonymous upload route.
  This source module is not that authentication boundary.
- Existing legacy public `res.cloudinary.com/.../image/upload`
  links remain unresolved original evidence. They are **not copied,
  relabeled or made private** by this code, and never authorize a
  preview or a registry row by themselves.

Offline adversarial regression:
`npm.cmd run test:work-hq-private-media-ingest-contract`.
CI executes it without any real Cloudflare, Shopify, Google, R2,
Cloudinary, secret, D1 write, artwork read or customer submission.

**Still HOLD:** choose/verify WORK private storage provider and
separate WORK credentials, implement the authenticated ingest route
and full image decode/sanitization, certify owned private objects with
revocation/retention, then seek a **new separate approval** for 0004.
Do not run `wrangler d1 migrations apply` or deploy WORK v35
based only on this source contract.

## Phase 6 — WORK-only Cloudflare R2 quarantine adapter (source-only)

**Provider choice: Cloudflare R2 for NEW WORK artwork only.** Owner approval here covers source design and tests, not provisioning or deployment. NO R2 bucket, secret, R2 token, binding, route, D1 migration or deployed Worker was created. Existing public Cloudinary image/upload URLs remain original evidence; no automatic asset copy or private preview.

New module: services/jill-order-desk/work-private-r2-quarantine.mjs. Planned bucket: jill-work-private-artwork. Planned binding: JILL_WORK_PRIVATE_ARTWORK_R2. Those constants do NOT modify app-home/wrangler.canary.jsonc. No HTTP endpoint calls the module.

The staging adapter requires authenticated online Shopify Admin + WORK D1 Owner permission before reading the exact signed Google QA detail for the matching submission ID, item and reference index. It derives the keyed original-reference MAC from that verified request. Legacy Cloudinary URLs are explicitly rejected from the **new-upload** path. Only canonical opaque references may be staged.

File bytes must pass the existing PNG/JPEG/WebP bounded-header contract, then a trusted server-only image decoder/re-encoder/sanitizer callback, then another bounded check. Such a sanitizer does NOT YET EXIST in the live application; a browser assertion of sanitizer success has no authority.

Before any R2 access, a privileged server-side Cloudflare-account privacy audit callback must confirm the exact bucket and binding, the bucket exists, the r2.dev public development URL is disabled, and no custom domain exposes the bucket. The audit must be recent (maximum five minutes). This real audit callback and R2 binding do NOT YET EXIST. A self-reported client flag is never valid evidence of private provider configuration.

Only after these gates would the future adapter use a random work/quarantine/v1/UUID object key with no customer data, immutable-reference ID or URL. It uses R2 conditional PUT (etagDoesNotMatch '*'), SHA-256 write-integrity, application/octet-stream and private/no-store attachment metadata, then verifies the provider PUT and HEAD key, length and metadata. On ambiguous write, it fails closed without auto-retry, delete, GET or display.

A successful future source-layer call would return only quarantined_unlinked, private_delivery disabled, registry_persisted false. It never returns a provider key, signed URL, raw file or media grant. IMPORTANT: the inert 0004 registry only models the pending original-reference MAC; it has no real verified object linkage. No actual uploads or delivery should be enabled until a separately audited D1 object-linkage/reconciliation model exists.

Offline regression command: npm.cmd run test:work-hq-private-r2-quarantine. It uses a synthetic bucket and fake Owner, Google and Cloudflare audit callbacks. Tests cover permission order, legacy URLs, raw byte forgery, MIME/type and sanitization gates, public/stale/wrong R2 audits, fresh random keys, strict PUT/HEAD verification and ambiguous results. No real R2, customer records, secrets, Google/Shopify or Cloudflare operations occur.

**Release HOLD:** independently create and audit the isolated private WORK R2 bucket (disable BOTH r2.dev and all custom domains); configure binding and least-privilege credentials; implement trusted image decoder/re-encoder, account privacy-audit service, authorization route, D1 provider-object linkage, retained-original reconciliation and orphan cleanup policy; certify a disposable WORK image; get separate Owner approval for any 0004 migration, Worker deployment or real upload. Existing WORK v34 and LIVE/KEEP/Rewards remain untouched.

Official references: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ and https://developers.cloudflare.com/r2/buckets/public-buckets/


## Phase 7 — verified empty private R2 bucket and source-only Images Free sanitizer

Owner's 2026-10-16 Cloudflare CLI receipts establish the real R2 bucket
`jill-work-private-artwork` now exists in the correct Cloudflare account
with **Standard** storage, **0 objects / 0 B**, `r2.dev` public access
disabled, and **no custom domains**. Bucket creation itself did not make
a media route, Worker binding, upload capability, grant, or D1 registry.
Wrangler initially auto-edited app-home/wrangler.jsonc to add an
incorrect lowercase binding with `remote:true`; the owner restored that
tracked file cleanly.

A separately created
`services/jill-order-desk/app-home/wrangler.r2-local.jsonc` specifies
the intended `JILL_WORK_PRIVATE_ARTWORK_R2` binding with `remote:false`
and is ignored through local `.git/info/exclude`. The canonical WORK
and canary deployment configs still have **no R2 bindings**. Existing
untracked local files are preserved; no automatic cleanup.

The owner confirmed both previous offline test suites passed:
`test:work-hq-private-r2-quarantine` and
`test:work-hq-private-media-ingest-contract`. No remote operations
occurred during those tests.

New **source-only** module:
`services/jill-order-desk/work-private-images-sanitizer.mjs`, with
offline mock regression `test:work-hq-private-images-sanitizer`.
It targets Cloudflare Images' raw-byte Workers binding, not Images
paid hosted storage. It rejects foreign shops, missing trusted
Free-plan/quota gate, unsupported or mismatched input bytes, failed
transformations, mismatched output MIME, and oversized outputs.
It requests a bounded decode/re-encode with `metadata:'none'` and
`anim:false`, then re-checks output bytes. Its mock tests do **not**
prove real Cloudflare decode, output metadata removal or production
quarantine writes. The gate callback is a contract placeholder,
**not** an implemented authoritative account-wide budget ledger.

**Still HOLD:** No Image binding in deployed Worker, no real sanitizer
attestation, no authorized media upload/preview route, no safe provider
object registry, no 0004 D1 migration, no R2 media PUT/GET, no
LIVE/KEEP/Rewards/Google QA changes. Before a first real transformation:
independently confirm account is on Images Free (5,000 unique
transformations/month; excess blocked on Free), implement atomic
server-side per-account usage protection and Owner auth linkage,
and certify decoded/re-encoded fixtures in an isolated WORK harness.
Before any real R2 upload, additionally certify privacy audits, quotas,
orphan/reconciliation/retention policy and D1 linkage. No paid-plan
upgrade is authorized. Official pricing:
https://developers.cloudflare.com/images/pricing/


## Phase 8 — conservative Images Free budget reservation contract (source-only)

Owner's Windows PowerShell PASS receipts certify all three existing
offline suites following a clean `jill/rewards-work` fast-forward:
Images sanitizer, R2 quarantine, and bytes intake validation. The
local-only R2 configuration remains excluded through
`.git/info/exclude`; neither canonical WORK nor canary is R2-bound.

New pure module:
`services/jill-order-desk/work-private-media-budget-gate.mjs`.
Its offline regression is `npm.cmd run test:work-hq-media-budget-gate`,
now included in source-only WORK CI. It provides a callback compatible
with the existing sanitizer's budget-gate interface. This is **not**
a live budget service: no Cloudflare account-usage reader, Images account
plan attestor, or atomic transactional reservation adapter is installed.

Default gate is fail-closed without trusted server-owned dependencies.
Its synthetic contract pins the owner's known Cloudflare account and
WORK Shopify shop. It denies non-Free/unknown plan, incomplete usage
covering other Workers and shops, wrong month, usage older than five
minutes, bad counters, missing or unsuccessful CAS reservation, and
wrong nonce. The proposed local soft ceilings are 4,500 account-wide
unique Images transformations (500 below the Free allowance) and 100
WORK reservations per UTC month. *Neither is an enforceable Cloudflare
billing ceiling or proof of real usage.* The atomic reservation provider
must be a future durable cross-request compare-and-reserve transaction;
in-memory increments, a bare SELECT/UPDATE, or an optimistic client
response are forbidden. Tests use mocks only.

Current Cloudflare documentation:
- https://developers.cloudflare.com/images/pricing/ documents 5,000
  unique Free transformations per calendar month; requests beyond Free
  return 9422 with no overage charge while the Free plan remains active.
- https://developers.cloudflare.com/images/optimization/binding/
  documents raw-image-byte binding calls and says local low-fidelity
  tests can avoid cloud usage.
- https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/
  still lists an Images Paid subscription in its prerequisites. Resolve
  the exact account's entitlement **before** enabling real Images binding.
- https://developers.cloudflare.com/r2/pricing/ documents Standard R2's
  separate account-wide metered storage/operations with no guaranteed
  hard $0 ceiling. This Images gate does NOT limit R2 billing.

**Release HOLD continues:** no Images/R2 binding deployed, no account
subscription change, no credential rotation, no real transformation,
no request route, no customer uploads/preview, no 0004 D1 migration,
no provider-private delivery or LIVE/KEEP/Rewards/Google QA change.
Real usage must remain OFF until Owner approval of fully certified
account-plan reads, atomic quota ledger, R2 account-wide capacity and
operation budget, authenticated uploads, sanitizer output proof, storage
privacy, object linkage and cleanup.

## Phase 9 — FREE local Node artwork decoder (WORK source/testing only)

2026-10-16 user screenshot: Cloudflare Transformations usage showed 0/5,000
and no zones; Images & Stream > Plans showed **unchecked paid hosted
Images storage at $5/month per 100,000 stored assets** and Stream priced
separately. Neither optional subscription was selected. The Images
Workers binding's eligibility remains unverified. No Cloudflare Images
storage, zone, or paid feature is needed for this phase.

Created `tools/work-media-local/` as an entirely separate Node-only
harness using pinned open-source Sharp 0.34.1. `sanitize.mjs` accepts
in-memory PNG/JPEG/WebP bytes, validates the existing JILL byte contract,
fully decodes and re-encodes pixels, normalizes to sRGB and at most
3,000px on either output side, strips EXIF/XMP/ICC metadata, and
checks the output type/bytes/metadata again. It fails closed on
animated/multi-frame content, unsupported input, mismatched MIME, invalid
decode, images above 24 million input pixels, over 10,000px per side,
and outputs exceeding the caller's bound (max 8 MiB). It does not
create URLs, store files, call Cloudflare, or read customer artwork.

A real native Sharp decoder was exercised on local synthetic PNG/JPEG/
WebP fixtures. Tests checked stripped synthetic EXIF, rejected spoofed
headers and genuinely animated WebP, resized a valid wide image,
and rejected corrupted or oversized input. Its CI script will
independently install this separate Node package, never importing
Sharp into app-home or workerd. Windows owner must separately run
the install/test and report local results before certification.

To run offline on the owner's Windows repo:

```powershell
npm.cmd run work:hq:media:local:install
if ($LASTEXITCODE -ne 0) { throw 'STOP: Local Sharp install failed' }
npm.cmd run test:work-hq-media-local-sanitizer
if ($LASTEXITCODE -ne 0) { throw 'STOP: Real local decoder test failed' }
```

**Important scope limit:** Sharp's native Node module CANNOT run inside
the Cloudflare Worker. This is not a production upload sanitizer and
does not prove malicious image content has been fully neutralized.
It is a local decoder implementation and offline validation baseline,
not a subscription-enabled Images binding, media preview, R2 upload,
operator-attested service, or replacement for signed Shopify Owner+D1
authorization. Automatic customer uploads would require an independently
audited Worker-compatible sanitizer or a separately approved private
Node service, plus storage, quotas, authorization, signed evidence
retention and delivery checks. No such backend was deployed.

The existing WORK R2 bucket stays empty/private; the proposed 0004
registry stays inert and cannot be applied from this phase.
No changes to LIVE, KEEP, Rewards, Google QA, customer data or
Cloudflare account billing were authorized or performed.

## Phase 10 — real local decoder through synthetic WORK quarantine

Owner's PowerShell receipt confirms `npm.cmd run
test:work-hq-media-local-sanitizer` PASSED on Windows with genuine
PNG/JPEG/WebP pixels, EXIF removal, dimensional bounds, animated/malformed
image rejection and **zero cloud operations**. The npm allow-scripts
warning was nonfatal; do not globally approve additional scripts.

The new `tools/work-media-local/test-quarantine-integration.mjs`
executes `stageWorkOwnerR2Quarantine` with a **real Sharp decoder**,
a fully synthetic Google detail projection and Owner+D1 authorization
callback, and an in-memory fake R2 bucket. A test JPEG contains synthetic
EXIF data and must be re-encoded without it before the fake conditional
PUT. The fake HEAD verifies key, content hash, metadata, and size.
Negative cases reject non-owner authorization before canonical detail,
legacy public Cloudinary links, header-spoofed JPEG, publicly exposed
or stale R2 account audit results. The stage response stays
`quarantined_unlinked` and `private_delivery:disabled`.

This is a real local *integration test*, not proof of real provider
storage or server-held identity. CI runs both decoder and integration
tests under the isolated `tools/work-media-local/` Node dependencies.
It does not install native Sharp in the deployed Worker, create
credentials, enable customer uploads, write actual R2, or run migration
0004. For Windows:
```powershell
npm.cmd run test:work-hq-media-local-quarantine
if ($LASTEXITCODE -ne 0) { throw 'STOP: Local quarantine integration failed' }
```

**Remaining release blockers:** trustworthy deployed upload
architecture (Sharp is local-only), real authenticated Owner session
checks, canonical exact detail endpoint, enforceable R2 account-wide
storage/operations budget, operator-attested bucket privacy state,
provider object linkage and recovery/retention strategy. No LIVE,
KEEP, Rewards or Google QA changes are authorized from this test.

## Phase 11 — read-only real R2 empty/private preflight (source only)

Owner's Windows console confirmed Phase 10 offline **PASS**: authentic
Sharp JPEG re-encoding with synthetic EXIF removal, simulated Owner +
WORK D1 access control and canonical exact-request projection,
in-memory fake R2 PUT/HEAD, and denial of unsafe/public/legacy uploads.
No network or Cloudflare object usage was involved.

Added `scripts/inspect-work-hq-r2-private-preflight.mjs` and offline
regression `scripts/test-work-hq-r2-private-preflight.mjs`. Remote
inspection is read-only and is allowed only when the tracked Git
WORK branch is clean and up-to-date locally, the local-only
`wrangler.r2-local.jsonc` has the expected binding with
`remote:false`, and both canonical WORK/canary Wrangler configs have
NO deployed R2 bindings.

Strict Wrangler metadata command allowlist: `whoami`,
`d1 info jill-order-desk-work ... --json`,
`r2 bucket info jill-work-private-artwork --json`,
`r2 bucket dev-url get jill-work-private-artwork`, and
`r2 bucket domain list jill-work-private-artwork`. The inspector
requires the pinned Cloudflare account, WORK D1 UUID, Standard storage,
**zero objects and zero bytes**, disabled public r2.dev and zero custom
domains. Any unexpected or changed condition STOPs instead of
repairing or deploying; no customer object listing/GET/PUT and no
D1 migrations or secret operations.

Run on Windows after pulling and offline test:
```powershell
npm.cmd run test:work-hq-r2-private-preflight
if ($LASTEXITCODE -ne 0) { throw 'STOP: Offline R2 inspector tests failed' }
npm.cmd run work:hq:r2:private:inspect
if ($LASTEXITCODE -ne 0) { throw 'STOP: R2 privacy metadata preflight failed' }
```

This is a **point-in-time privacy/empty-bucket check**, not authoritative
account-wide R2 cost accounting or a spending cap. Later legitimate
objects require a separately reviewed inspector revision rather than
weakening this gate. Before any real R2 upload: implement and certify
durable per-account operation/storage quotas, authenticated server-only
source ingestion, object linkage with D1 reconciliation, and controlled
retention. R2 storage and operations remain separately metered.
No R2 Worker binding, upload/preview route, D1 0004 migration,
Images subscription change, LIVE/KEEP/Rewards or Google QA mutation
was authorized or made.

## Phase 12 — WORK R2 durable quota reservation SQL proposal (INERT)

Owner's Windows logs confirmed both Phase 11 tests PASSED:
offline read-only R2 auditor and real Cloudflare metadata. The real
private Standard bucket is 0 objects / 0 B, r2.dev OFF and no custom
domains; normal WORK/canary deployment configs have no R2 bindings.

Source-only files:
- `services/jill-order-desk/migration-plans/0005_work_r2_quota_guard.sql`
- `services/jill-order-desk/work-private-r2-quota-plan.mjs`
- `scripts/test-work-hq-r2-quota-plan.mjs`

0005 is NOT in the active `migrations/` directory. Like the inert 0004
media registry proposal, it MUST NOT be applied without a distinct
Owner-approved review and recovery checkpoint. The offline test uses
only in-memory Node SQLite and loads active 0001–0003 locally. It
simulates one conditional SQL UPDATE ... RETURNING per reservation,
avoiding a non-atomic SELECT then UPDATE quota race.

Proposed WORK-only conservative guard:
- Max single sanitized image: **8 MiB**.
- Cumulative ever-reserved WORK storage: **256 MiB**, deliberately
  irreversible without a separately audited recovery/retention process.
- Maximum **40** requested WORK quarantine uploads per UTC month.
- Each upload reserves **one Class A PUT and one Class B HEAD**.
  No separate GET, LIST, preview, retry or delete access is authorized.
- Monthly operation counters can start fresh in a later month, but
  cumulative reserved bytes and reservation sequence never reset.
- Failed/ambiguous R2 writes conservatively keep their reservations.
- Exact WORK Shopify shop, no customer PII, raw URLs, provider object
  keys or secrets in the counter table.

**Crucial limitation:** this is a planned ceiling on one authorized
WORK application workflow, NOT certified account-wide R2 accounting,
a hard cloud spending cap, a live D1 table, a release-ready
reservation adapter, or protection against other Cloudflare callers.
A secure deployment needs an authoritative complete account-wide
storage/operation snapshot (including other services), freshness
requirements, server-held Owner access, provider-private R2 audit,
D1-based reconciliation and extra metered operations controls.
Cloudflare bills Standard storage and Class A/B operations separately,
even though its free monthly allowance is generous:
https://developers.cloudflare.com/r2/pricing/

Local offline regression:
```powershell
npm.cmd run test:work-hq-r2-quota-plan
if ($LASTEXITCODE -ne 0) { throw 'STOP: R2 SQL quota plan regression failed' }
```

**Release HOLD:** no live R2 writes, Worker binding, Cloudflare Images
upgrade, LIVE/KEEP/Rewards/Google QA mutation, or D1 migration
0004/0005 permitted from this phase. Private preview stays OFF.

## Phase 13 — R2 object-intent linkage and fail-closed reconciliation (INERT)

Owner's Windows PowerShell receipts: `test:work-hq-r2-quota-plan` and
`test:work-hq-r2-private-preflight` both **PASS**. Those are offline
tests; Phase 11 is the last independently verified *real* Cloudflare
metadata inspection and reported 0 R2 objects / 0 B.

New **source-only** proposal at
`services/jill-order-desk/migration-plans/0006_work_r2_object_intents.sql`,
not in `migrations/`. It would require BOTH reviewed 0004 (immutable
canonical-reference MAC) and 0005 (quota guard) first. A row records a
random server-private quarantine object key, reference slot/MAC, R2
SHA-256, byte count, reservation UUID and lifecycle. It does not
store raw Cloudinary URLs, artwork, names, email, file blobs or secrets.
Each slot and key can only be claimed once. The registry FK + trigger
rejects reference copied from another item/slot, deleted source, or
a source no longer in `pending_verification`.

The lifecycle is `reserved -> ambiguous` or
`reserved -> quarantined_unlinked` or `reserved -> revoked`.
`ambiguous` and `quarantined_unlinked` may only transition to
`revoked`; terminal states cannot be automatically revived. No
DELETE or identifier/hash/key rewrite. None of these states grants
customer or staff previews.

The new `work-private-r2-object-intent.mjs` derives an immutable
server-only proposed intent from the exact verified request projection,
then classifies a synthetic provider HEAD plus account privacy receipt
as `quarantined_unlinked_candidate` or `manual_review_required`.
A matching receipt is advisory only: a caller-supplied `source` label
can be forged. Production must independently authenticate the Owner
and obtain provider evidence server-side. No GET/PUT/DELETE, retries,
refunds, URL generation, or delivery exists here.

`test:work-hq-r2-object-intent` uses offline Node SQLite, loading
active 0001–0003 and inert 0004–0006 into memory. It checks an isolated
`BEGIN IMMEDIATE` quota-update + intent-insert transaction, duplicate
rollback, wrong MAC/slot, independent object keys, immutability,
ambiguous/revoked lifecycle, stale/wrong/private HEAD cases and preview
denial. Windows verification and GitHub CI must pass before calling
the source phase certified.

**Important release blockers:** the existing
`stageWorkOwnerR2Quarantine` remains **unwired** to the proposed
intent ledger. It currently generates a random key before a synthetic
PUT without persisting the key beforehand. Therefore it must NOT be
connected to real R2 until a new explicitly audited pre-PUT
quota-and-intent persistence workflow exists. Real Cloudflare D1
transaction/batch atomicity is NOT established by Node SQLite; neither
a forged R2 HEAD receipt nor a D1 state is sufficient to prove
provider privacy or file ownership. Account-wide storage/operation
usage and deletion/retention recovery still need authoritative review.

No 0004/0005/0006 migrations, real media writes, Worker bindings,
customer routes, Cloudflare Images subscriptions, or LIVE/KEEP/
Rewards/Google QA changes are authorized.

## Phase 14 — D1 transactional quota+intent batch contract (SOURCE ONLY)

The owner confirmed Phase 13 OFFLINE Windows tests PASS:
`test:work-hq-r2-object-intent` and `test:work-hq-r2-quota-plan`.
No D1/R2 remote changes occurred.

Cloudflare D1 official documentation (as of 2026-10-16) specifies
`D1Database::batch()` runs prepared SQL sequentially as one
transaction, and a failed statement rolls back the entire batch:
https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

Source-only `work-private-r2-d1-batch-plan.mjs` composes exactly two
prepared statements, with no intervening statements:
(1) the existing conditional `UPDATE ... RETURNING` 0005 quota
reservation; (2) the 0006 immutable object intent `INSERT ...
RETURNING` with a first NOT NULL column guarded by
`CASE WHEN changes()=1 THEN ? ELSE NULL END`. The latter deliberately
throws on zero rows updated: monthly/lifetime quota exhaustion must
never leave an intent record. A duplicate, invalid HMAC, missing FK,
or other intent INSERT failure must roll back the quota update.
No separate `.run()` calls or SQL `BEGIN/COMMIT` are part of the
Cloudflare Worker API design; one `.batch()` transaction is required.

Offline regression `test:work-hq-r2-d1-batch-plan` uses only
in-memory `node:sqlite` and a D1-like batch facade, with active
0001–0003 and inert 0004–0006 locally. It simulates 40 distinct
canonical reference slots, the 41st quota-denied request, duplicate
slot retry, forged MAC, a missing row/forged receipt, and ensures a
failed INSERT leaves quota counters unchanged. A real
`D1Database::batch()` on WORK has **NOT** been exercised, and
the compatibility of SQLite's `changes()` with the deployed D1
Worker binding still requires a separately approved **local
workerd-only** runtime test before any remote migration.

This is a PLANNER, not a call site. It exposes an object key solely
to a hypothetical trusted private server; DO NOT log or serialize the
planner or its reserved intent into an HTTP response. Receipt
inspection never grants R2 PUT, GET, preview, retry or quota refund.
Real production use still requires a verified online Shopify Owner
session and D1 authority, signed exact Google detail, fresh private
bucket status, authoritative account-wide R2 usage/quota gates,
persistent retention/recovery, and explicit approval for migrations.

**Release HOLD:** no deployed R2/Images bindings; no customer files,
remote R2/D1 writes, migrations 0004–0006, Cloudflare paid plan,
LIVE/KEEP, Rewards or Google QA modifications.

## Phase 15 — isolated real LOCAL workerd D1 batch semantics

Owner's Windows console confirmed Phase 14 OFFLINE SQL-facade tests PASS:
`test:work-hq-r2-d1-batch-plan` and
`test:work-hq-r2-object-intent`. They did not reach real D1 or R2.

Cloudflare publishes the official `createTestHarness()` API with
`getWorker().getEnv()`, which returns LOCAL Worker storage bindings:
https://developers.cloudflare.com/workers/testing/test-harness/prepare-test-state/
and:
https://developers.cloudflare.com/workers/testing/test-harness/configure/

Phase 15 creates an **independent synthetic Worker** only in
`services/jill-order-desk/app-home/workerd-phase15/`. Its name is
`jill-work-phase15-local-only`. Its synthetic D1 binding
`JILL_PHASE15_LOCAL_D1` uses database name
`jill-work-phase15-local-synthetic`, fabricated UUID
`00000000-0000-4000-8000-000000000015` and `remote:false`.
There is no R2 binding, admin credential, public route, custom domain,
secret, Shopify SDK integration or Cloudflare account configuration.
The Worker returns 404 for every request, and is not part of the
deployable App Home Worker. Neither canonical WORK nor canary
Wrangler config changes. Only this isolated local binding can be
accessed from the test. Cloudflare's local harness does NOT run remote
D1 transactions.

`scripts/test-workerd-r2-d1-batch-local.mjs` uses the installed
App Home Wrangler test harness, reads real active migration *source*
0001–0003 and inert *proposal source* 0004–0006, and applies copies
ONLY inside the synthetic local D1 binding. It seeds synthetic
Owner/reference identities and runs the *actual D1Database.batch()*
method with the Phase 14 two prepared statements. It verifies normal
reservation, duplicate-reference rollback, forged MAC rollback,
monthly 40/41 exhaustion, absent orphan intent after zero-row UPDATE,
and 404 for the synthetic Worker route. It never writes to actual
WORK D1. A successful local test is not remote migration approval.

From repo root after clean fast-forward:
```powershell
npm.cmd run test:work-hq-r2-d1-workerd-local
if ($LASTEXITCODE -ne 0) {
  throw 'STOP: Real local workerd D1 test failed'
}
```

If the test harness is missing, install only the already declared
App Home development dependencies in its isolated package. No
`wrangler d1 execute --remote`, `migrations apply`,
`wrangler deploy`, new Cloudflare account resource or R2 PUT is
allowed. Node local test success does NOT certify live Owner sessions,
server-side account-wide cost budget, actual R2 privacy on upload,
recovery, private preview/delivery, or storage linkage.

**HOLD remains:** migrations 0004/0005/0006 inert, no real upload,
no customer preview, no Images paid subscription, and no
LIVE/KEEP/Rewards/Google QA changes.

### Phase 15 repair — source-comment compatibility (still NOT certified)

The owner's first Windows real local workerd run after commit
`dc54ce3` **FAILED** in the fixture seeding stage:
`D1_EXEC_ERROR: SQL code did not contain a statement`, referencing
the first `-- WORK-only planning migration` line of active 0001.
The user subsequently executed a standalone green PowerShell
`Write-Host PASS` despite the thrown failure; that printout is
**not evidence of successful workerd testing**.

This is a harness/setup issue: passing commented, multi-statement
migration source wholesale to `D1Database.exec()`. Cloudflare has
documented/reported D1 failures on comment-only statements. The repaired
local harness now strips full-line SQL comments, splits the six fixed
audited SQL sources into exactly 23 prepared statements while preserving
`CREATE TRIGGER ... BEGIN ... END;` blocks, and executes each with
the synthetic local D1 `prepare(...).run()`. Only the later
**two-statement transactional quota+intent test** still calls the
real local `db.batch()`. It does not modify SQL proposals, canonical
Worker, deployed app or remote account.

A review against the actual committed six fixture files confirmed
statement counts 5+2+2+5+4+5=23, no incomplete statements and no
unexpected inline SQL comments. Actual workerd results must still be
run by the Windows owner. The diagnostic now says `INFO` when fixtures
load and reserves the only final `PASS` for completion of the entire
transaction regression. Treat any nonzero process exit as FAIL,
regardless of a separately printed PowerShell status.

**HOLD:** no D1 migrations 0004/0005/0006, R2 writes or Worker deploy;
LIVE/KEEP/Rewards/Google QA unchanged, paid features off.

### Phase 15 — CERTIFIED with actual local workerd D1, 2026-10-16

After the comment-loader repair at commit `104e0ab`, the owner
pulled and ran `npm.cmd run test:work-hq-r2-d1-workerd-local` on
Windows. **PASS**, confirmed by process exit 0 and program output:

`INFO local WORKERD: 23 synthetic schema statements loaded`
then `PASS local WORKERD D1 batch`. The local D1 test confirmed a
successful 2-statement quota/intent transaction, duplicate and forged
MAC rollback, 40/41 monthly quota denial and zero orphan records.
The only database was a synthetic `remote:false` D1 binding.
This certifies local runtime SQL behavior, not remote D1 or application
authentication. The older "still NOT certified" section above describes
the earlier failure and is superseded by this exact passed rerun.

## Phase 16 — guarded pre-write account evidence (SOURCE ONLY)

New source-only validator:
`services/jill-order-desk/work-private-r2-prewrite-evidence.mjs`,
with offline regression `scripts/test-work-hq-r2-prewrite-evidence.mjs`.

This guard demands matching:
- A validated two-statement committed intent receipt from the
  previously certified Phase 15 D1 batch contract.
- The exact image input bytes SHA-256 and byte count matching the
  immutable intended private object; declared MIME must match bytes.
  **This test does not decode images** — full Sharp sanitation is a
  separate prerequisite.
- A fresh (at most five minutes old), complete account-wide
  R2 usage snapshot, including all buckets and other account
  services, not a single WORK bucket's size.
- Conservative **advisory** account thresholds: 512 MiB current
  Standard storage, 1 GB-month projected Standard storage,
  10,000 Class A and 20,000 Class B operations per UTC month.
- Private WORK R2 bucket with no public r2.dev URL/custom domains,
  matching account identity and fresh privacy evidence.

All usage/provenance values are merely **test contracts** for
yet-unimplemented trusted server provider readers. A client can forge
the strings `source`, `complete`, or `billable_overage_possible`.
Neither this validator nor a snapshot can guarantee a $0 bill or
atomically stop other services in the Cloudflare account from
consuming allowance. If the provider does not expose authoritative
current/projected metrics, real uploads must remain DISABLED instead
of trusting estimates, dashboards, or caller statements.

The gate's only success state is
`synthetic_prewrite_checks_satisfied` and it always reports
`upload_authorized:false`, `preview_enabled:false`,
`auto_retry:false`, `quota_refund:false` and
`remote_migration_authorized:false`. No D1/R2/Cloudflare call
or Worker route occurs. The previous unpersisted source-only
`stageWorkOwnerR2Quarantine` has not been wired to real R2;
do not deploy it as an upload handler. Before real R2 PUT,
architecture must replace that path with server-owned persistent
intent plus authentic account-use proof, stable recovery, bucket
privacy, and separate owner approval.

The synthetic test checks 29 adverse scenarios: mismatched bytes,
MIME/receipts, foreign account/shop, incomplete or stale metrics,
cost threshold crossing, paid-plan responses, public bucket and
spoofed evidence, with no cloud operations. It must PASS on Windows
before treating this *source-only phase* as checked. GitHub CI
runs the same regression.

**HOLD:** migrations 0004–0006 not applied; real uploads, previews,
Cloudflare Images paid subscription and LIVE/KEEP changes OFF.

## Phase 17 — real read-only account-wide Cloudflare R2 usage telemetry

Owner's Windows `test:work-hq-r2-prewrite-evidence` output:
**PASS**, 29 adversarial synthetic denials. This is NOT proof of
Cloudflare account usage, provider authenticity, billing or an upload.

On 2026-10-16, Cloudflare's first-party API docs were checked:
- `GET /client/v4/accounts/{account_id}/r2/metrics` is an
  account-level R2 inventory of Standard and Infrequent Access bytes,
  metadata and object counts:
  https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/metrics/
- GraphQL `r2OperationsAdaptiveGroups` supports an account-level
  query by accountTag without a bucketName filter, using a month-to-date
  time window (maximum 31 days):
  https://developers.cloudflare.com/r2/platform/metrics-analytics/
- Cloudflare documents `wrangler auth token --json` to retrieve the
  locally authorized OAuth/API bearer credential:
  https://developers.cloudflare.com/workers/wrangler/commands/general/
- Storage, Class A and Class B are independently metered with
  monthly Standard free allowances, but those are **not hard bill
  limits**: https://developers.cloudflare.com/r2/pricing/

`scripts/inspect-work-hq-r2-account-usage.mjs` is a local operator
diagnostic, NOT a deployed billing/usage endpoint or Worker code. It
requires clean tracked files, exact synced WORK Git HEAD, pinned
Cloudflare account, WORK D1 config with no R2 binding, and active
migrations exactly 0001–0003. It captures the local Wrangler auth token
from a subprocess **only into process memory**; never prints token,
auth stderr, request header, provider error body or raw response.
It makes exactly two API calls to `https://api.cloudflare.com`:
the account-level R2 storage `GET` and a fixed read-only GraphQL
query `POST` for month-to-date R2 operation counts. No bucket filter,
no mutation query, account-provisioning call, object list/GET/PUT,
D1 query, migration or Worker deploy. JSON results are parsed
locally and summarized to numeric, privacy-safe observations.

Any absent GraphQL account entry, provider error, invalid/partial
object metric or >=10,000 operation groups is a STOP. A permissions
error is NOT zero usage. If the token does not have analytical read
permission, use Cloudflare dashboard Billable Usage and R2
analytics to inspect separately; do not upgrade or request broader
privileges blindly. `test:work-hq-r2-account-usage` exercises the
parser with synthetic provider results in an offline regression.

**Critical distinction:** adaptive GraphQL analytics may be delayed
or sampled, and the storage API is a snapshot, not month-end GB-month
billing. These metrics can establish observations but do not prove
`accountUsage.billable_overage_possible=false`, precise remaining
allowances, whether another service will use resources, or a
mathematical $0 hard cap. Do NOT feed this inspector receipt into
the Phase 16 synthetic gate as if it were authoritative billing
evidence. The diagnostic always marks:
`complete_billing_evidence:false`,
`safe_spend_guaranteed:false`,
`can_authorize_r2_upload:false`.

Operator Windows procedure (run from clean synced branch):
```powershell
npm.cmd run test:work-hq-r2-account-usage
if ($LASTEXITCODE -ne 0) { throw 'STOP: Offline analytics parser failed' }
npm.cmd run work:hq:r2:account:inspect
if ($LASTEXITCODE -ne 0) { throw 'STOP: Real read-only usage query failed' }
```

**HOLD:** Migrations 0004–0006 remain inert; REAL R2 upload/preview
routes, Worker bindings, paid subscriptions, LIVE/KEEP and Google QA
unchanged. No customer media is accessed.

### Phase 17 — REAL account-wide R2 analytics receipt and release decision

**Owner-confirmed Windows PowerShell execution, 2026-10-16 (UTC month 2026-10)**

- `npm.cmd run test:work-hq-r2-account-usage`: PASS, synthetic
  Cloudflare response/parser regression.
- `npm.cmd run work:hq:r2:account:inspect`: PASS, **real read-only
  Cloudflare account-level metrics** via local Wrangler auth.
- Observed Standard storage: **0 bytes, 0 objects**.
- Observed other storage-class usage: **0 bytes**.
- Observed October R2 operations: **7 total**;
  `HeadBucket=2`, `ListBuckets=4`, `PutBucket=1`.
- The script printed no tokens, created no storage objects, and made
  no Cloudflare mutation call. These observations are not an invoice
  or a billing guarantee; adaptive GraphQL analytics can be delayed.

**Financial architecture decision: R2 Standard is a reasonable
LOW-USAGE candidate for WORK private artwork.** Cloudflare's
2026-10-01 R2 pricing documentation confirms that the
Standard-class free monthly allowances include 10 GB-month storage,
1,000,000 Class A requests and 10,000,000 Class B requests, with no
egress fee. The currently proposed WORK-only 256 MiB cumulative
reservation and 40 uploads/month are comfortably below those
allowances **on their own**; other account usage or future behavior
could still incur charges. These observations do not warrant a
paid subscription or weakening the hold:
https://developers.cloudflare.com/r2/pricing/

**Primary release blocker is now PRODUCTION IMAGE DECODE/SANITIZATION,
not baseline R2 quota volume.** The tested Node `sharp` sanitation
is real but cannot execute directly inside the Cloudflare Workers
runtime. Cloudflare's 2026-06-10 tutorial currently lists
an **Images Paid subscription prerequisite** for its raw-byte
Workers Images binding, even though external-image
*URL-based transformations* have a Free allowance:
https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/
https://developers.cloudflare.com/images/pricing/

Under JILL's explicit no-paid-activation constraint, do NOT enable
Cloudflare Images Paid, add `images` or `r2_buckets` to any
canonical deployed WORK/KEEP/LIVE Worker, buy Images hosted storage,
or attempt to pass public legacy Cloudinary URLs as verified private
artwork.

**Next engineering objective (not yet implemented):** a
Worker-compatible, no-subscription real image decode/re-encode
boundary, tested against genuine PNG/JPEG/WebP with corrupt files,
multi-frame, metadata, malformed headers, decompression-bomb
limits, runtime memory and CPU pressure, using only a synthetic
local Worker first. If a reliable Worker-native sanitizer cannot
be demonstrated within verified free runtime limits, explicitly
consider an owner-operated separate private Node service rather
than presenting the local `sharp` harness as an automatic online
upload pipeline. Such an operator service would require its own
authentication, operating availability and costs. Browser-only
re-encoding is not a security boundary.

Only after sanitizer feasibility and owner signoff: attest true
online Shopify Owner + WORK D1 authorization; apply an approved
migration sequence; commit quota + durable intent atomically;
verify real provider privacy and storage operations; implement
conservative recovery/retention; and launch a tiny WORK-only
synthetic upload pilot under explicit separate approval.

**CURRENT RELEASE STATE: HOLD.** D1 0004/0005/0006 proposals inert,
WORK R2 bucket empty/private at last verified inspection; no
customer media uploads/downloads/previews, no remote storage
mutation, no paid subscription; LIVE and KEEP untouched.

## Phase 18 — Free WASM image decoder in LOCAL Cloudflare Worker

Owner's latest instruction: **GO FOR IT** on a free, real Worker-compatible
image decode/re-encode boundary rather than another mock-only stage.
No customer uploads or remote writes were authorized.

jSquash has an upstream Cloudflare Worker (ES-module) example requiring
manual WASM imports and module initialization:
https://github.com/jamsinclair/jSquash/tree/main/examples/cloudflare-worker-esm-format
WASM modules are supported by the Workers runtime:
https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/

**Source now on isolated WORK branch (not yet Windows-certified):**
- `tools/work-media-edge/package.json`: pinned open-source WebAssembly
  codecs `@jsquash/png@3.1.1`, `@jsquash/jpeg@1.6.0`,
  `@jsquash/webp@1.5.0`. No paid Cloudflare Images binding, no Sharp
  native code inside the Worker.
- `tools/work-media-edge/sanitize.mjs`: pure Worker-safe JS
  conservative pre-decoder header gate and real decoder/output
  checker, max 8 MiB input/output, 3000 pixels each axis, 4 million
  source pixels, detect and forbid animated PNG/WebP; read JPEG EXIF
  orientation and apply raw RGBA orientation before WebP re-encode.
- `tools/work-media-edge/worker.mjs`: synthetic local Worker loads
  JPEG/PNG/WebP WASM decoders, encodes one metadata-free WebP,
  returns bytes to a synthetic-only test harness. It has no R2/D1,
  Images/Shopify/Google, secrets, network fetches or storage calls.
- `tools/work-media-edge/wrangler.jsonc`: independent
  `jill-work-edge-codec-local-only` Worker, `workers_dev:false`,
  no live Worker IDs, routes, migrations, bindings or paid services.
- `services/jill-order-desk/app-home/scripts/test-workerd-media-edge.mjs`:
  actual Cloudflare local workerd integration through official
  Wrangler `createTestHarness`, generating genuine PNG, EXIF-bearing
  JPEG and WebP files using the existing locally installed Sharp,
  and re-decoding/validating WebP outputs to verify dimensions,
  actual changed bytes, EXIF/ICC/XMP removal, color sanity and
  malformed/mislabeled/oversized/two-frame WebP rejection. It also
  benchmarks a genuine 1280x720 patterned synthetic JPEG and checks
  EXIF Orientation=6 pixel rotation and metadata stripping.
  Elapsed milliseconds are NOT Cloudflare billed CPU measurements.
- `work:hq:media:edge:install` + `test:work-hq-media-edge-workerd`
  are root npm scripts; WORK App Home CI installs WASM package and
  synthetic fixture dependencies and runs the genuine local Worker test.

**IMPORTANT:** this is a genuine WASM *implementation candidate* and
source-only test. Neither codec bootstrapping with the exact installed
npm package versions nor real workerd runtime CPU/memory, orientation
handling for phone JPEGs, production-scale throughput nor any server
upload/preview path has been certified. The owner's Windows test
result is the next gate. WebP output is an intentional format
conversion, and the older quarantine adapter currently assumes
same-MIME output and MUST NOT be connected without redesign.

Run from clean synced Windows WORK branch:
```powershell
npm.cmd run work:hq:media:edge:install
if ($LASTEXITCODE -ne 0) { throw 'STOP: WASM codec install failed' }
npm.cmd run test:work-hq-media-edge-workerd
if ($LASTEXITCODE -ne 0) { throw 'STOP: Real local Worker codec test failed' }
```

The npm codec install is local to `tools/work-media-edge/` with
`--ignore-scripts`; no keys, local files from customers, free-to-paid
plan changes, Worker deploys or Cloudflare API use occur.
Even after a real local workerd PASS, account-wide no-bill guarantee,
retention/recovery, authenticated Shopify Owner entry, D1 migrations
0004–0006 and actual R2 quarantine remain separately on HOLD.
