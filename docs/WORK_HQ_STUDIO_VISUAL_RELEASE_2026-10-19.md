# JILL HQ visual theme v2 — studio presentation

User direction: stay on visuals; reduce obsolete/technical text, give navigation
and actions clear buttons, review density/type, and use a bolder JILL palette.
This is a new visual edition of the same HQ, with the same backend owners.

## Presentation

- Shared ink navigation with warm gold current tab; Home, Requests, Catalog and
  Access remain available at every authenticated page. Native Shopify and all
  backend permissions still govern access, including direct route visits.
- Purple/cherry hero, gold accents, white cards, system fonts, compact spacing.
  Internal navigation retains React Router links; external Shopify actions are
  anchors with button styling and the existing WORK destinations. They remain
  semantic links for keyboard and browser navigation.
- Home drops rollout roadmap and Rewards implementation prose. Enabled areas
  get short labels and direct actions. It does not expose new commerce features.
- Requests removes repeated feed explanations, metric subtitles and rollout
  footers. Error/read-only states, counts, filters, dates and actions remain.
- Record IDs, product references and online-session diagnostics are available
  through keyboard-operable native disclosures. Original customer fields,
  quantities, personalization allocations, references and ownership are retained.
- Catalog titles are readable text with separate Open in Shopify buttons;
  pagination and management actions use the shared button style. Tracking-off,
  missing/truncated data and capacity caveats remain where relevant.
- Quote and conversation help is shorter. Unsaved/lost-on-refresh warnings,
  disabled Save/Reload, internal-estimate and no-payment/order boundaries remain.
  No handler, hook, command control or business-component prop changed.

`hq-theme.css` remains the shared visual owner. Existing page CSS owns each
composition. No new dependency, external font, forced override, zoom or private
Shopify shadow-DOM styling. Touch controls/links/disclosures are at least 44px;
focus, read errors and native disabled states remain visible.

## Reviewed source and local proof

`work:hq:studio:check` restricts runtime changes from deployed source
`9a92d0287e69628c63bd7bec9a5e3dace63f1c94` to the 13 exact reviewed presentation
files in `scripts/work-hq-studio-reviewed.json`. Digests normalize Windows CRLF.
An AST comparison separately protects server functions, component setup/hooks,
command controls and business-component props. Authorized copy/layout changes
are recorded in that manifest; the old v1 wording guard is not weakened.

Local Chromium review uses actual route/component JSX and published Polaris
with synthetic fixtures; no authenticated backend is connected. Six screens at
1600/1024/390/320px: 24 cases, no horizontal overflow, visible touch controls,
links and disclosures >=44px. Shared navigation, keyboard disclosure expansion,
inbox filter, quick-status panel opening and the existing $80 estimate pass.
Existing duplicate React sibling-key warning and unavailable local icon CDN
responses remain known local limitations; this does not certify platform or
authenticated performance. Typecheck, fresh canary build, compiled workerd
identity/anonymous denial/foreign-host denial/quote-media-OFF checks, repository
and relevant detail/quote/media-provenance/branding/release tests pass.

## New release boundary

Current deployment is `dc3350e2-c394-4a5f-9d48-325ed23a1394`, with
`80b47610-4d8a-4186-a4c8-fe4f05daf964` at 100% and existing quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0%. The new profile requires that exact
baseline. The canonical existing visual runner is reused with a separate v2
profile; historical v1 defaults and receipt files remain unchanged and spent.

New commands:

- `work:hq:studio:check` — local reviewed presentation guard.
- `test:work-hq-studio` — local presentation/release policy tests.
- `work:hq:studio:inspect` — read-only metadata, receipt presence and unsigned
  exact runtime health; no signed POST, upload, allocation or receipt mutation.
- `work:hq:studio:release-once` — one new inactive upload, independent metadata
  read-back, one activation retaining the quote canary at 0%, exact unpinned
  health attribution. Rebuilds from fresh dist and validates locally first.
- `work:hq:studio:restore-once` — separately receipted restoration to the exact
  current visual v1 runtime, only if fresh reads identify this runner's owned
  v2 allocation with no intervening operator deployment. Never used speculatively.

New receipt names in the existing private Owner directory:
`work-hq-visual-theme-v2-upload-once-20261019.json`,
`work-hq-visual-theme-v2-activate-once-20261019.json`,
`work-hq-visual-theme-v2-restore-once-20261019.json`.
Never reset or repeat any receipt. Ambiguous output holds for read-only inspect.
Provider allocations lack a compare-and-swap lease; fresh reads are repeated
immediately before each permitted transition and concurrent changes hold.

All current bindings, secrets, D1, flags and app/extension identities must match
exactly. Catalog ON, quote drafts/conversation OFF, commissioning OFF. No Google,
gateway, app-dev, Shopify scope, schema, customer, wallet, secret, paid-service
or LIVE change. No testing approvals or one-use data-write allowances expand.

This v2 package is prepared locally, NOT uploaded or activated. Owner credentials
are required for provider reads/release. After the receipt, authenticated review
must verify all tabs in the existing WORK app, source data/actions, focus and
mobile rendering. Full WORK acceptance and LIVE review remain open.

## Visual theme v2 activated — 2026-10-19 19:00 UTC

Successful Owner receipt supersedes all preceding v2 prepared/not-deployed
status. Runner `5815213b29999310ea44049ef99d20b5178948c5`; package SHA-256
`c6652c586a6db71625764869306e816c19e1eebb0325e7c331119c613fd60719`.
Current HQ ordinary runtime: `d301efb4-b015-40d4-87ad-159a9fff82eb` at 100%.
Existing quote canary `dbc6341f-de7f-41de-8e97-6bf971201eeb` stays at 0%.
Deployment `3fbc20ff-1f9e-4e70-8f14-3e941638347c`, created
`2026-10-19T19:00:42.066909Z`. Provider allocation and unpinned exact runtime
health verified by the Owner runner; HTTP 200, database ready.
Canonical receipt: `docs/evidence/work-hq-studio-activation-2026-10-19.json`.

Visual v2 upload/activation receipts are SPENT. Never repeat
`work:hq:studio:release-once`, reset receipts or repeat historical releases.
Read-only inspection uses `work:hq:studio:inspect`. Visual v1
`80b47610-4d8a-4186-a4c8-fe4f05daf964` is now the guarded restoration baseline,
not ordinary active traffic. Current bindings and flags preserved: catalog ON,
quote drafts/conversation OFF, commissioning OFF. No secret, data/schema or
new billable service change. Existing quote testing limits remain unchanged.

Next visual check: refresh the existing authenticated JILL HQ — WORK app and
review Home, Requests, detail, Catalog and Access; verify shared navigation,
button affordances, technical disclosures, focus and narrow-width rendering.
Do not create requests/quotes or submit commands for a visual review.
Authenticated visual acceptance and full WORK operational acceptance remain
open. Customer-facing LIVE promotion remains a separate reviewed release.
