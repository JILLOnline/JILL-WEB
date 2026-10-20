# JILL Theme Core Architecture Decisions

## 2026-10-19 — real quote calculation before commerce creation

The existing agreement owner consumes exact Shopify calculations through one
server-only adapter. Reuse online Owner/D1 authority, verify the same WORK
installation, require effective product/customer/draft scopes, disable extra
discounts, and reconcile exact integer amounts/personalization/customer before
freezing. A missing address is explicitly unpublishable; never turn a provisional
zero tax into a final quote. Calculation creates no draft or invoice, changes
no wallet, and does not activate an HTTP route or release. Owner's latest
no-hang direction leaves navigation in place while this work proceeds. See
`WORK_QUOTE_SHOPIFY_CALCULATION_2026-10-19.md` for actual platform evidence and
remaining gates. Existing one-create/reconciliation and LIVE boundaries stand.


## 2026-10-19 — one compact visual theme for all HQ tabs

Use one authenticated parent CSS foundation with shared palette, density,
controls and focus. Existing screen CSS owns compositions; use the documented
Polaris large page width, not shadow-DOM overrides, zoom or duplicate page
styles. Preserve labels, notices and controls. A source/AST guard prevents
behavior, policy/copy, backend, theme or extension changes. The new WORK visual
release preserves the current exact bindings/flags and 0% quote canary, uses
new one-use receipts, and requires exact provider/runtime read-back. No paid
resources, new product dependency, schema, wallet, app identity or LIVE work.


## 2026-10-19 — exact uploaded HQ activation with owned restoration

Reuse the canonical staging metadata/receipt helpers; never build or upload
again to activate an already verified candidate. Bind activation to the exact
Owner-provided candidate, source and package hash. Keep the original quote
canary at 0% and conversation/quote drafts disabled on ordinary traffic.
Resolve ambiguous deploy acknowledgements by read-back, not repetition.
Restore only this runner's uniquely attributed unchanged deployment, once,
and hold on changed/unreadable state. No secret rotation, schema/resources,
new billing, app-dev URL changes or LIVE operation. Source checks and health
cannot substitute for authenticated end-to-end WORK acceptance.


## 2026-10-19 — bounded catalog reads and expired-create recovery

Extend the existing catalog projection/screen rather than creating a new
catalog owner. Keep products/collections under product scope and inventory/
locations under their explicit Owner/online scope intersection. Verify the
returned WORK shop and currency; untracked inventory is unknown availability,
not zero stock or labor capacity. Minimum-scope preparation is explicit and
local; actual app release, consent and online grants remain separate evidence.

Once Shopify creation has been claimed, quote expiry may prohibit a new create
but must not prevent read-only reconciliation of a resource already created.
A failed search remains held; it never establishes absence or permits another
create. No active agreement/Rewards/commerce service is enabled by this source.
The corrected gateway diagnostic failure is closed by the Owner's exact signed
receipt; all deployment receipts are spent and secret rotation is unwarranted.

## 2026-10-19 UTC — current inventory and minimal diagnostic operation

The Owner's fresh metadata and edge clock confirm the existing 0% diagnostic
can be inspected without reusing its spent deployment receipt. Build its
replacement from the exact old source, selecting only canonical zero-byte
handling and a runtime response header. Keep ordinary traffic on the same
100% candidate, inherit the original five bindings, and reserve distinct new
upload/deployment receipts atomically. Ambiguous outcomes go to read-only
inspection, never automatic replay or secret rotation. Full feature builds
are independently gated. Keep My JILL composer drafts only in composing-screen
memory across refresh and prune against each fresh verified account response;
an uncertain send retains its original operation until receipt recovery.

## 2026-10-19 UTC — HTTP emptiness, one conversation and held financial activation

**Decision:** Authenticate the gateway diagnostic challenge first, then
validate zero bytes through a bounded HTTP stream reader. Never infer a key
mismatch from a 403 alone. Real workerd HTTP converts the Owner's empty POST
into a non-null stream with Content-Length 0; the previous null-stream check
rejects the correct key/time. HMAC and the 60-second window stay unchanged.

