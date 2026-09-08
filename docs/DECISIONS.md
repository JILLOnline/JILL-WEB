# JILL Theme Core Architecture Decisions

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

## 2026-09-08 — Certification is commit-specific

**Decision:** A feature is `CERTIFIED` only after automated and manual gates pass on the implementation commit.

**Why:** “It worked before” is not reliable regression protection.

**Consequence:** Later owner changes rerun relevant architecture, behavior, visual, accessibility and Theme Editor gates.

## Decision process

Add a new entry only for a real architectural/product-system decision. Routine implementation details belong in code/commits. If a new decision supersedes an old one, append a dated decision and identify the superseded entry; do not rewrite history.