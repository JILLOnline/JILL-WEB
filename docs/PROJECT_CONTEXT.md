# JILL Project Context

This document owns durable product context: what JILL is, what has already been proven, and what Theme Core must preserve conceptually. It does not own implementation details; those belong to architecture, domain ownership, feature contracts, the design system, and QA.

## Product identity

JILL Online Store is a Jacksonville, Florida handmade and customizable commerce business. The production storefront is `jillonlinestore.com`. JILL Theme Core is the reusable Shopify theme product being built from what JILL has learned in production; JILL Online Store is the first merchant implementation, not the theme architecture itself.

The commercial goal is a Shopify theme that works especially well for merchants selling personalized, made-to-order, configurable, event-driven, or otherwise custom products. Merchants must be able to customize branding and composition through Shopify Theme Editor without breaking the interaction system.

## Core business/catalog families

JILL currently works across these families:

- Custom piñatas: number, round/shape, character-inspired/custom designs, pull-string options and large formats.
- Party favors and supplies: activity kits, snack bags, surprise bags, surprise boxes, coloring books, toppers and themed bundles.
- Kids activities: coloring/activity products and themed activity content.
- Apparel: tees, hoodies, crewnecks and event/family apparel.
- Gifts and drinkware: mugs, tumblers, tote bags, stickers and personalized gifts.

Theme Core must not hard-code these specific catalog names as architecture. It should model product capabilities so another merchant can configure equivalent behaviors for different product families.

## Brand and visual baseline

JILL should feel soft, polished, playful and professional rather than like unrelated Shopify widgets assembled on one site. The entire storefront must visibly belong to one design system.

Permanent visual intent:

- one button system
- one field system
- one pill/status system
- one card/surface system
- one typography scale
- one spacing rhythm
- one icon language
- one motion language
- responsive behavior that feels designed, not patched
- no flicker, ghost controls, delayed hiding, duplicate controls or flash-of-old-state

The current live JILL storefront as of September 8, 2026 is a visual and interaction reference during migration. It is not a code source. Before replacing a mature area, capture its desktop and mobile reference behavior so Theme Core can preserve what is intentionally good while removing accumulated implementation debt.

## Storefront interaction principles learned in production

1. Required flows should use progressive disclosure. A dependent stage appears only when the required state before it is valid.
2. If a required earlier choice regresses, dependent stages return to a non-actionable state immediately; stale hidden values must never satisfy submission.
3. Placeholder/default choices such as `Choose one` are not valid selections.
4. Validation should explain what is missing and return focus to the first unresolved requirement instead of silently doing nothing.
5. The customer should be able to see price, quantity and Add to Cart where required for commerce/merchant compliance; Add to Cart is the validation boundary when required customization remains incomplete.
6. Product quantity has one owner. Personalization may allocate the already-selected quantity but cannot independently change the ordered total.
7. Review-before-submit is valuable for complex custom orders.
8. Empty, loading, pending, success, error, locked and disabled states are real product states and must be designed centrally.
9. Mobile is not a secondary layout. Date inputs, uploads, quantity controls, cards, dialogs and account navigation must remain inside the viewport and touch-safe.
10. Initial rendering must already know what should be visible. JavaScript must not hide obsolete or duplicate UI after first paint.

## Product-page contracts already proven

### Piñata-capable products

The desired capability set includes:

- style/type choice: Number, Shape or Character/custom equivalent
- Number requires an active 1–9 choice
- Shape/Character accepts descriptive details instead of a number selector
- opening style such as break/pull-string where applicable
- optional Name/Text question; when enabled, text is limited to 12 characters unless product configuration deliberately overrides the capability
- event date planning
- theme/design idea
- preferred colors
- up to three optional reference files/images when the upload capability is enabled

For shipping-oriented piñata planning, the production rule has used an earliest selectable date of 12 business days from today, with messaging that the date helps plan the order and does not guarantee carrier delivery. Pickup can be prioritized independently.

### Party favors / supplies / activities

The proven capability pattern includes:

- optional Name/Text, normally capped at 12 characters
- optional Number/Age, normally 1–9 where relevant
- progressive required-field behavior
- different personalization by item only when more than one unit/item is available to personalize

### Apparel and gifts

The proven capability pattern includes:

- required personalization/name-text when the product requires it
- required reference file when the product requires artwork/reference input
- sizes owned by product options
- supported print-method choices currently include DTF, Sublimation and Vinyl where applicable

These are capability contracts, not reasons to clone a form for each collection.

## Custom Order experience

The custom-order flow evolved into a multi-product request system rather than a single-product contact form.

Current conceptual sequence:

1. choose products and quantities
2. complete product-specific options
3. provide event/date-needed/fulfillment information when applicable
4. complete personalization/allocation
5. provide optional reference media/marketing consent where applicable
6. review the complete request
7. explicitly submit `Request Custom Order`
8. show a clear success state and Continue Shopping path

The Review action remains visible but cannot advance while required data is incomplete. If blocked, the interface returns the customer to the first unresolved requirement and highlights it.

The current backend submission contract includes fields for submission ID/status, contact information, preferred contact, event date, date needed, fulfillment/location, theme, colors, selected collections/products, reference images, marketing consent and raw payload. Backend integrations—not the theme presentation layer—own persistence and privileged writes.