**Decision:** Customer replies reuse the existing locked Google event writer
and immutable owner ledger with a domain-separated signed ingress and receipt
read. Version-two public history filters internal-only events; HQ and My JILL
consume that same whitelist. No general chat store, additional extension or
email-derived ownership. Activation is gated independently in Google/Worker.

**Decision:** Keep agreement publications/acceptance/commerce intent in the
existing WORK D1 boundary, with additive schema outside active migrations
until runtime review. Commit acceptance and intent atomically, confirm the
canonical public accepted event, claim one creation, then reconcile ambiguous
Shopify results without a second create. Quarantine does not clear itself.
This local foundation does not implement the missing public quote routes,
invoice flow, actual Shopify adapter or scheduler.

**Decision:** Universal Rewards arithmetic/migration planning is backend-only
and prepares the existing owner for a later versioned activation. v13 remains
the active wallet/discount owner. Issued coupons retain original terms; no
new customer deduction occurs in HQ. Fresh WORK app scope reads confirm draft
and product/inventory/location scopes are missing; connector authority does
not bypass those application/staff gates. Full local and runtime evidence is
recorded in `WORK_CONNECTED_ACCEPTANCE_2026-10-19.md`.

This log records decisions and rationale so future contributors do not repeatedly reopen settled architecture questions. It does not replace the Constitution or contracts.

## 2026-09-08 — Theme Core starts clean

**Decision:** Build a fresh `theme/` inside `JILL-WEB` rather than importing the full current Dawn-derived JILL production theme.

**Why:** The live theme contains overlapping fix/polish/authority layers and is useful as a behavioral/visual reference but expensive and risky to normalize into a commercial architecture.

**Consequence:** Proven JILL behavior is migrated contract-first, feature by feature.

## 2026-09-08 — Skeleton/original path, not Dawn derivative

**Decision:** Theme Core follows Shopify's approved Skeleton/original-development path for potential Theme Store eligibility.

**Why:** The commercial goal includes a reusable/sellable theme, and the current production Dawn derivative should not define the new product's architecture.

**Consequence:** Dawn implementation details are reference evidence only.

## 2026-09-08 — Rule 1 is no duplicates

**Decision:** No concept may have multiple canonical owners.

**Why:** Most accumulated JILL instability came from layering new fixes/logic on top of existing owners rather than replacing/consolidating ownership.

**Consequence:** Before adding code, the owner is found or explicitly defined. Parallel implementations fail architecture review.

## 2026-09-08 — No `!important` and no styling outside CSS assets

**Decision:** Theme Core forbids `!important`, inline `style`, `<style>`, Liquid stylesheet blocks and JavaScript style mutation.

**Why:** Specificity escalation and distributed styling destroy predictable ownership and merchant-scale maintainability.

**Consequence:** Styling problems are solved through tokens, semantic variants, cascade order and the canonical CSS owner.

## 2026-09-08 — Three canonical CSS owners

**Decision:** Storefront presentation has exactly three CSS owners unless a future architecture decision changes this:

1. `jill-foundation.css.liquid`
2. `jill-ui.css`
3. `jill-storefront.css`

**Why:** This keeps design tokens, reusable UI and compositions separate while preventing stylesheet sprawl.

**Consequence:** Features extend the correct owner instead of adding feature-specific stylesheets.

## 2026-09-08 — Merchant blocks wrap internal primitives

**Decision:** Merchant-editable blocks expose configuration/content and render canonical internal snippets rather than reimplementing component markup.

**Why:** Merchant flexibility should not multiply component owners.

**Consequence:** `blocks/` is a composition/configuration layer; `snippets/ui-*` owns reusable markup.

## 2026-09-08 — Live JILL is reference, not source

**Decision:** The current JILL storefront remains a production visual/interaction reference during migration.

**Why:** Many UX decisions are good and expensive to rediscover, while much of the implementation debt should not be inherited.

**Consequence:** Capture approved behavior/screens before replacing mature areas; port contracts, not patch code.

## 2026-09-08 — Product families use capabilities, not cloned engines

**Decision:** Piñata, favor, apparel, gift and future product differences are represented through capability/configuration data consumed by shared engines.

