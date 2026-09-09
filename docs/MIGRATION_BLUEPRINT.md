# JILL → Theme Core Migration Blueprint

This document owns migration procedure. It does not own feature behavior or design rules.

## Objective

Move the good, proven JILL experience into clean Theme Core architecture without importing the live Dawn-derived theme's accumulated patch code.

The live JILL site is a reference implementation and visual baseline. Theme Core is the new canonical implementation.

## Non-negotiable migration rules

1. Do not copy the entire live theme into `theme/`.
2. Do not treat old `jill-*` files as canonical owners.
3. Preserve behavior and intentional visual decisions, not historical implementation techniques.
4. Never introduce an `override`, `fix`, `final`, `cleanup`, compatibility shim or second owner to make a migration appear complete.
5. The production theme remains operational while Theme Core is built and certified on an unpublished target.
6. A legacy implementation is considered replaced only after the Theme Core owner passes its contract and QA gates.
7. Product Options remains a protected behavioral reference until its replacement is certified.

## Reference capture protocol

Before rebuilding a mature production area, capture evidence of what intentionally works today.

For each area record:

- desktop screenshot/reference
- mobile screenshot/reference
- visible content hierarchy
- interaction sequence
- required/optional states
- loading/pending/success/error states
- keyboard/focus behavior
- logged-in/logged-out differences where relevant
- Theme Editor controls that matter
- known defects we explicitly do not preserve

Evidence belongs in the QA/migration process, not as copied production CSS/JS.

## Known legacy defects not to preserve

- overlapping `jill-*` polish/fix/cleanup/authority layers
- inline `<style>`/`<script>` feature blobs
- `!important` specificity escalation
- hidden duplicate/legacy controls
- compatibility bridges that relocate obsolete DOM
- delayed hiding or first-paint flicker
- multiple MutationObservers competing for authority
- repeated per-product/per-collection logic
- patch filenames and numbered authority fragments
- giant sections that combine markup, CSS, state, API calls and business rules

## Migration order

### Phase 1 — Foundation and shell

Build/certify:

- design tokens
- typography
- spacing/radii/motion vocabulary
- global page width
- buttons/fields/pills/cards/notices/dialog primitives
- header
- footer
- localization controls
- accessibility baseline

Exit criteria: a generic merchant can brand the shell from Theme Editor without creating visual forks.

### Phase 2 — Core commerce pages

Build/certify:

- home/content sections
- collection/listing
- product card
- product page foundation
- variant/price/quantity
- cart/drawer/notification
- search
- common empty/error states

Exit criteria: standard non-custom products can complete a Shopify purchase path without JILL-specific business modules.

### Phase 3 — Product capabilities and validation

Introduce one product-capability model and one progressive/validation engine.

Build/certify:

- required-state model
- progressive disclosure
- Add to Cart boundary validation
- capability-driven fields
- quantity ownership
- reference upload adapter

Exit criteria: multiple configured product families behave differently without cloned engines.

### Phase 4 — Product Options

Rebuild the protected Product Options behavior as one canonical engine driven by capabilities/configuration.

Exit criteria:

- complete/incomplete behavior matches contract
- no unrelated reopening/regression
- allocation reconciles correctly
- no collection-specific implementations
- visual/status primitives are shared

Only then is Product Options considered unlocked from the legacy reference.

### Phase 5 — Personalization

Rebuild same/different personalization from canonical application state.

Exit criteria:

- allocation totals are exact
- no duplicate unit allocation
- upstream quantity changes reconcile safely
- fields reflect selected capabilities
- no DOM compatibility bridge or observer-based authority

### Phase 6 — Custom Order

Compose existing product capabilities, validation and personalization into request mode instead of creating a second form architecture.

Exit criteria:

- multi-product selection
- Product Options
- event/date/fulfillment
- personalization
- references/consent
- review
- request submit
- success state
- backend payload contract

### Phase 7 — Customer Account / Rewards integration

Unify semantics between storefront and Shopify Customer Account extensions while preserving platform boundaries.

Exit criteria:

- Dashboard/Orders/Coupons/Contact JILL/Settings/Log Out flow is coherent
- rewards state renders from authoritative backend/account data
- redemption confirmation/pending is deterministic
- theme contains no rewards accounting

### Phase 8 — JILL merchant migration

Configure Theme Core as JILL:

- JILL branding/tokens
- catalog templates/capabilities
- policy/content
- header/footer/navigation
- social/localization settings
- custom-order configuration
- integrations

