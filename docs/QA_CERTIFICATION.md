# JILL Theme Core QA Certification

This document owns proof-of-done. A feature is not certified because it looks right once.

## Certification layers

Every changed domain must pass the layers that apply.

### 1. Repository architecture

Required:

- JILL Theme Core guard passes
- Shopify Theme Check passes
- no duplicate canonical owner is introduced
- no `!important`
- no inline/style-block CSS
- no JavaScript style mutation
- no patch/temporary filenames
- no dead/debug code in touched paths
- tracked worktree remains clean after validation/build

### 2. Contract tests

Behavior must match `FEATURE_CONTRACTS.md`.

High-value automated contracts should cover:

- required/default value semantics
- cascade progression and regression
- product-capability resolution
- quantity ownership
- Product Options completion/regression
- personalization allocation totals and uniqueness
- review gating
- Add to Cart validation
- request submission payload shape
- reward stable/transient states

### 3. Visual regression

Before migrating a mature production surface, capture an approved baseline. Theme Core should maintain visual snapshots for certified routes/components so accidental drift is detected.

Minimum viewport matrix:

- small phone: approximately 390px wide
- tablet: approximately 768px wide
- desktop: approximately 1440px wide

Add another viewport only when a real contract requires it; do not create device-specific CSS architectures.

Visual certification checks:

- no horizontal overflow
- no clipped controls/text
- no unexpected layout shift
- component variants remain visually related
- long content does not break layout
- cart/account badges do not resize their parent icon
- dialogs/drawers remain inside viewport
- date/upload/quantity controls remain usable on mobile
- correct initial state appears before enhancement
- no ghost/flicker/duplicate controls are visible at any capture point

### 4. Interaction state matrix

For an interactive feature, test every state it supports rather than only the happy path.

Common state set:

- default/empty
- populated
- hover where relevant
- keyboard focus
- active
- disabled/locked
- loading/pending
- validation error
- service/backend error
- success/complete
- regression after upstream state changes

For account/rewards also test logged-out/logged-in and zero/populated history where applicable.

### 5. Accessibility

Required baseline:

- keyboard reachable/operable controls
- visible focus
- logical focus order
- labels associated with form controls
- meaningful button/link names
- live-status feedback when state changes need announcement
- disabled state is semantic, not cosmetic only
- touch targets are safe on mobile
- reduced-motion preference is respected when motion is introduced
- headings/landmarks are logical
- images/media have appropriate alt behavior
- color is not the only carrier of required status meaning

### 6. Shopify Theme Editor

Every merchant-editable feature must be tested in the editor, not only on a standalone storefront load.

Check:

- section add/remove
- section reorder
- block add/remove/reorder
- settings update without duplicate initialization
- `shopify:section:load` lifecycle when JavaScript behavior exists
- Theme Editor labels are understandable
- invalid setting combinations are prevented or degrade safely
- no editor-only flicker or duplicate event listeners

### 7. Localization/content resilience

Test at least:

- English baseline
- Spanish or intentionally expanded test strings for JILL bilingual resilience
- long headings/buttons
- missing optional content
- currency/language controls

Strings belong in locale/content systems, not hard-coded duplicated markup.

### 8. Performance budget

Theme Core should fail review when a feature solves convenience by shipping excessive global code.

Principles:

- load JavaScript only for features present on the page when practical
- keep the canonical CSS owners limited rather than creating feature stylesheet sprawl
- avoid global third-party libraries for behavior that can be implemented with small native code
- avoid polling/observer loops when events/state can provide deterministic updates
- do not use animations to mask first-render/layout errors

Before commercial release, establish measurable budgets for CSS bytes, JavaScript bytes, largest contentful paint, cumulative layout shift and interaction responsiveness; tighten them after real baseline measurement rather than inventing arbitrary numbers now.

### 9. Browser/platform matrix

Before JILL production migration and commercial release, certify current supported evergreen browsers on desktop/mobile, with special attention to Safari/iOS because form/date/upload behavior can differ materially.

The matrix is reviewed periodically; feature code must not depend on browser-specific hacks without an architecture decision.

### 10. Commerce smoke routes

At minimum certify:

- home
- collection
- standard product
- configurable/personalized product
- cart/drawer
- search
- custom-order request
- customer account entry points
- localization/currency controls

When affected, verify line-item properties arrive on the correct cart/order line.

## No-flicker certification

A feature passes no-flicker certification only if the intended initial state exists before user-visible paint/enhancement.

Explicit failures include:

- legacy element visible then hidden by JavaScript
- duplicated controls visible for even a short transition
- layout jumps because the wrong branch rendered first
- state changes after timers purely to correct initial rendering
- two scripts alternating ownership of hidden/classes/ARIA state

## Regression ownership

A regression test belongs with the canonical domain that failed. Do not add a one-off test file that duplicates the same behavior under a page-specific name.

## Certification record

A feature can be marked `CERTIFIED` in the migration registry only when:

1. architecture/Theme Check gates pass
2. applicable contract tests pass
3. visual/interaction state checks pass
4. accessibility baseline passes
5. Theme Editor lifecycle passes when applicable
6. no known high-confidence dead/duplicate code remains in the touched path

## Release discipline

Certification applies to a specific commit. Later changes to the owner must re-run the relevant gates. A screenshot or manual approval from an older commit is not transferable proof.