**Why:** Per-collection/per-product scripts caused duplication and drift.

**Consequence:** New product families should normally be configuration additions, not new validation/personalization architectures.

## 2026-09-08 — Product Options is a protected behavioral reference

**Decision:** The existing Product Options experience is treated as locked behavior until a clean Theme Core owner reproduces and certifies the contract.

**Why:** It is currently stable and interconnected; casual rewrite risks regression.

**Consequence:** Theme Core rebuilds it intentionally after product capabilities/validation exist.

## 2026-09-08 — Rewards business authority stays outside the sellable theme

**Decision:** Reward accounting, reconciliation and coupon creation remain backend/app responsibilities.

**Why:** Privileged business truth must not live in presentation code and should not make the sellable theme JILL-specific.

**Consequence:** Theme/account presentation consumes authoritative reward state only.

## 2026-09-08 — Backend execution uses command/query/event boundaries

**Decision:** Durable backend interactions are modeled explicitly as commands, queries or events. Retriable commands/events require idempotency and authoritative persistence/reconciliation semantics.

**Why:** Browser click guards and webhook delivery alone are insufficient protection against duplicate writes, partial failures or missed events.

**Consequence:** New backend operations define operation identity, authoritative owner, retry behavior and rollback/compensation before implementation.

## 2026-09-08 — Shopify owns standard commerce truth

**Decision:** Shopify remains canonical for catalog, variants, cart, checkout, orders, payments, refunds, customers and discount objects. JILL does not create a parallel commerce database without a concrete requirement.

**Why:** Reimplementing Shopify commerce truth would increase failure modes and make Theme Core less compatible/reusable.

**Consequence:** JILL browser/backend layers extend Shopify contracts rather than replacing them.

## 2026-09-08 — Google Apps Script is current runtime, not architecture

**Decision:** Keep the production Apps Script backend online while Theme Core is built, but treat its public contracts/behavior—not its current combined file layout—as canonical.

**Why:** The current backend already contains proven Custom Order and Rewards behavior, but `JILL_Custom_Order_Automation_REWARDS.gs` combines unrelated domains in one large implementation file.

**Consequence:** Future backend work progressively extracts one owner per domain behind stable command/query/event contracts. A runtime migration may happen later without requiring a storefront rewrite.

## 2026-09-08 — Runtime migration requires evidence

**Decision:** Do not migrate backend runtime merely because a more fashionable stack exists.

**Why:** Migration carries operational risk while the current implementation works. The architectural goal is replaceability, not churn.

**Consequence:** Move beyond Apps Script only when measured concurrency, latency, storage, observability, multi-merchant, quota or reliability requirements justify it.

## 2026-09-08 — Events make state fast; reconciliation makes it correct

**Decision:** Durable domains affected by external events use webhooks/events for timely updates plus reconciliation for missed, duplicated or partially failed processing.

**Why:** Event delivery is not a complete correctness strategy by itself.

**Consequence:** Rewards keeps its watchdog/reconciliation pattern, and future durable event-driven domains adopt the principle without cloning Rewards-specific code.

## 2026-09-08 — One universal form engine owns state, validation and progression

**Decision:** `theme/assets/jill-form-engine.js` is the single runtime owner for the common browser state vocabulary, field validation, conditional availability and stage progression used by product customization and Custom Order flows.

**Why:** Validation and cascading progression are tightly coupled through the same field state. Splitting them into page-specific or product-specific engines would recreate the duplicate-logic problem that Theme Core is intended to eliminate.

**Consequence:** Product Page, Product Options, Personalization and Custom Order configure/consume this engine. They may add domain-specific orchestration, but may not create another required-field validator or cascade engine.

## 2026-09-08 — Shopify-native product capability storage begins with one JSON metafield adapter

**Decision:** The first Theme Core Shopify adapter reads `product.metafields.custom.jill_product_capabilities` only when it is a JSON metafield, then passes that value through the canonical Product Capability resolver.

**Why:** A Shopify-native structured source lets merchants attach product behavior without collection-name or product-title branching, while keeping the runtime profile independent from Shopify storage shape.