Compare against production visual/interaction references and certify every key route before promotion.

## Per-feature extraction procedure

When using old JILL as reference:

1. Identify the visible/user-facing contract.
2. Identify the data/platform contract.
3. List known defects and patch techniques to discard.
4. Find the Theme Core canonical owner.
5. If no owner exists, define it in `DOMAIN_OWNERSHIP.md` before coding.
6. Implement the smallest complete owner.
7. Add/update guards/tests.
8. Compare behavior against the reference.
9. Certify all required states/viewports.
10. Record migration status and decision if architecture changed.

## Migration status registry

Use only these states:

- `REFERENCE` — production behavior documented; Theme Core owner not built
- `BUILDING` — canonical owner exists but is not certified
- `CERTIFIED` — contract and QA gates pass in Theme Core
- `MIGRATED` — JILL merchant configuration is running on the certified owner

A feature does not become `CERTIFIED` because it looks correct in one screenshot.

## Initial status

| Domain | Status | Notes |
| --- | --- | --- |
| Foundation CSS/tokens | BUILDING | clean core exists; design breadth still minimal |
| Shared storefront UI primitives | BUILDING | initial button/card/pill owners exist |
| Header/footer shell | BUILDING | minimal clean shell exists |
| Core commerce templates | REFERENCE | to be built from Shopify contracts |
| Product capabilities | REFERENCE | behavior known; canonical config/engine not built |
| Validation/cascade | REFERENCE | mature behavior known; clean owner not built |
| Product Options | REFERENCE | protected legacy behavior |
| Personalization | REFERENCE | allocation contract captured |
| Custom Order | REFERENCE | multi-product contract captured |
| Customer Account | BUILDING | existing app extensions/shared primitives live outside theme |
| Rewards backend | BUILDING/EXISTING | JILL-specific authority remains outside sellable theme |
| Rewards presentation | REFERENCE/BUILDING | existing account work is reference for final semantics |

## JILL catalog capability audit — September 9, 2026

This matrix is the canonical migration status for the current JILL Shopify catalog. It reconciles current Shopify catalog/variant truth with read-only behavior evidence from the live `JILL` theme. Legacy files are evidence only; no legacy implementation technique is a migration target.

### Catalog migration laws

- Shopify product options/variants remain authoritative for real merchandise choices such as apparel size/color and Tote Style/Method. Capability profiles must not create duplicate size, color, tote-style or method owners when Shopify already owns them.
- Product Capability Profiles own customization behavior that is not represented by Shopify variants: conditional Product Options, personalization, allocation, planning and reference requirements.
- A legacy collection/title/handle branch is not product truth. It may identify behavior worth reconciling, but it cannot be copied as the new execution switch.
- Pack counts are explicit `customizationUnits` configuration only when physical units are genuinely eligible for independent customization. Product titles are never parsed for quantity truth.
- Commerce adjustments remain inactive unless they reference real Shopify add-on variants with merchant-approved prices. Browser rules never become price authority.
- `MIGRATED` is reserved for a fully certified JILL merchant configuration. A partial profile stays `BUILDING` even when one capability inside it is already certified.

### Shared normalized patterns discovered

1. **Party / kids personalized pack** — Name/Text Yes/No → conditional text; Number/Age Yes/No → conditional 1–9; theme; colors; event planning where applicable; optional references; explicit physical-unit multiplier for individually customizable packs.
2. **Piñata customization** — style choice with conditional Number/Shape/Character detail, opening method, optional Name/Text, event planning, theme, colors and optional references. The 13-inch round product has conflicting legacy Product Page vs Custom Order behavior and must be reconciled before migration.
3. **Apparel / gift artwork** — Shopify variants stay native; required Name/Text and required reference file where the product needs supplied artwork. A print-method Product Option is configured only when it is real product truth and is not already a Shopify variant.
4. **Snack Bag filled contents** — extends the party-pack pattern with unit-allocated Filled/Empty → Snack Choice → conditional required Other detail. Choice fields define unique combinations; free-form detail does not create a second uniqueness identity.

The generic conditional allocated-detail capability is `CERTIFIED` at runtime commit `26539b756612da04efccc7a08f0747027723d0ee`. The Snack Bags merchant configuration is installed on CLEAN, but the full Snack Bags profile remains `BUILDING` until its remaining planning/upload/personalization-allocation decisions are certified.

### Product migration matrix

