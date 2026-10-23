# JILL WORK HQ — Owner Quote + Exact Shopify Catalog Preflight

**Source-only proposal, October 22, 2026.** This isolated branch was
created from the certified M1/M2 preview head. The M1/M2 source-lock manifest,
historical protected files, quote rollout receipts, and running WORK deployment
are unchanged.

## Connection built

The pure module `services/jill-order-desk/work-quote-catalog-preflight.mjs`
connects two EXISTING, separately tested WORK components:

1. `inspectWorkQuoteCommerceHandoff`: requires the exact source-revision
   signed original Custom Order plus an already saved/hydrated Owner draft,
   real Shopify customer GID and complete trusted address, exact variant,
   personalization and fee terms.
2. `reconcileWorkQuoteWithCatalog`: requires a recently verified, exact
   WORK Shopify Admin variant snapshot from the real Owner permission-bound
   reader, matching ordered variants, ACTIVE products and USD unit cents.

The result is a **PII-free Owner action plan**, not an order or a Shopify
calculation. It identifies a concrete hold stage and next action such as
`reload_saved_quote`, `map_per_unit_personalization`,
`refresh_shopify_catalog`, `compare_shopify_price`, or
`request_fresh_shopify_calculation`.

## Security and accounting boundaries

- Entire module **OFF by default** (`enabled!==true` returns HOLD).
- A **new GET-only Owner quote-preflight route exists in source**, but is
  OFF in the deployed WORK manifest and disabled without THREE switches:
  `JILL_WORK_HQ_QUOTE_CATALOG_PREFLIGHT_ENABLED` (new),
  `JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED` (existing OFF) and
  `JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED` (not activated). There is no
  enabling flag change or deployment.
- The pure transformation has no HTTP/Shopify calls. The source-only
  route reads authentic WORK source and a single bounded, read-only
  Shopify Admin Catalog query **only after** Shopify Owner + D1 checks.
  The caller
  must separately prove the SDK online Owner session, D1 permission,
  original signed Google QA detail, saved draft revision, exact customer's
  identity and provider-read variant snapshot; this pure helper does
  NOT authenticate or establish provenance of injected objects.
- No price overrides: quote/catalog mismatches HOLD for manual review.
- P1/P2 per-unit personalization, reference files, request-wide notes,
  manual extra fees, tax and discounts that lack lossless native mapping
  HOLD instead of being silently discarded.
- A positive result means **ready to REQUEST a future Shopify native
  `draftOrderCalculate`**; that network calculation is still not called.
  `can_publish`, `can_invoice`, `can_create_order`, email and
  charge permissions **remain false always**.
- No payment link, draft order, inventory/product update, mail,
  customer quote publish/acceptance, D1 mutation, R2 activation, Google
  event, secret read or LIVE/KEEP traffic.
- Output contains no customer GID, complete address, original request
  notes, unit prices or calculation intent, preventing accidental PII
  leakage if a future Owner-only screen uses the summary.
- Never replay spent historical WORK stage/activate receipts.

## Verification

Run the dedicated GitHub source-only workflow
`jill-hq-quote-catalog-preflight.yml`: synthetic prepared WORK request,
quote and catalog; cases for source revision drift, wrong customer,
lossy customization, P1/P2, manual tax, stale Shopify snapshot,
inactive product, price mismatch, wrong variant and never any commerce write.

**Owner preview route in source now exists:**
`GET /app/requests/quote-preflight?submission_id=...`
checks exact query/origin, Shopify online Owner, D1 `requests.read`,
signed Google list then exact detail, D1 saved quote hash/source revision,
canonical ProductVariant IDs, and an independently `catalog.read`
Owner-verified exact WORK Shopify catalog. No client-submitted GID,
price, customer email/address or raw terms are accepted.
All responses include `can_publish=false`, `can_invoice=false`,
`can_create_order=false`, no charge/email capability and no PII.

Without an independently verified Shopify customer GID, complete address
and shipping service provider, its successful catalog/price check is
**HOLD: verify_shopify_customer**, not invoice/checkout readiness.
Read-only checks on a mismatch return **HOLD: compare_shopify_price**;
P1/P2 allocations HOLD for personalization review.
An injected trusted context is exercised only by offline tests and is
**not supplied by the registered runtime route**.