**Consequence:** `main-product.liquid` owns this initial storage mapping. `jill-product-capabilities.js` remains storage-agnostic. A future move to metaobject references or another Shopify-native shape changes the adapter, not the validation/customization engines.

## 2026-09-08 — Cart stays native until JavaScript has a real job

**Decision:** The first certified cart uses Shopify's native cart form, `updates[]`, line-item `url_to_remove`, and checkout submit contract rather than introducing an AJAX cart controller.

**Why:** Shopify already owns cart mutation and checkout state. Adding JavaScript before a distinct interaction requirement exists would create another failure surface and an empty/duplicate owner.

**Consequence:** `main-cart.liquid` owns cart rendering and native form composition. `jill-cart.js` is introduced only if a later certified interaction requirement cannot be satisfied cleanly by the native contract.

## 2026-09-08 — Certification is commit-specific

**Decision:** A feature is `CERTIFIED` only after automated and manual gates pass on the implementation commit.

**Why:** “It worked before” is not reliable regression protection.

**Consequence:** Later owner changes rerun relevant architecture, behavior, visual, accessibility and Theme Editor gates.

## 2026-09-08 — Commerce quantity and customization units are distinct

**Decision:** Shopify merchandise quantity remains the sole commerce quantity owner. A Product Capability Profile may optionally declare `features.customizationUnits.unitsPerQuantity`; the capability resolver owns the default value of `1` when that feature is absent. Customization engines derive eligible physical customization units from merchandise quantity and the resolved multiplier.

**Why:** Some JILL products are sold as packs. One Shopify quantity of a 12-count favor is one merchandise unit but twelve physical units that may need Product Options or Personalization allocation. Inferring this from product titles or letting each feature invent its own pack math would create brittle duplicate quantity systems.

**Consequence:** Product Options and Personalization consume the same resolved customization-unit multiplier and may never infer counts from product titles, collection names, or duplicated family logic. They cannot mutate Shopify quantity. Products without pack configuration behave as one customization unit per merchandise quantity.

## 2026-09-08 — Product Options allocation scope is explicit capability data

**Decision:** Product Option fields are singleton by default. A profile opts allocated Product Option fields into per-customization-unit allocation through `features.productOptionsAllocation.fieldIds`. `theme/assets/jill-product-options.js` is the single owner for Product Options state, allocation, reconciliation and normalized payload; it consumes the universal form engine for field semantics.

**Why:** Flavor and similar per-item operational choices need allocation, while piñata style/opening and other selection-wide choices do not. Treating every option as per-unit would create unnecessary state; inferring allocation from labels/products would recreate family branching.

**Consequence:** Product Options groups one or more eligible customization units under the same active option choices, preserves unrelated completed state, and reconciles deterministically when quantity or dependencies change. Singleton Product Options may not depend on allocated per-unit fields because those fields have no singular value. Arbitrary free-form per-unit customer content remains owned by Personalization.

## 2026-09-09 — Product Options allocation groups are unique active combinations

**Decision:** A completed Product Options allocation group is identified by the ordered values of only the allocated fields that are active for that group. Two completed groups may not own the same active combination. `jill-product-options.js` owns combination signatures, duplicate detection, remaining-option availability and whether another allocation group can be created.

**Why:** Repeating an identical allocation group does not express a new option; its units belong in the existing group's count. Dependent options require combination-level uniqueness rather than globally disabling an upstream choice. For example, `Empty` is one combination, while `Filled + Cheetos` and `Filled + Doritos` are separate combinations. This allows `Filled` to remain reusable until its valid dependent choices are exhausted without creating Snack Bag-specific logic.

**Consequence:** Renderers ask the Product Options owner which enumerated choices remain valid instead of deriving uniqueness from DOM state. Hidden dependent values do not alter combination identity. Duplicate state supplied externally fails incomplete, direct duplicate transitions are rejected, and `Add another option` is available only while units remain unallocated and at least one unused valid combination still exists.

## 2026-09-09 — Allocated Product Options may own conditional detail leaves