A custom-order submission is a request for review, not automatically a confirmed price, production slot or delivery date.

## Personalization allocation

The mature model supports three modes:

- no personalization
- same personalization for all selected items
- different personalization by item

`Different` is only meaningful when more than one unit/item is available.

For different personalization:

- selected product quantities are input to the allocator, never edited by it
- one personalization group can apply to one or multiple eligible items/units
- the same unit cannot be allocated to two groups
- availability elsewhere updates immediately as allocation occurs
- all required units must be allocated exactly once before completion
- fields may include Name/Text, Number/Age where supported, and Notes/Theme details
- additional personalization groups are created only while unallocated eligible units remain
- completion is deterministic, not inferred from UI appearance

The old production implementation achieved this through compatibility shims, DOM rebuilding and observers. Theme Core preserves the contract but must not inherit those techniques.

## Product Options

The existing JILL Product Options experience is treated as a locked behavioral reference until Theme Core has a certified replacement. Product-specific option groups expose completion status, required choices and allocations without reopening completed cards on unrelated changes.

Theme Core should implement Product Options from a product-capabilities model and one canonical engine rather than separate collection-specific scripts.

## Cart and commerce boundary

Customization data that belongs to a purchased item should travel with the line item/order through supported Shopify contracts. Existing Shopify checkout, payment, inventory and cart platform behavior should not be replaced merely to make JILL look custom.

The customer must never be able to add a personalization-required item without satisfying the required customization contract.

## Customer Account experience

JILL wants account surfaces to feel like the same product as the storefront within Shopify Customer Account platform constraints.

Desired navigation order:

`Dashboard → Orders → Coupons → Contact JILL → Settings → Log Out`

Shared account presentation already has a canonical owner in `shared/customer-account-ui.jsx`. Account extensions render authoritative business state; they do not perform rewards accounting.

## Rewards

JILL Rewards currently earns 1 point per $10 spent. Reward accounting, reconciliation, coupon creation and privileged Shopify writes remain outside the sellable theme.

The customer-facing state model is:

- `REDEEM` — available reward, green interactive action
- `USE_COUPON` / redeemed-ready — blue interactive action leading to the generated coupon/use path
- `NEXT_REWARD` — one highlighted next target, purple with star treatment
- `LOCKED` — unavailable future tier
- transient confirming/pending/success/error states where required

The production backend includes reconciliation/watchdog behavior for paid orders, refunds, cancellations, edits, customer updates and deleted discounts. Theme Core consumes an authoritative state adapter; it must never recalculate balances or create coupons itself.

## Header, navigation and social behavior

JILL header/mobile work established these expectations:

- profile/account and cart affordances should have deliberate, consistent visual weight
- cart state must not shrink or visually mutate the icon unexpectedly when quantity changes
- social links open safely without destroying the current authenticated storefront session
- current canonical social destinations include TikTok `@jillonlinestore` and Facebook `JILLOnline`
- language and country/currency controls should feel like the same control family
- responsive header changes must not flash old desktop/mobile structures during navigation

Exact layout is a Theme Core design-system decision; the interaction expectations above are the migration contract.

## Policies and commerce copy that influence UX

- Personalized/custom/handmade items are generally all sales final under JILL policy, subject to required legal/platform exceptions.
- JILL uses a 24-hour cancellation window where the configured Shopify experience permits it.
- Processing time is creation/personalization/packaging time before carrier handoff and varies by product.
- Delivery expectation equals processing plus carrier transit; carrier estimates can vary because of holidays, weather and disruptions.
- Tracking is provided when available.
- Orders containing multiple product types may ship together based on the longest processing time.

Policy text belongs to content/policy ownership, not to duplicated form logic.

## Platform/commercial constraints

- Theme Core is built cleanly from Shopify's Skeleton Theme / original implementation path, not derived from the current Dawn-based production JILL theme.
- The Dawn-derived live theme is a production reference and migration source of requirements only.
- JILL-specific backends, rewards authority and account extensions remain outside the sellable theme.
- Shopify Theme Editor must expose safe global brand controls and supported section/block composition without creating local design-system forks.
- Theme Core must support accessibility, localization, app/platform contracts, SEO and performance as product requirements rather than cleanup work.

## Development operating model

Every change follows:

`architecture check → identify canonical owner → implement smallest coherent change → remove superseded code → automated guards → interaction/visual certification → commit`

Permanent working rules:

- no duplicates
- no `!important`
- no styling outside canonical CSS assets
- no patch/override files
- no ghost UI
- no dead code or temporary runners
- no parallel state owners
- configuration over product-family cloning
- touched paths finish cleaner than they started
- live production theme is not modified as a shortcut while Theme Core is under construction

## Source-of-truth hierarchy

When documents disagree, use this order:

1. `JILL_THEME_CONSTITUTION.md`
2. `DOMAIN_OWNERSHIP.md`
3. `THEME_ARCHITECTURE.md`
4. `FEATURE_CONTRACTS.md`
5. `DESIGN_SYSTEM.md`
6. `THEME_EDITOR_CONTRACT.md`
7. `PROJECT_CONTEXT.md`
8. `MIGRATION_BLUEPRINT.md`
9. `QA_CERTIFICATION.md`
10. dated architecture decisions in `DECISIONS.md`

Historical chats and old theme files are evidence, not canonical owners.