# WORK HQ compact visual edition

Status: SOURCE BUILT / LOCALLY REVIEWED. Not uploaded or deployed. Customer-facing
LIVE remains separate. No old receipt is reopened or reset by this edition.

## Reviewed change

Remove the large Home “Your day, at a glance” banner and its unused CSS. Preserve
the existing conditional Owner setup action as a normal button. Keep the single
Requests navigation entry. Tighten all six canonical HQ styles: shared navigation,
buttons, pills, cards, headings, numbers, body copy, Catalog/Access lists, request
facts, original item/personalization panels, conversation bubbles, status/message
forms, quote rows/fees/totals and Save/Reload controls. No handler, hook, route,
link destination, command prop, pricing, auth, cache or Requests behavior changes.
Business warnings, unavailable states and policy copy remain visible.

Desktop navigation measures 60 → 50px and standard buttons 36 → 30.1875px in
comparable local fixtures (~17% / ~16% smaller). Spacing generally tightens ~20%;
fonts use a readable floor rather than shrinking all text blindly: body 13 →
12px, small labels at least 11px, headings/numbers reduced by hierarchy. Coarse
pointer/phone controls retain 44px targets; phone form inputs use 16px to avoid
focus zoom. No zoom/transform scaling, external fonts, dependency or Shopify
shadow-DOM override. Native Shopify chrome remains platform-owned.

Actual route components rendered with published Polaris components and synthetic
local loaders: 48 cases at 1600/1024/390/320px, all four Catalog views, expanded
request details/product references, status/message forms, public conversation
bubbles and quote estimate ($80). No horizontal overflow, no command submission;
44px phone targets and 16px phone fields passed. This is local design review,
not authenticated Shopify UI or performance acceptance. A baseline React duplicate
key warning is retained; no component keys/Requests logic change in this task.
Evidence: `evidence/work-hq-compact-local-review-2026-10-19.json`.

## Isolated package and safety

`work-hq-density-reviewed.json` lists exactly seven reviewed runtime files and
normalized hashes. `work:hq:compact:check` compares their presentation boundary
to source `a6f650cf8bdf17781c30190d5b7017230aab6445` and rejects backend,
extension, theme, hook, command, link or unreviewed changes.

A visual deployment must NOT quietly include the unreleased quote calculation/
agreement/policy work on the branch. `prepareDensityBuild` exports only tracked
source from the current runtime's source
`576d6b0bcde43c43fda939f42513eefcb5adefb7`, overlays those seven files and reuses
installed dependencies in a new ignored local build directory. It copies no
credentials, sessions, env files or Git metadata. The package provenance records
both runner and runtime baseline plus all seven hashes. Exact business-source
comparison proves the unreleased calculator/policy change is excluded. Actual
isolated typecheck/build, Wrangler upload dry run and compiled workerd
connected-read/navigation tests pass. This is not a navigation diagnosis or deployed acceptance claim.

The shared visual release executor accepts this explicit isolated-build hook;
older profiles default to their original build path and their receipts remain
spent. New compact profile only:

- Ordinary version: `6473444f-86f8-4a83-a47a-56d1a2e19f05`, 100%.
- Quote canary: `dbc6341f-de7f-41de-8e97-6bf971201eeb`, 0%, retained exactly.
- Expected deployment: `1ffdde49-e556-43a6-b7bb-e10cd3a71048`.
- New receipt stem: `work-hq-compact-theme-v1` (upload/activate/restore once).

Fresh provider metadata/allocation and exact ordinary health must pass before
building/uploading. All current bindings/flags are preserved: Catalog ON,
ordinary quote drafts/conversation OFF, Owner commissioning OFF. No app release,
proxy/extension change, Google/gateway operation, secret change, migration/data
command, wallet mutation or paid service. Changed/unreadable state holds.

## Owner credential gate

Cloudflare Owner credentials exist only on the Owner PC. The prepared new command
is `npm.cmd run work:hq:compact:release-once`, after clean WORK branch verification
and fast-forward pull. It reserves NEW receipts, uploads once, verifies metadata,
activates once and independently verifies exact unpinned runtime and allocation.
A lost/uncertain result must NOT be rerun. Inspect read-only with
`npm.cmd run work:hq:compact:inspect`; it sends no signed POST. Restoration is
separately one-use, requires this runner's exact owned deployment/message and
no intervening allocation, and returns to 6473444f... with quote canary unchanged.
Provider deployment API has no atomic compare-and-swap; repeated read guards
hold changed state. Never invoke old visual/studio/navigation releases.

After deployment, refresh the existing authenticated WORK app; review Home,
Requests and all request sections, all four Catalog views and Access at desktop
and narrow widths. Do not create requests, save quotes, send messages, or run
app dev for this visual review. Authenticated visual acceptance remains pending
until actual Owner browser proof. Original intake reconciliation/testing holds,
full WORK operational acceptance and separate LIVE review remain open.