**Decision:** `features.productOptionsAllocation.fieldIds` may include conditional `text` or `textarea` detail fields alongside allocated `select`/`radio` choices when the detail is a leaf dependency driven by an allocated choice. Allocated `select`/`radio` fields alone define unique combination identity. Conditional details participate in group validation and payload only while active.

**Why:** Product choices commonly need a generic `Other → required detail` pattern. Treating that detail as a singleton is incorrect because the parent choice is allocation-scoped; treating it as Personalization would create a second owner for Product Option semantics; making the typed detail part of uniqueness would incorrectly allow multiple `Other` groups simply by entering different text.

**Consequence:** `jill-product-capabilities.js` validates the allowed allocation shape, `jill-product-options.js` owns selector identity plus detail state/pruning, and the shared `jill-product.js` renderer supports the field kinds without product-family branches. The canonical dependency policy is clear-on-deactivate: unavailable detail is removed from state and normalized payload, and must be entered again if reactivated. Product Page and CLEAN Custom Order receive the same behavior because both use the same capability profile, renderer and product runtime.

## 2026-09-09 — Custom Order allocates real Shopify variants, never cloned size/color fields

**Decision:** Multi-variant Custom Order products split the one canonical merchandise quantity across actual Shopify variant IDs through `theme/assets/jill-variant-allocation.js`. Variant allocations use stable merchandise-unit IDs based on the same `shopify-product:<product-id>` identity already used by Product Options and Personalization. Shopify-native variant choices such as size, color, tote style and method are never recreated as capability fields merely to support Custom Order.

**Why:** A single variant dropdown cannot represent requests such as two small white shirts plus three medium pink shirts. Recreating those choices in Product Capabilities would create a second commerce owner and allow customization state to drift from Shopify's variant/price truth. Stable shared unit IDs also preserve correlation between the physical variation assignment and per-unit personalization.

**Consequence:** `jill-variant-allocation.js` owns variant uniqueness, availability, quantity reconciliation and normalized allocation payload. `main-custom-order.liquid` emits Shopify variant truth and the canonical quantity primitive; `jill-custom-order.js` renders/consumes the allocator and re-normalizes its serialized payload before Review. Product Pages keep Shopify's normal single-selected-variant purchase flow. The Custom Order API may carry structured `variant_allocations` with variant ID, quantity and stable unit IDs while retaining `variant_id` for single-variant items.

## 2026-09-09 — Product listings may project a narrower capability surface without cloning profiles

**Decision:** `custom.jill_product_capabilities` remains the canonical full product capability profile. A product page may optionally apply a compact `custom.jill_product_page_capability_override` JSON delta that can only exclude canonical fields or make retained canonical fields directly available. CLEAN Custom Order ignores this listing-only projection and continues consuming the complete canonical profile.

**Why:** A merchandised listing can intentionally represent a narrower sellable product than the broader Custom Order service. Current 18-inch and 36-inch number-piñata listings are number molds only, while Custom Order must still offer Number, Shape and Character. Duplicating the whole capability profile per surface would create two configuration owners and future drift; deleting the broader choices from the canonical profile would incorrectly remove Custom Order capability.

**Consequence:** `main-product.liquid` owns the Shopify product-page override adapter, `jill-product-surface.js` owns strict projection semantics, and all validation/customization behavior after projection continues through the shared capability and form engines. Surface overrides cannot invent new fields or product-family logic. If a retained field still depends on an excluded field, the projection fails unless that retained field is explicitly made directly available. This pattern is for merchandising scope only, not a second capability system.

## Decision process

Add a new entry only for a real architectural/product-system decision. Routine implementation details belong in code/commits. If a new decision supersedes an old one, append a dated decision and identify the superseded entry; do not rewrite history.

## 2026-09-10 — One token-resolved multicolor Catalog floral field

**Decision:** Replace the monochrome branch mask inside the existing Catalog disclosure stylesheet with one SVG background resolved from the foundation's logo palette. Keep the existing Catalog presentation owner, outer-panel isolation and higher content stacking.

**Why:** A single-color mask loses JILL's multicolor identity; external SVGs cannot inherit document CSS tokens. Resolving the reusable SVG once in the foundation avoids duplicated palette literals, repeated inline markup and a client-side recoloring system.

