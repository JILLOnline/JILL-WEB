# JILL HQ WORK — workspace visual package (guarded release)

Status: **SOURCE PREPARED; NOT DEPLOYED**. Owner approved showing the requested visual changes on WORK. Production LIVE, Shopify storefront themes, Google QA, gateway, R2, D1 data and billing are out of scope.

## User-approved changes in this release

The exact 13 reviewed React/CSS files are frozen in `scripts/work-hq-workspace-layout-draft.mjs`. They combine (a) the refined centered **Quick Actions** capsule on inbox cards; (b) uppercase ORDER DETAILS and the removed redundant three-field inbox strip; (c) permanently visible **Order details** on full request workspace; (d) default-collapsed **Items & personalization** and **Quote worksheet** accordions with 44px controls, keyboard/focus support; (e) nonessential blue-highlighted helper copy removal. The quote editor stays mounted while collapsed, preserving unsaved values in memory; **quote drafts remain unavailable** unless the existing authenticated capability is enabled through a separate release.

The isolated build copies only these 13 UI files into historical `DENSITY_RUNTIME_BASE` `576d6b0bcde43c43fda939f42513eefcb5adefb7` and excludes newer/unapproved merchant business logic from branch HEAD. Source hashes reject unreviewed changes.

## Owner read-only baseline (2026-10-20T12:43:38.669Z)

- Source branch `jill/rewards-work`, HEAD `cf07a60d2d98ef6438b9cb6ac35f38265ccfa3d4` tracked clean; all seven visual/quote tests, typecheck, and app build passed.
- HQ active deployment `3f52ee4b-414e-499a-8854-b89c7a7fb610`, version `389a3378-833e-438c-ad55-d71e2238dded` at 100%.
- Cloudflare version metadata independently read by Owner: `JILL HQ WORK connected catalog/access v1 INACTIVE source b3992cb7f747cb1ae9816c7c6244653ea2dbe2b7`. This is the source marker for the **current active base**, not the new release HEAD.
- 14 HQ bindings, exact WORK HQ health HTTP 200, 0%-traffic quote version `dbc6341f-de7f-41de-8e97-6bf971201eeb`; quote drafts, conversation and owner bootstrap remain disabled.
- Gateway ordinary traffic remains untouched; budget evidence: no newly billable service but provider usage unverified.

This baseline was observed once. **Never assume it stays current.** Owner's read-only pre-release inspection MUST confirm this exact version, deployment, source annotation, pinned health and quote 0% before activation. Any change means HOLD/rebaseline after review; no blind override.

## New unique release profile and receipts

`scripts/release-work-hq-workspace-layout-owner.mjs` inherits the canonical guarded release engine and has a distinct receipt stem `work-hq-workspace-layout-v1` plus unique upload, activation, and restoration operation IDs. Previously used Order Details, Inbox Polish and Quick Pill receipts stay spent. The scripts do not authorize secret edits, schema migrations, customer writes, Shopify order or payment creation, or paid infrastructure.

Commands:

- Offline: `npm.cmd run work:hq:workspace-layout:check`
- Offline: `npm.cmd run test:work-hq-workspace-layout-release`
- Owner read-only: `npm.cmd run work:hq:workspace-layout:inspect`
- **ONE TIME ONLY** after all checks, `npm.cmd run work:hq:workspace-layout:release-once`
- Owned one-time restore after verified activation: `npm.cmd run work:hq:workspace-layout:restore-once`

The executor authenticates Owner on the Windows WORK branch, checks exact commit against origin and source fingerprints, checks Cloudflare metadata and bindings, composes/bundles isolated source, runs typecheck, build and local workerd tests, performs an inactive upload once, validates candidate metadata, and only then attempts a 100% WORK activation with unchanged 0% quote allocation. Release receipts are reserved **before** mutations. If upload or deploy acknowledgments are uncertain, DO NOT REPEAT the command. Inspect instead. No deletion/reset of local receipt files.

## Visual acceptance (after successful release)

Open Shopify WORK admin → JILL HQ → Requests (authenticated Owner), test the centered Quick Actions menu at desktop and narrow widths, then open a request and confirm permanent Order details, closed-by-default Items/personalization and Quote worksheet, status labels, readable layout, quote input persistence while toggling, keyboard focus/Escape and no redundant blue helper copy. Do not save or send real customer data during visual QA. Certified build/health alone does not prove authenticated visual acceptance.
