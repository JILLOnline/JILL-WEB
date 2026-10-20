# JILL HQ WORK Quick Actions centered pill — guarded release v1

**Status:** Source/UI tests pass locally; brand-new release profile prepared; **not uploaded or deployed by GitHub**. Owner Cloudflare inspection and exact active source annotation verification still required. This new release supersedes the *design* of Inbox polish v1, not its spent receipts, history, or operational controls.

## Approved UI

The compact Inbox card shows **one centered plum-purple QUICK ACTIONS ⌄ pill**, closed by default. Opening it reveals exactly three stacked, accessible 44px actions: Update status, Message customer and Open request →. Choosing a status/message action collapses the disclosure and reveals the existing editor below. Esc closes the menu and returns focus to the summary. The full detail workspace retains its preexisting noncompact action UI and verified merchant command route. The card still shows uppercase ORDER DETAILS and omits redundant needed-by/items/fulfillment summary. No merchant write implementation, data or customer identity changes were authorized.

## Scoped source

`scripts/work-hq-quick-pill-package.mjs` pins exactly 11 git-blob-verified UI files (the ten reviewed Order details overlay files and `WorkRequestQuickActions.tsx`). CSS is scoped to the Inbox. The local package composer takes immutable WORK business/runtime source `576d6b0bcde43c43fda939f42513eefcb5adefb7` plus these 11 UI files, excluding branch changes to unrelated Shopify APIs, quote agreements, merchant authorization, D1, Google services, gateway, themes and extensions.

CI includes `test:work-hq-quick-pill` and `test:work-hq-quick-pill-release`. Both are offline: no credentials, provider calls, receipts, schema writes or deployment.

## Latest read-only runtime evidence

At **2026-10-20 03:30:29Z**, Owner `work:runtime:inventory:owner` confirmed:

- WORK HQ current deployment `6cdff6bd-6743-4156-aaed-e874f2b3d914`;
- WORK HQ 100% ordinary `9dd60e19-9c77-4886-9c7e-56589ac0b401`;
- 0% quote canary `dbc6341f-de7f-41de-8e97-6bf971201eeb` held;
- HQ HTTP 200 health; ordinary version has 14 bindings, with catalog, detail, merchant writes, OAuth enabled, quote draft, conversation and bootstrap disabled;
- no newly billable service, usage itself unverified and private media held.

**Source annotation not yet in that inventory.** Prior guarded Inbox polish v1 release invocation used runner SHA `4aee2c15603f4e6b6165eb5fe2168c1b24dd39df`; the new release profile expects that exact annotation for the 100% base. This is a **pending independent Cloudflare verification**, NOT a source identity already established by the inventory. The release driver fails closed before upload if metadata differs.

## Unique one-use release

Dedicated file: `scripts/release-work-hq-quick-pill-owner.mjs`. It invokes the canonical verified visual release executor with independent receipt stem `work-hq-quick-pill-v1` and operations `HQ_QUICK_PILL_V1_*`. Older `inbox-polish-v1` receipts stay permanently spent. One-time mutation is never repeated on errors. Exact allocation, source annotation, metadata bindings, quote canary, runtime health and source cleanliness must all pass. The profile preserves current vars/secrets using existing Wrangler release pipeline. No gateway, LIVE, billing, schema, customer messages or payments.

- `npm.cmd run work:hq:quick-pill:check` — offline source guard
- `npm.cmd run test:work-hq-quick-pill-release` — offline one-time release contract
- `npm.cmd run work:hq:quick-pill:inspect` — read-only Owner Cloudflare metadata check
- `npm.cmd run work:hq:quick-pill:release-once` — **Owner-only one-time upload and switch**, only after passing read-only inspection and confirming no intervening release
- `npm.cmd run work:hq:quick-pill:restore-once` — one-use rollback only when this exact attempt owns the current deployment.

**HOLD** the release if the active annotation is not the expected SHA, if 100% allocation changed, if any prior Quick pill receipt exists, if remote health is not independently 200/exact, or if any binding/flag changes. Never manually reset receipts or rerun after an uncertain Cloudflare outcome.

## Acceptance after activation

Authenticate to `jill-work.myshopify.com` HQ WORK; verify a request card at desktop and narrow mobile widths. The centered Quick Actions pill must be the ONLY resting action element; click to reveal exactly 3 options, click to open each existing editor, Escape to close, Open request to navigate to that exact request. Check that status/message submission still uses original authorized Work command path and that Order details remains distinct. Real merchant submissions are unnecessary for visual QA; avoid making live-side effects. Read the new deployment allocation and pinned `/healthz`, do not call the change accepted solely from CI.