**Consequence:** No new stylesheet or runtime is introduced. The prior single-color mask and long-stem SVG geometry are removed. Only mobile uses a transparency mask to confine the same multicolor artwork to the outer edges. Form and product-card owners remain unchanged.


## 2026-09-12 — Custom Order final audit: capability truth, physical units, review purity, and botanical steps

**Decision:** The verified `AKfycbxX.../exec` Apps Script deployment is the canonical Custom Order submission endpoint. Custom Order reads the full product capability profile for required personalization/reference semantics while retaining the existing Product Options-only projection for option rendering. Bundled products use physical customization units from `JILLPersonalization`, including 8- and 12-count merchandise. Date Needed exposes a 12-business-day minimum but remains blank until the customer chooses a date. Review validates without mutating Product Options finish state. Large Custom Order step cards may reuse the canonical botanical field at low opacity with deterministic crop variations; controls remain undecorated.

**Consequence:** This scoped final pass supersedes the 2026-09-10 consequence that the Custom Order form owner was untouched. It does not authorize duplicate engines or a new visual authority. Deployment remains DEVELOPMENT-theme-only until explicitly promoted; LIVE is not modified by this decision.

## 2026-10-09 — Customer Account Rewards requires explicit release isolation

**Decision:** Treat WORK as the active feature/PR lane, KEEP as a retained passing Git reference, and LIVE as the separately authorized production Shopify app release. The existing account app is not a Shopify DEVELOPMENT theme and its full-page extension UIDs belong to the installed production app. A future real WORK account preview must run via a distinct development app/store; the Git branches alone do not provide a second Shopify-hosted account site.

**Why:** The former Customer Account workflow published every matching `jill/theme-core` push into the production app. That defeats isolated Rewards experiments and makes a code-only test appear equivalent to end-to-end commerce certification.

**Consequence:** The Customer Account workflow under review is manual-only, requires `jill/theme-core`, an exact source commit SHA and an explicit typed LIVE authorization, and uses a noncanceling deploy concurrency group. The draft PR validates but never deploys; actual coupon/cart certification remains blocked until an isolated development app/store runtime exists. Existing `main` workflow and any out-of-band deployment routes must also be audited before claiming universal LIVE isolation.

## 2026-10-10 — My JILL becomes a hybrid account hub, not another account platform

**Decision:** Maintain Shopify native Customer Accounts for authentication, Orders, Profile, addresses, cart and checkout. Reuse the existing `jill-account-dashboard` full-page extension UID for one modular My JILL hub (Overview, Rewards, Coupons, Custom Orders, Celebrations, Saved Preferences, JILL Settings). Keep the distinct native Profile block as a shortcut. Migrate, certify, and eventually retire the standalone Coupons full-page extension; do not create duplicate installed page targets.

**Why:** The Shopify WORK Rewards engine, permissions and seven customer metafield definitions are verified, but the released My JILL/Coupons pages fail to render. Their independent page shells complicate diagnosis and future integration. A single hub entrypoint plus feature modules allows isolated fallbacks, shared authenticated API transport and one navigation owner without cloning Shopify's commerce.

**Boundaries:** `jill/rewards-work` and `jill-work.myshopify.com` remain the only active execution targets for this redesign. KEEP is a Git baseline only until a separate KEEP Shopify environment is provisioned and independently proven. The backend v13 ledger and existing WORK code generation remain authoritative; no LIVE deployment or points mutation is authorized by architecture work. Any missing `jill` custom-event/preference metafields require a business/storage contract before creation.

**Proof and file map:** `docs/CUSTOMER_ACCOUNT_HYBRID.md` owns the staged roadmap. Contract semantics stay in `FEATURE_CONTRACTS.md`, file/domain ownership stays in `DOMAIN_OWNERSHIP.md`, evidence stays in `QA_CERTIFICATION.md`.

## 2026-10-18 — One points conversion across website and future playground