| Product | Collection / family | Shopify variants | Product Options target | Allocation | Personalization target | Planning | Uploads | Commerce adjustments | Profile status | Product Page proof | CLEAN Custom Order proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Custom 11 oz Coffee Mug – Personalized Print | Apparel & Gifts / Mug | Default only; $12.99 | Do not copy legacy collection-inferred DTF/Sublimation. Confirm actual mug print-method truth before adding any option. | None identified | Legacy `apparel-gift`: required Name/Text | None confirmed | Legacy required first reference; up to 3 | None | REFERENCE | Live product profile audited | Legacy collection branch audited; CLEAN target pending |
| Custom Cake Topper Set – 13 Pieces – Made to Order | Party Supplies / Cake Topper | Default only; $29.99 | None identified | Treat as one merchandise set unless independent-piece customization is explicitly approved | Party pattern: Name/Text, Number/Age, theme, colors | Legacy event date | Legacy optional references up to 3 | None | REFERENCE | Legacy `party` profile audited | Shared target pattern identified |
| Custom Coloring Books – 12 Count – Personalized Party Favors | Kid Activities / Coloring Book | Default only; $39.99 | None | 12 customization units configured; different-personalization allocation still to certify/configure | Current profile: Name/Text, Number/Age, theme, colors | Legacy event date not yet in current profile | Legacy optional references not yet in current profile | None | BUILDING | CLEAN capability profile exists; incomplete against migration target | Shared capability path exists; product-specific end-to-end proof pending |
| Custom DTF Crewneck Sweatshirt – Made to Order | Apparel & Gifts / Crewneck | Size S–2XL × White/Pink; Shopify owns price by variant | Shopify owns size/color. Reconcile real print methods before adding a non-variant Product Option; legacy Custom Order inferred DTF/Sublimation. | Custom Order must allocate real Shopify variants, not create a second size allocator | Legacy `apparel-gift`: required Name/Text | None confirmed | Required reference; up to 3 legacy | None; variant prices remain Shopify truth | REFERENCE | Shopify variant truth + live profile audited | Native-variant composition proof required before migration |
| Custom DTF Hoodie – Made to Order | Apparel & Gifts / Hoodie | Black/Green/Pink × Size S–2XL; $39.99 variants | Shopify owns size/color. Reconcile real print methods before adding a non-variant Product Option; legacy Custom Order inferred DTF/Sublimation. | Custom Order must allocate real Shopify variants | Legacy `apparel-gift`: required Name/Text | None confirmed | Required reference; up to 3 legacy | None; variant prices remain Shopify truth | REFERENCE | Shopify variant truth + live profile audited | Native-variant composition proof required before migration |
| Custom DTF T-Shirt – Made to Order | Apparel & Gifts / T-Shirt | Gray/Black/Pink/White × Size S–2XL; $24.99 variants | Shopify owns size/color. Reconcile real print methods before adding a non-variant Product Option; legacy Custom Order inferred DTF/Sublimation. | Custom Order must allocate real Shopify variants | Legacy `apparel-gift`: required Name/Text | None confirmed | Required reference; up to 3 legacy | None; variant prices remain Shopify truth | REFERENCE | Shopify variant truth + live profile audited | Native-variant composition proof required before migration |
| Custom Handmade Piñata – 13 Inch Round | Piñatas / Piñata | Default only; $49.99 | Reconcile conflict: legacy Product Page is `pinata-round` with opening + optional age/number, while legacy Custom Order generalized Piñata Style. Do not guess. | Legacy Custom Order allowed per-quantity piñata option allocation; target depends on reconciled style contract | Optional Name/Text; theme; colors | Legacy 12-business-day event planning | Legacy optional references up to 3 | None | REFERENCE | Both legacy Product Page and Custom Order behavior captured | Reconciliation required before profile build |
| Custom Handmade Piñata – 18 Inch | Piñatas / Piñata | Default only; $79.99 | Current CLEAN profile: Piñata Style → Number/Shape/Character detail + opening | Current fields are singleton; per-quantity option allocation not yet configured | Current optional Name/Text; theme; colors | Missing from current profile; legacy 12-business-day planning | Missing from current profile; legacy optional references | None | BUILDING | Current profile resolves on CLEAN; remaining migration fields incomplete | Shared profile consumption exists; product-specific end-to-end proof pending |
| Custom Handmade Piñata – 18 Inch – Includes Stick | Piñatas / Piñata | Default only; $99.99 | Target the certified piñata pattern after 18-inch profile is complete; `Includes Stick` is a separate product, not a duplicate option | Decide per-quantity allocation with shared piñata pattern | Legacy `pinata-number`: optional Name/Text, theme, colors | Legacy 12-business-day event planning | Legacy optional references up to 3 | None | REFERENCE | Legacy `pinata-number` profile audited | Shared target pattern identified |
| Custom Handmade Piñata – 36 Inch – Includes Stick | Piñatas / Piñata | Default only; $169.99 | Target the certified piñata pattern; `Includes Stick` stays product identity, not a new Product Option | Decide per-quantity allocation with shared piñata pattern | Legacy `pinata-number`: optional Name/Text, theme, colors | Legacy 12-business-day event planning | Legacy optional references up to 3 | None | REFERENCE | Legacy `pinata-number` profile audited | Shared target pattern identified |
| Custom Kids Activity Kit with Play-Doh – 8 Count | Kid Activities / Party Favor | Default only; $39.99 | None identified | Target 8 explicit customization units if each kit is independently personalizable | Party pattern: Name/Text, Number/Age, theme, colors; different mode where eligible | Legacy event date | Legacy optional references up to 3 | None | REFERENCE | Legacy `party` profile audited | Shared pack target identified |
| Custom Party Favor Snack Bags – 12 Count | Party Favors / Party Favor | Default only; $39.99 | Filled/Empty → when Filled, Snack Choice → when Other, required `Which snack would you like?` | 12 units; generic unique active combinations; conditional detail excluded from uniqueness signature | Current Name/Text, Number/Age, theme, colors; different-personalization allocation still to reconcile | Legacy event date not yet in current profile | Legacy optional references not yet in current profile | None active. Future Filled + Other stackable fees require real add-on variants and Shopify-side enforcement | BUILDING | Conditional-detail engine certified, exact runtime deployed/read back to CLEAN, profile CAS verified | Shared-engine integration test proves same capability owner; CLEAN page remains isolated/unassigned |
| Custom Party Favor Surprise Bags – 12 Count | Party Favors / Party Favor | Default only; $39.99 | None identified | Target 12 explicit customization units | Party pattern: Name/Text, Number/Age, theme, colors; different mode where eligible | Legacy event date | Legacy optional references up to 3 | None | REFERENCE | Legacy `party` profile audited | Shared pack target identified |
| Custom Party Favor Surprise Boxes – 12 Count | Party Favors / Party Favor | Default only; $39.99 | None identified | Target 12 explicit customization units | Party pattern: Name/Text, Number/Age, theme, colors; different mode where eligible | Legacy event date | Legacy optional references up to 3 | None | REFERENCE | Legacy `party` profile audited | Shared pack target identified |
| Personalized Tote Bag – Custom Photo, Text & Design | Apparel & Gifts / Tote Bag | Tote Style × Method are real Shopify variants: Plain/Pockets × DTF/Vinyl; $12.99–$19.99 | No duplicate pocket or method Product Option; Shopify variants already own both | Custom Order must compose real variants instead of recreating tote-style/method allocation | Legacy `apparel-gift`: required Name/Text | None confirmed | Required reference; up to 3 legacy | Variant prices are Shopify truth; no add-on adjustment needed for existing combinations | REFERENCE | Shopify variant truth + live profile audited | Native-variant composition proof required before migration |

### Rollout order from the matrix

1. Keep the certified Snack Bags conditional-detail capability locked; complete the remaining Snack Bags planning/upload/personalization-allocation profile decisions before calling the product `MIGRATED`.
2. Certify one shared party-pack profile shape, then apply it by compare-and-set to Coloring Books, Activity Kits, Surprise Bags and Surprise Boxes with only the explicit `customizationUnits` count differing where appropriate.
3. Finish the canonical piñata profile on the 18-inch product, then reuse that configuration pattern for the 18-inch-with-stick and 36-inch-with-stick products. Resolve the 13-inch round behavior conflict separately rather than forcing it into the wrong profile.
4. Before apparel/tote migration, certify CLEAN Custom Order handling for real Shopify variants and quantity allocation. Size/color/tote-style/method stay Shopify-owned.
5. Reconcile mug and apparel print-method truth against actual production methods before configuration. Do not preserve the live collection-name inference.
6. Do not activate paid customization rules until real add-on variants, merchant-approved prices and Shopify-side Cart & Checkout Validation enforcement exist.

## Promotion rule

Theme Core is never promoted because a deadline arrived. Promotion happens when all critical JILL routes and contracts are certified and rollback remains available.