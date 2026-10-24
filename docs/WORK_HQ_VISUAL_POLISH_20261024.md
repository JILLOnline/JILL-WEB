# JILL HQ WORK — deep visual pass, source-only
Date: October 24, 2026
Base: `5c3ceb2e31cabb04ebf853e9968cf64fcc9d694d` on `jill/hq-quote-catalog-preflight-20261022`
Branch: `jill/hq-visual-polish-source-20261024`

## Purpose / proof boundary
Improve owner-facing polish and information hierarchy in the **already working**
HQ WORK shell without disturbing verified Shopify/OAuth/Owner/D1 reads,
request actions, request-row accordion, protected business rules, and
Customer/My JILL feature flags. The October 24 Owner screenshots and
`docs/WORK_HQ_OWNER_VISUAL_QA_20261024.md` are the design baseline.

This PR is **not deployed** and not a new Worker upload/traffic activation.
The currently commissioned HQ Worker must remain
`d1f4e07f-8c9b-4b40-97a4-0c13d2c5149a`, deployment
`5d996637-73b4-427e-92a0-a36a12581172`. The previous tested
HQ rollback version is
`44ad4a81-55ad-4f49-9965-61260cc2294d`.
LIVE, KEEP, Gateway, D1, R2, Google and all storefront themes are outside scope.

## Precise visual changes

1. **Typography and rhythm** — one additive `hq-visual-polish.css`, scoped
   under the authenticated `.jill-workspace` root, raises small text and
   form legibility, standardizes control height, softens border/surface
   rhythm and makes keyboard focus rings visible. Existing JILL purple,
   gold navigation, state colors and URLs remain unchanged. No global
   Shopify selectors and no `!important`.
2. **Home** — larger headings and metrics, more legible cards, consistent
   buttons, same Shopify links and Owner role gating.
3. **Requests list** — preserves full-row disclosure, separate direct
   `Message customer` and `Update status` buttons, expanded verified
   source detail and its existing editor portal; only typography/spacing
   are adjusted. No new Quick Actions menu.
4. **Request details** — clearer title, four top stats, source activity,
   panel labels and item details. At narrow widths the two top info
   panels stack rather than squeeze.
5. **Quote Worksheet** — **only markup reordering** below the unchanged
   hooks and handlers: the existing Save/Reload controls and truthful
   `Entries are lost on refresh` warning now appear immediately after
   the estimate. A new **native closed `<details>` disclosure** contains
   the *same mounted* 11-step readiness list, P1/P2 verification, exact
   Shopify price comparison button, optional preflight and artwork
   audit. The checks are neither removed nor converted to a false
   PASS; they remain evaluated and can be expanded without losing
   entered prices. Pricing input and totals remain visible when the
   worksheet itself is opened. No draft feature is enabled.
6. **Messages** — stronger visual split between verified request list,
   controls and selected thread, but does not fabricate delivery,
   unread counts or claim two-sided messaging is connected.
7. **Catalog** — more readable product rows/SKUs/variants, tabs, search,
   collections and status pills. Inventory source labels and numeric
   values remain unchanged in this visual-only pass; separate data
   semantics fix is required for the `0 total` vs `Not tracked`
   discrepancy. Catalog is still read-only.
8. **Small screens/accessibility** — 3-column mobile nav for six tabs,
   44px touch actions, 16px phone inputs to avoid iOS zoom,
   native focus and reduced-motion preference. No fixed UI overlay,
   nested iframe scroll mechanism, or URL/external font request.

## Non-negotiable invariants
- No modifications to `backend/`, `theme/`, Worker entrypoints, routing,
  authentication, merchant scopes, payments, gateway, D1 migrations,
  `wrangler*` manifests, CI release credentials, or event stores.
- All original business hooks and network calls in
  `WorkQuoteWorksheet.tsx` remain **byte-identical before JSX**.
- All quote checklist sections and technical compare components remain
  present exactly once, **not rendered conditionally on disclosure state**.
- The parent `app.tsx` is otherwise byte-identical to baseline except
  one style import.
- No new buttons claim a send, save, invoice, live price update,
  customer message delivery, or Contact Us connection.
- The added CSS must not contain global selectors, `!important`,
  external CSS/URLs/fonts or fixed overlays.

## Verification
`scripts/test-work-hq-visual-polish-guard.mjs` compares all changed
paths against the immutable accepted source commit, checks the exact
app shell diff, unchanged quote hook/control plane, required quote
sections, safe local-only CSS/keyboard/responsive styles, and the
no-backend-edit allowlist.

`.github/workflows/jill-hq-visual-polish-preview.yml` runs the guard,
existing quote regressions, route typecheck, WORK app build and compiled
bundle checks, **without** any deploy or provider write.

Green CI proves structural and compile safety only; it does not replace
Owner **side-by-side browser acceptance** of Home, Requests accordion,
quote advanced review (including unchanged inputs on collapse), Messages,
Contact Us, Catalog product/collection/inventory/location, Settings,
desktop/tablet/mobile and keyboard navigation.

## Release decision
**HOLD / SOURCE ONLY.** A visual pass should not auto-change the
owner-accepted running WORK Worker. After browser UI acceptance of a
new *separate* preview or source build, require a fresh Owner-approved
WORK-only upload/activation with explicit rollback readiness and repeat
Shopify Owner/Customer A/B/guest regression before any LIVE consideration.
