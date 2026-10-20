# WORK HQ inbox polish release — 2026-10-20

Status: **source prepared, NOT deployed**. Historical HQ visual, studio, compact and Order details receipt namespaces remain untouched. This new release does not operate on LIVE.

## Approved visible change

The inbox request card retains the submitted timestamp, now right-aligned inside the heading. It removes the duplicate "Needed by / Items / Fulfillment" row; those planning fields already exist in the verified Order details presentation. The inbox disclosure heading reads **ORDER DETAILS** in uppercase with stronger typography. **QUICK ACTIONS** has a subtle rounded pill heading; Update status and Message customer keep their existing handlers and display as rounded pills, while **Open request →** moves from the detached footer into the shared compact action group. The full request workspace's noncompact actions remain unchanged. Responsive controls retain >=44px touch targets.

## Frozen source, privacy and authority boundaries

The source package contains exactly eleven reviewed UI files: the ten-file frozen Order details overlay plus the existing shared `WorkRequestQuickActions.tsx` component. Their Git blob fingerprints are pinned in `scripts/work-hq-inbox-polish-package.mjs`; CRLF/LF normalization avoids Windows checkout false positives. All server code, authorization, quote calculation/agreement, Google gateways, merchant commands, Shopify themes/extensions and secrets come from the **previous verified WORK runtime baseline** `576d6b0bcde43c43fda939f42513eefcb5adefb7`, not from the branch's unrelated, unreleased changes.

Source guards verify every exact UI blob, the authenticated on-open exact-ID detail fetch, scoped pill CSS, removed duplicate/footer, correct full request URL and existing status/message command path. The isolated source composer reuses `prepareReviewedPresentationBuild`. Its run has its own local build directory and excludes `.git`, credentials, env files and customer data. No R2, D1 migrations, app registration, gateway, customer writes or paid infrastructure are authorized.

## One-use guarded provider profile

`scripts/release-work-hq-inbox-polish-owner.mjs` reuses the existing release driver, current upstream worker/config and exact one-use receipts. It requires the known historical WORK deployment `a67cfa4f-cea0-4590-b0b7-10f6f17acebc`, ordinary version `f9830ddf-4ff7-4e24-896e-3618ee5686d7` at **100%**, existing quote canary `dbc6341f-de7f-41de-8e97-6bf971201eeb` at **0%**, exact ordinary source annotation `a3b0c82e26030c7df6ae5ec9bf7af0c96e5da48d`, and unchanged bindings/flags. These historical IDs are preflight gates, not a claim of today's deployment: if the Owner inventory differs, **STOP**, do not rewrite them without a fresh source/deployment audit.

The exact commands, each with its own previously unused namespace, are:

- Read-only source check: `npm.cmd run work:hq:inbox-polish:check`
- Offline ownership/baseline test: `npm.cmd run test:work-hq-inbox-polish-release`
- Read-only remote inspection (requires Owner PC credentials): `npm.cmd run work:hq:inbox-polish:inspect`
- Guarded, one-use inactive upload and activation: `npm.cmd run work:hq:inbox-polish:release-once`
- Owned one-use restoration if and only if its activation receipt proves this specific release owns current traffic: `npm.cmd run work:hq:inbox-polish:restore-once`

**No upload or activation is authorized until** current Owner inventory, local source check, package/build/compiled boundary checks, and expected allocation/binding/flags match. Cloudflare release is never retried after an uncertain upload/deploy; read-only inspection comes first. The canonical executor records each receipt before mutation. Cloudflare lacks atomic deployment compare-and-swap, so any concurrent change is a HOLD, not a blind retry.

## Remaining acceptance

Confirm source CI green, obtain the Owner's current read-only WORK runtime inventory, and check that there is no newer ordinary deployment or intervening release. If the exact baseline is still current, run the Owner review checks and one-time release once; preserve the complete output. Afterwards use authenticated WORK HQ at desktop and 320/390px phone widths: verify card layout, action links, status/message forms, expanded details, no duplicated fields, and no stale private data. The local build and CI are not authenticated runtime acceptance. Full WORK operations, quote canary promotion and customer LIVE remain independent HOLDs.