**Before a real rollout:** certify the new source edition and complete
React Router typecheck/build, provider inventory, fresh signed ownership,
separate explicit one-use WORK release and authenticated visual acceptance.
Never reuse previous M1/M2 staging/activation receipts.
Real customer quote publication, native calculation, invoice and checkout
remain #155's later gates.

Owner handler offline regression: `node scripts/test-work-hq-quote-owner-preflight.mjs`. It exercises fail-closed feature flags (zero provider reads), GET-only input, Owner denial, signed source/source-version checks, hashed D1 saved draft validation, catalog authorization/price mismatch and missing trusted customer/fulfillment context. No external calls.

## Owner request workspace UI (source-only)

The signed exact request detail loader now projects a
`quotePreflightEnabled` **false-by-default** boolean only after the
existing Shopify SDK Owner + D1 read and signed Google detail have succeeded.
The existing HQ quote worksheet mounts a "Saved quote → Shopify readiness"
panel **only** if the Owner data enabled the new flag and the request's
management controls are available. In current WORK this flag is absent,
so no additional panel is shown or fetched.

The Owner must explicitly press **Verify saved quote**; it uses React
Router's same-origin GET loader and renders only its PII-free HOLD or
calculation-eligibility summary. It never automatically reprices, changes
a saved draft, opens checkout, charges, emails or publishes an invoice.
Even a successful source review explicitly explains that Shopify
calculation, customer acceptance and commerce authorization are separate.

Test `node scripts/test-work-hq-quote-owner-ui.mjs`, plus the existing
dedicated source tests and full embedded-app typecheck and build. No
Shopify extension, Cloudflare Worker, Google QA or D1 deployment happened.

## Exact Shopify customer identity bridge (source-only; NOT yet connected)

`services/jill-order-desk/work-quote-shopify-customer-bridge.mjs`
introduces the next independently guarded read step:

1. **Canonical signed owner binding REQUIRED:** a future **privately
   signed/verified** WORK Google QA owner-ledger read for this exact
   `submission_id` and source revision. Its proposed response schema is
   `custom_order.merchant.owner_binding.result` with an immutable
   `gid://shopify/Customer/...`, source SHA-256 and fresh timestamp.
   This is **NOT currently implemented/published** by Google QA. JSON
   schema validation is explicitly **not** an HMAC authentication proof.
   The module currently has **no registered HTTP caller**.
2. **Second Shopify Owner/D1 capability REQUIRED:** independently obtain
   online Owner and `quote.calculate` policy scope (including
   `read_customers`, `read_products`, `read_draft_orders` and
   `write_draft_orders`). Only then may the same exact private owner
   binding supply a Customer GID for the *read-only* Admin GraphQL
   `node(id)` lookup. Verify returned WORK myshopifyDomain, USD,
   expected app API key and the exact Customer GID, not email/name.
3. **Delivery still HOLD:** a successful Customer GID match proves
   identity only. It must **not** silently use Shopify defaultAddress or
   the Custom Order's city/ZIP as a confirmed full shipping destination,
   nor assume a shipping title, carrier rate or customer approval.
   `full_delivery_address_verified=false` and
   `shipping_terms_verified=false` remain hard defaults.
4. **No inferred guest ownership:** guests without a signed immutable
   `CustomOrderOwners` binding cannot proceed; email equality is never
   customer-ownership evidence. No automatic guest claim or transfer.
5. **No shipping, payment, invoice or order mutation.** No provider call
   occurs while OFF or without a trusted ownership reader; the only
   simulated positive case is in a fully isolated unit test.
   No live Google/Shopify data were queried by this step.

The synthetic suite
`node scripts/test-work-quote-shopify-customer-bridge.mjs` denies
guest/email-based identities, a stale or foreign owner binding, tampered
source revision, wrong Shopify store/app/currency/customer GID,
Owner/D1 and scope failures, and unverified shipping/address completion.
It also asserts zero calls with the gate OFF and no private contact or
shipping-address leakage.

**Do not wire into the Owner preflight route until** a separate signed
WORK QA owner-binding endpoint, canonical payload hash verification,
Shopify read scope/installation inventory, and explicit customer
address/shipping consent process are independently implemented and
verified. No historical receipt replay, no billable service.

## One-time signed Owner binding challenge (not deployed)