**Decision:** The merchant selected 1 point = $1, with 0.1 point earned per $1 of eligible paid items and 0.1-point redemption steps. Each $1 discount requires at least $10 of eligible item subtotal. This replaces the earlier proposed 20% purchase limit and unequal future reward tiers, but does not retroactively change the terms of issued v13 coupons. The customer can choose a small amount for a snack or admission; reaching 50 points is not an unlock requirement.

**Why:** A common minimum-purchase formula permits a small on-site purchase and a large web order to use the same wallet and rate, without adding a separate playground Rewards engine. It sets a 10% transaction discount ceiling and keeps the previously selected 50 points = $50 value.

**Consequence:** `docs/JILL_REWARDS_WORK_FLEX_REDEMPTION.md` defines the integer-cents/tenths math and the migration proof. Shopify remains the item, discount, checkout and order authority; the canonical Rewards backend owns balances and reservation/reconciliation, while My JILL and HQ are customer and merchant views. Current v13 has fixed whole-point tiers and remains active until a versioned WORK ledger, coupon integrity migration, eligible-product scope and Shopify checkout/draft tests pass. LIVE and KEEP remain untouched.


## JILL visual theme v2 prepared — 2026-10-19

User-authorized presentation-only continuation: bolder purple/cherry/gold/ink
palette, shared active-tab navigation, button-style actions, shorter task copy
and native disclosures for technical evidence. Quote/customer/security/error
boundaries remain visible. Canonical visual owner remains `hq-theme.css` and
the existing page styles; runtime backend, hooks and command props are unchanged.
See `docs/WORK_HQ_STUDIO_VISUAL_RELEASE_2026-10-19.md` for reviewed source,
24 local browser cases, guarded new v2 release/receipt boundaries and remaining
authenticated checks. Current visual v1 `80b47610-4d8a-4186-a4c8-fe4f05daf964`
is still active. v2 is source-prepared, not uploaded/deployed. v1 receipts remain
spent; never rerun historical releases or reset receipts. WORK operational
acceptance and separate customer-facing LIVE review remain incomplete.

## Navigation incident and Home dashboard — 2026-10-19

Owner reports Requests not opening and raw-Worker new-tab `200 OK`; Home had
three Requests links. Local compiled SDK/data-route reproduction found shared
thrown Response body consumption across parallel loaders. Repair preserves one
SDK attempt but clones rejected Responses per loader, restores top-level new-tab
entry through the existing WORK Admin app, and makes Home a canonical streamed
counts dashboard with one Requests navigation entry. See
`docs/WORK_HQ_NAVIGATION_RECOVERY_2026-10-19.md` for evidence, source/denial tests,
new isolated repair receipts and required authenticated checks. This is an
explicitly authorized navigation/dashboard change, NOT visual-only. It is NOT
DEPLOYED yet; `d301efb4-b015-40d4-87ad-159a9fff82eb` remains ordinary traffic.
All old release receipts remain spent. Flags, secrets, app URLs, canonical data,
wallet and LIVE stay unchanged. Incident/WORK acceptance remains open pending
actual authenticated navigation/new-tab proof after a reviewed repair release.


## 2026-10-19 — Exact delivery terms belong to the immutable agreement

Extend the canonical agreement owner rather than add an address/quote store.
Version-2 publications bind the exact private address and shipping label as well
as their calculation fingerprint. Owned reads first verify canonical ownership;
errors do not become absence. Accepted terms survive later event revisions with
unchanged immutable ownership/payload. Actual draft delivery mismatches quarantine
the commerce intent and never authorize another create. This is inactive source,
not a remote migration or operational pass. The prior uncertain-intake hold and
separate LIVE review remain in force. See WORK_QUOTE_SHOPIFY_CALCULATION_2026-10-19.md.


## Compact visual edition prepared — 2026-10-19

Remove the decorative Home hero and compact the canonical HQ theme, preserving
readability, 44px touch targets and existing auth/navigation/command behavior.
Package the current runtime source with exactly seven visual files so unreleased
quote business changes are excluded. Reuse the visual executor via an optional
isolated build hook and a new receipt namespace; historical releases remain spent.
This is not deployed or operational acceptance. See
`WORK_HQ_COMPACT_VISUAL_RELEASE_2026-10-19.md`.
