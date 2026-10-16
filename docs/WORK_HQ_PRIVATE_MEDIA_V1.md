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