The unconnected WORK owner-binding reader now also demands a **response
HMAC**, calculated using the private WORK merchant-read secret over
`work_quote_owner_binding_v1`, exact WORK shop, submission ID, source
revision, immutable owner GID, raw-payload SHA-256, timestamp and a **fresh
32-character server challenge nonce**. The signed response must echo that
nonce, be at most 120 seconds old, and match via constant-time SHA-256
verification. A merely well-shaped JSON payload or a replayed/altered owner
GID cannot trigger the Shopify Customer query. No customer email lookup.

Only the future **separately published and authenticated** Google QA
owner-binding endpoint can produce this proof. Its response signing and
canonical ledger/source-hash cross-check are not yet implemented in
published Google QA; therefore the registered WORK HQ route still supplies
NO owner-binding reader and remains disabled. Nothing here constitutes
current customer authentication or authorization.

New regression covers matching HMAC, changed GID, invalid secret,
expired receipt, foreign nonce, guest, wrong source revision,
wrong Shopify customer and absent Owner scopes.

## Future Google WORK Owner binding read (no provider deployment)

`services/jill-order-desk/work-google-owner-binding.mjs` prepares a bounded
server-to-server **future** Google WORK QA read. The module is **OFF by default
and has no HTTP route, registered consumer or active endpoint**. It explicitly
rejects the immutable, already released Google merchant detail @9 URL;
that endpoint must never be repurposed.

A distinct new Google QA version must eventually support:
`jill_order_merchant_owner_binding=1` with an exact WORK shop, request ID,
source revision, timestamp, 32-character single-use nonce, and
`merchant_owner_binding_request_v1` HMAC signed using the existing
server-only WORK merchant read secret. The new internal response must be
limited to exactly 12 whitelisted fields and 2048 bytes, must HMAC
`work_quote_owner_binding_v1` over immutable ledger/customer GID and
canonical intake raw payload hash, timestamp and nonce, and must never
include customer email/name/address or raw payload.

The reader checks the response HMAC, nonce, freshness, exact source revision
and Customer GID before any future Owner handoff. The Google backend
implementation and independent server-side canonical hash/owner-ledger
correlation are **still pending** and must be tested/published separately.
The currently running WORK gateway and quote route remain unchanged/OFF.

Offline regression:
`node scripts/test-work-google-owner-binding.mjs`. No real Google request
is performed; only a synthetic backend adapter is invoked. It verifies a
domain-separated HMAC, fixed request fields, bounded response, stale/foreign/
altered owner denial, old @9 denial and zero network while OFF.

## Canonical Google QA owner ledger proof source (October 23; unpublished)

The separate `backend/google-apps-script/JILL_WORK_HQ_OWNER_BINDING_QA_SOURCE.gs`
now provides an isolated `jillWorkHqOwnerBindingProof_` handler. It is
**not dispatched by doPost**, published, or wired into the running HQ route.
It requires exact signed WORK parameters plus an independent absent-by-default
script property `JILL_WORK_OWNER_BINDING_QA_ENABLED=true`, verifies the
existing immutable `CustomOrderOwners` record against the exact original
raw intake payload SHA-256 and matching contiguous status-event revision,
then issues the response HMAC expected by the previously prepared Worker
reader. No email/address projection, ledger mutation, or guest claiming.

The offline `scripts/test-work-google-owner-ledger-qa.mjs` sandbox and the
dedicated source-only GitHub workflow exercise the handler and denial cases.
**Do not equate a committed test with a CI pass**; the latest CI conclusion
must be inspected separately. Before any deployment, certify the real
Apps Script source composition, request replay protection (a one-use nonce
store or equivalent), exact receipt provenance, Script Properties isolation,
and a new independently approved Google QA version. Do not modify the
immutable merchant detail @9 endpoint or stage/activate WORK using old receipts.

## One-use challenge replay state (source-only)

The candidate Google proof now reserves a **hashed challenge nonce** in WORK
Apps Script Script Properties while holding the existing script lock, before
emitting a signed receipt. A duplicate challenge fails closed, interrupted
requests remain consumed, expired entries are pruned, and 128 simultaneously
active entries cap free-tier storage exposure. This changes **only short-lived
anti-replay Script Properties**, not customer ledger, orders, or events.
If Script Properties are unavailable or capacity is exceeded, no proof is
issued. Source regression simulates the replay state and duplicate denial.
A fresh passing GitHub Actions run and a separate QA security review remain
mandatory before enabling or publishing this handler.
