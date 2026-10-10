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
## Customer Account Rewards release certification — 2026-10-09

Three separate **release roles**, not interchangeable customer-account routes:

- **WORK** — `jill/rewards-work` feature branch and draft PR checks. Development Shopify store `jill-work.myshopify.com` and independently installed `JILL WORK Rewards` app; Shopify CLI preview built all three account extensions and Coupons rendered in Customer Accounts on 2026-10-09. WORK has a real, explicitly manually seeded test discount and QA points wallet, but **no production app deployment, autonomous redemption, or backend worker deployment**.
- **KEEP** — `jill/rewards-keep` retained green comparison baseline. KEEP is a Git reference; it is **not** a second Shopify-hosted account dashboard.
- **LIVE** — the existing installed JILL Custom Form app and customer-account routes. Only the certified `jill/theme-core` commit may be deployed, and only after an explicitly confirmed manual release with matching full commit SHA. Do not confuse canonical Git source with evidence of an actual Shopify app release.

WORK app identity is verified from Shopify Dev Dashboard screenshots (2026-10-09): `JILL WORK Rewards`, active version `work-initial`, public Client ID `f8e1ebdbae84490dc8ea5b133637e6c0`. It differs from LIVE `JILL Custom Form` Client ID `ebf1a69d82f46619d2f2945faab78afa`. Later Shopify CLI output and WORK Admin API verified local link, app installation, compiled extension preview, and WORK metafield definitions. Protected customer data and actual redemption write remain separate runtime validation gates.

WORK bootstrap from an authenticated developer checkout of `jill/rewards-work`: `npm install`; `npm run rewards:work:link` to pull `shopify.app.work.toml` from the verified WORK Client ID; then `npm run rewards:work:preview` to validate the pulled app configuration and run `shopify app dev --config work --store jill-work.myshopify.com`. The local linked config and CLI environment files are gitignored. The preview validator fails if it detects a LIVE Client ID, wrong app name, missing Rewards scopes, or known LIVE URLs. Previewing requires a logged-in Shopify CLI session; **never** use a production app authentication token or production webhook/backend for WORK. The isolated Rewards backend and test customer data are separate release gates.

Shopify Customer Account full-page extension versions are app-scoped. To preview WORK safely in Shopify, use a separate development store and an isolated development app through `shopify app dev`. The production app client ID, its existing extension UIDs, production customer points, and production discount objects must not be used for a WORK write test. A separate app/store is not represented as configured unless its identifiers and preview session have been verified.

**E2E release gate** (real customer-account runtime in an isolated development store):
1. Confirm Yes closes the modal and immediately replaces Redeem with progress. Confirm No closes with no write.
2. Confirm Customer Account `metafieldsSet` acknowledges both tier and nonce on the authenticated test customer. Inspect GraphQL user errors; a code-level mock is not proof.
3. Confirm the sweep claims the nonce, creates exactly one eligible 30-day, single-use, customer-targeted Shopify discount, commits wallet+points, and clears the request.
4. Confirm the dashboard says Code redeemed, offers Use Now, and the Coupons page has the same code even after a reload. Verify errors and stale-refresh recovery.
5. Verify the discount is recognized on the correct test cart, survives navigation within that storefront session, respects the minimum order, and does not stack. A `/discount/CODE` redirect alone is **not** proof of cart application or session lifetime.
6. Verify duplicate Yes clicks, concurrent requests, write refusal, missing/stale digests, failed discount creation, failed wallet write/rollback, and retry after a timed-out request.
7. Capture phone/tablet/desktop states with Shopify customer-account native styling, keyboard navigation and focus, and approved JILL wording.
8. Record the exact working app-version evidence, source SHA, backend build SHA, isolated test data cleanup, and explicit LIVE approval before release.

Until these are checked on the actual Shopify runtime, do not mark Rewards redemption end-to-end certified or move the draft PR to LIVE.


### Verified WORK Shopify fixture — October 9, 2026

Verified directly through the connected WORK Shopify Admin API (`jill-work.myshopify.com`), not inferred from GitHub tests:

- `JILL WORK Rewards` is installed in the WORK store. Shopify CLI locally built `jill-account-dashboard`, `jill-account-coupons`, and `jill-account-home`, and the Coupons preview rendered under WORK Customer Accounts.
- Customer metafield definitions: `points_balance`, `eligible_spend_cents`, `points_earned_lifetime`, `points_redeemed_lifetime`, `redeem_request_points`, `redeem_request_nonce`, `coupons`. The two redemption-request keys have `customerAccount: READ_WRITE`; other customer keys have `READ`. Order metafield `jill_rewards.credited_cents` also exists.
- An isolated merchant-associated WORK test customer has a manually seeded QA wallet and a real WORK-only Shopify discount `JILLWORK5-QA-20261009` with $5 off, $25 minimum, single use, once/customer, no stacking, customer-specific eligibility, and an expiration of 2026-11-08T23:00:00Z.
- The stored QA ledger verifies `points_earned_lifetime=10`, `points_redeemed_lifetime=10`, `points_balance=0`, wallet exactly one matching active code, and `redeem_request_points=0`. No stranded request. This coupon is a **manual test fixture**, not evidence that the redemption handler/worker executed.
- No automatic WORK backend, minute sweep, webhook registration, or test-order/refund processing has been certified. The Google Apps Script production backend must NOT be pointed at WORK and no production credentials or project IDs may be reused for a WORK deployment.
- Separate runtime identity and authorization are required before any customer-triggered redemption is called end-to-end functional. The existing WORK preview can show the fixture coupon, but a user click on Redeem must not be used as proof of backend processing.


### WORK backend build prepared; runtime authorization still required

- A WORK-specific `npm run rewards:work:backend:bundle` command generates `.work-backend/` from the **existing canonical** Google Apps Script source. The bundle contains the Rewards processor, Shopify webhook infrastructure, minute sweep, and public promotions synchronizer; it is not deployed automatically.
- At build time the source replaces the exact runtime marker `JILL_REWARDS_RUNTIME='LIVE'` with `'WORK'`, stamps the immutable Git SHA, removes the production store URL, legacy production email/sheet identifier, and old Shopify shop fallback, and refuses to package if known LIVE markers remain.
- At runtime WORK requires `SHOPIFY_SHOP=jill-work.myshopify.com` and `SHOPIFY_CLIENT_ID=f8e1ebdbae84490dc8ea5b133637e6c0` before any Admin API call. Custom Order ingress and sheet setup are disabled in WORK mode. The LIVE runtime stays unmodified until an explicit separate approval.
- Shopify OAuth client secret, a distinct Apps Script project/deployment ID and its Script Properties, Google Apps Script authorization, webhook/trigger installation, and a successful health run are **not** provisioned by code generation. Never put any of these secrets in Git, screenshots, or chat.
- WORK needs the additional Admin scope `write_orders` for order credit metafield writes. The isolated local config-preparation command automatically adds this scope and refuses the production app ID.
- CI validates the generated backend's isolation and the normal Rewards regression suite. It is **not** evidence that the backend was deployed or that a real Yes-click generated a coupon automatically.

### WORK-to-KEEP-to-LIVE execution runbook (pending authorization)

**Operating rule:** Work only against the independently installed WORK app on `jill-work.myshopify.com`. The existing LIVE app, Shopify discount objects, Google Apps Script project/deployment, and actual customer points are strictly out of scope until independent certification and explicit release approval. No parallel Rewards algorithm or second source of accounting truth.

| Gate | Owner and exact action | Evidence required before next gate |
| --- | --- | --- |
| A. WORK app security | Assistant audits WORK app scopes: customer-account `customer_read_customers`, `customer_write_customers`; Admin `read_customers`, `write_customers`, `read_orders`, `write_orders`, `read_discounts`, `write_discounts`. Confirm customer-account protected-data access, both request metafields `READ_WRITE`, and other Rewards metafields `READ`. Reauthorize changed scopes in Shopify WORK where requested. | WORK app identity, granted scope evidence, authenticated Customer Account metafield read and write response. A configuration file alone is insufficient. |
| B. Separate Google runtime | Assistant prepares/reviews the existing `npm run rewards:work:backend:bundle` artifact (same canonical v13 algorithm). Using authorized Google browser/CLI, create a **new** Apps Script project solely for WORK and upload the WORK bundle. User handles Google sign-in/permission prompts and places the WORK app secret directly in Google Script Properties; never paste a secret into chat/Git. Set `SHOPIFY_SHOP=jill-work.myshopify.com`, `SHOPIFY_CLIENT_ID=f8e1ebdbae84490dc8ea5b133637e6c0`, `SHOPIFY_CLIENT_SECRET=<WORK-only secret>`; configure a distinct public `/exec` URL as `SHOPIFY_REDIRECT_URI`; clear any inherited `SHOPIFY_ACCESS_TOKEN`. No copied production script, sheet ID, or OAuth token. | A distinct Apps Script project/deployment, verified WORK-only properties and generated build SHA, successful WORK-only Admin API authentication. Fail closed if any expected identity differs. |
| C. Automatic processing | Run the canonical `setupJillRewards()` in the authorized WORK script. It should establish the WORK-only minute sweep and Shopify webhook subscriptions and initialize the separate promotions sync. Read the watchdog/health, count worker triggers/subscriptions, inspect actual Shopify source objects, and verify minute freshness. | Health `ok:true`, v13/build SHA matches committed source, exactly one sweep trigger, required WORK webhook subscriptions, no LIVE identifiers, and no unauthorized custom-order ingress. |
| D. Real redemption E2E | Use a **fresh designated QA customer** or clean reset (the existing fixture has 0 available points and must not be used as an automatic-redemption success). Seed 30 points in WORK only with ledger-consistent values. Exercise No (no mutation) and Yes. Inspect actual customer-account mutation acknowledgment, nonce claim, precisely one real customer-targeted discount, 10-point deduction, cleared request, wallet state, refresh, Dashboard success, Coupons, and Use Now on the active WORK cart. Verify minimum $25, nonstacking, once/customer, code expiry. Do not treat a link redirect as proof that checkout accepted the code. | Recorded customer ID, request nonce, WORK discount ID/code, ledger before/after, screenshot/trace, checkout cart result, and code source-of-truth match. |
| E. Adversarial + UI QA | Verify double clicks, concurrent requests, stale digests, permissions failure, delayed worker, creation failure, wallet write rollback, re-entry after reload, expired/used/admin-deleted coupon, and refund solvency. Test phone/tablet/desktop and keyboard focus. Session-only discount application is **not** guaranteed by Shopify's native discount redirect; either implement and prove a supported removal mechanism or explicitly agree on Shopify's native persistence semantics before certification. | CI green at exact SHA and Shopify WORK runtime traces for happy path and failure recovery. Zero unresolved high-impact issues. |
| F. KEEP + approval-controlled LIVE | Advance the existing KEEP Git reference only after WORK approval, record exact version/SHA and audited fixtures, then audit **all** deployment workflows including the older `main` account deploy route. Disable unapproved auto-LIVE writes before proposing any release. LIVE must require fresh manual authorization, exact source SHA, rollback and post-release monitoring. | User explicitly approves a certified LIVE release; a draft PR, app preview, or CI pass is never an implicit production deployment authorization. |

**Recovery:** For a WORK backend incident, stop the WORK minute sweep and deactivate WORK webhook subscriptions before rerunning setup. Preserve request nonce, discount ID, and wallet evidence; reconcile or revoke only identified WORK QA discounts as appropriate. Never delete an audit record or restore spendable points solely because a UI request timed out. Keep the known-green KEEP reference intact throughout.

**Current stop point:** A, backend build artifact, and a manual QA coupon have supporting evidence. B/C are not deployed or authorized; D/E/F cannot be marked passed. Only actions requiring an authenticated Google or Shopify permission/secret prompt should be surfaced to the user.

### WORK backend project created and source uploaded (2026-10-09)

A user terminal run of `npm.cmd run rewards:work:backend:bootstrap` confirmed a **new, separate** Google Apps Script project was created using the authorized Google account and exactly three files were pushed: `appsscript.json`, `JILL_Custom_Order_Automation_REWARDS.gs`, `JILL_Public_Promotions.gs`. Source build SHA was `a91f5136527e3ae9f312e93ff8eb260809785bb4`. This evidence confirms **source upload only**, not an authorized/active web-app deployment; no `/exec` deployment, WORK Script Properties, trigger, webhook, or actual redemption is yet verified.

Shopify WORK installation query was repeated after the isolated `npm.cmd run rewards:work:preview` restart. Shopify now confirms **all nine required scopes granted** to the installed `JILL WORK Rewards` app: `customer_read_customers`, `customer_read_orders`, `customer_write_customers`, `read_customers`, `read_discounts`, `read_orders`, `write_customers`, `write_discounts`, and `write_orders`. The three Customer Account UI extensions built, and Shopify CLI reported `Ready, watching for changes`. This closes the installation permission gate; it is not evidence that Apps Script has credentials or that a redemption worker ran.

Do not execute `setupJillRewards()` or install subscriptions until WORK Script Properties are set securely, a distinct authorized `/exec` deployment exists, and preflight identity/health are verified. The Apps Script editor must not receive LIVE credentials; the WORK Shopify Client Secret must not be copied into GitHub or conversation text.

### WORK published endpoint — verification gate open (October 9–10, 2026)

The merchant reported completing WORK-only `SHOPIFY_SHOP`, `SHOPIFY_CLIENT_ID`, and `SHOPIFY_CLIENT_SECRET` Script Properties and supplied a separate Google Apps Script Web App `/exec` URL. The URL has the expected shape, but **the live endpoint could not be retrieved from the assistant's network**, so deployment access, active code identity, Google authorization, WORK credential exchange, webhook readiness and runtime health are **unverified**. Do **not** run `setupJillRewards()` or assume a functioning minute sweep based only on the existence of a URL.

Next read-only gate: open the provided WORK deployment with `?jill_rewards_watchdog=1` (no mutating parameters) and confirm it returns parseable JSON with `watchdog:true`, `engine_version:"13"`, `build_sha:"a91f5136527e3ae9f312e93ff8eb260809785bb4"`, and an expected `ok:false` until first setup installs subscriptions and triggers. If it redirects to Google sign-in, returns an HTML error, exposes an unrelated SHA, or reports an unexpected runtime exception, **stop**. The endpoint URL is public by design but must never contain credentials or topic-scoped webhook tokens. After this gate, separately confirm script property `SHOPIFY_REDIRECT_URI` is the precise WORK `/exec` URL before performing any mutating bootstrap.

### WORK Google project bootstrap — prepared, not executed

The first local Google Apps Script setup is consolidated into `npm run rewards:work:backend:bootstrap` (on Windows: `npm.cmd run rewards:work:backend:bootstrap`). Prerequisite: authenticated developer checkout of branch `jill/rewards-work`, locally linked `shopify.app.work.toml` pointing to Client ID `f8e1ebdbae84490dc8ea5b133637e6c0`, and Google's Apps Script API enabled in the Google account.

This command rebuilds the existing canonical engine into ignored `.work-backend/`, validates the Shopify WORK identity, requests a **separate interactive Google clasp authorization** if needed, creates `JILL WORK Rewards Engine` in Google Apps Script when no recorded WORK project exists, pins its Script ID to ignored local metadata, refuses a mismatched/replaced Script ID, rejects unexpected code files, uploads the two canonical JILL sources, and leaves any production Apps Script project untouched. Source build includes a Google web-app manifest with `ANYONE_ANONYMOUS` ingress executed as the deploying user: this is necessary to receive Shopify server-to-server webhooks; topic-scoped request authentication and WORK-only ingress restrictions remain mandatory. The bootstrap explicitly **does not deploy** a public web app, register webhooks, or start the sweep.

The Google owner must then, in that independently created WORK project only, configure WORK-scoped Script Properties without disclosing secret values in chat, authorize Google execution, deploy a distinct `/exec` web app, and validate health before running `setupJillRewards()`. No new Google project or running worker exists until the owner actually completes this authorization. Do not confuse successful GitHub tests or local source upload with a running webhook endpoint.

On October 9, 2026, the WORK store additionally received a `SHOP` metafield definition `jill_promotions.active_public_codes` with storefront `PUBLIC_READ`. There is intentionally no made-up fresh promotion snapshot; the WORK backend must perform the real source scan and write it on first successful sync.

### WORK runtime first initialization — merchant execution evidence

On October 9, 2026 around 9:49 PM ET (October 10 01:49Z), the merchant ran `setupJillRewards()` in the isolated Google Apps Script **JILL WORK Rewards Engine** and provided the complete success log. The log reports `ok:true`, Rewards v13, build SHA `6573d02d99af906c7433914740ef3f70c278f3ae`, and six newly created SHOPIFY WORK topic subscriptions (`ORDERS_PAID`, `REFUNDS_CREATE`, `ORDERS_CANCELLED`, `ORDERS_EDITED`, `CUSTOMERS_UPDATE`, `DISCOUNTS_DELETE`). One one-minute Rewards sweep trigger was created. A subsequent initial reconciliation scanned four customers, processed zero redemption requests, and reported an empty deletion queue; the public promotions scan found one public free-shipping code (`FREESHIPPING2026`).

October 10 read-only connected Shopify WORK Admin API audit independently confirmed `jill-work.myshopify.com`, four customer records, and a valid `jill_promotions.active_public_codes` shop metafield snapshot (`version:1`, one public free-shipping offer). The snapshot was refreshed at `2026-10-10T14:30:44.650Z`, showing continued promotion synchronization after setup. A separate ChatGPT Shopify app's `webhookSubscriptions` query returns zero because Shopify scopes subscription discovery to the *calling app*; this is **not** contradictory evidence against the six JILL WORK Rewards app subscriptions. Verify the latter via the Rewards v13 watchdog, which uses JILL WORK Rewards app credentials itself.

**Not yet certified:** JILL WORK watchdog `ok:true`, its internal 6/6 and 1/1 trigger states, scheduled sweep freshness, successful new-customer earn/order refund accounting, automatic redemption, customer-targeted native discount, 30-day expiration, wallet persistence, native cart discount application, and adversarial retries. An existing WORK customer has prior coupon/points data; do not reuse that customer for pristine first-redemption QA or overwrite an existing wallet. Never run the setup again without inspecting watchdog and executions after a partial error.


### WORK healthy watchdog (2026-10-10)

Merchant-provided public read-only `?jill_rewards_watchdog=1` response returned **`ok:true`**, version `13`, expected build `6573d02d99af906c7433914740ef3f70c278f3ae`, Rewards infrastructure `6/6` verified webhooks and `1` trigger, sweep `ok:true` and fresh, promotions `ok:true` and fresh with `1` trigger and `1` public offer, and deleted-discount queue depth `0`. This closes the initial WORK runtime health gate and confirms currently scheduled processing; it is **not** proof that an actual customer redemption, webhook delivery, discount issuance, wallet transaction, checkout coupon application, or refund path works. The watchdog explicitly reports `standard_hmac_verified:false`, indicating this app currently uses its documented topic-scoped webhook query secret protocol rather than verified standard Shopify HMAC.

Read-only connected Shopify WORK Admin API scan found four customer records, with one prior manually seeded QA coupon fixture (0 spendable points, 1 existing coupon). Do not overwrite it or mistake it for the first automatically generated coupon. A **new independently sign-in-capable QA customer** should be used for the first genuine redemption test; initialize only WORK QA balances through a reversible, auditable method and preserve before/after customer, discount, cart, and request-nonce evidence. No QA customer was created or mutated during this audit.

### Fresh WORK QA redemption fixture — seeded and independently verified

A separate WORK-only customer was successfully created using a merchant-authorized plus-address inbox alias, with `JILL_WORK_REWARDS_QA` and `SYNTHETIC_TEST_CUSTOMER` tags and an explicit WORK-only note. Do **not** publish the personal sign-in email, customer ID or authorization codes in the public repo. A Shopify WORK Admin API query confirmed zero orders and no existing `jill_rewards` metafields before the seed. Via a successful `metafieldsSet` mutation the fixture was seeded with **synthetic** ledger values `eligible_spend_cents=30000`, `points_earned_lifetime=30`, `points_redeemed_lifetime=0`, `points_balance=30`, `redeem_request_points=0`, and `coupons=[]`. The artificial spend equivalent is for accounting consistency in a development store, not real revenue, earnings or purchase evidence. A subsequent independent customer query confirmed every field and no new orders. No `redeem_request_nonce` is set, and **no actual redemption has occurred yet**. The existing manually seeded QA coupon/wallet belonging to another customer was untouched. Next: merchant must confirm WORK storefront customer account OTP delivery, that the Dashboard displays 30 points, and that the 10-point redemption prompt has the correct terms; only then test the real Yes-click, audit discount creation and wallet state, and verify the cart.

### WORK Customer Account QA entrypoint — full-page extension route

The native `https://jill-work.myshopify.com/account` page is **not** the Rewards dashboard. The canonical `extensions/jill-account-dashboard/shopify.extension.toml` uses `customer-account.page.render` (dedicated app page, `My JILL`), while `jill-account-coupons` is another full-page target and `jill-account-home` is a `customer-account.profile.block.render` block. Customer account full-page routes are accessed through the Shopify CLI extension preview or added explicitly as WORK account pages and optionally linked to the WORK customer-account menu in the Shopify checkout/accounts editor. The plain native account landing page can correctly show only Shopify Home, Orders, Profile.

An initial merchant screenshot of the native landing page said `Welcome, Lisseth`: this was the **existing manually seeded QA fixture account**, not the newly created isolated 30-point test customer. The correct sign-in test requires first logging out, logging back in with the authorized QA plus-address, verifying the identity, and opening the `jill-account-dashboard` WORK extension preview/page. Never instruct the merchant to click Redeem from the old fixture, re-seed it, or assume the full-page extension should render at `/account` without menu/page setup. If the WORK account page isn't in navigation, use `npm.cmd run rewards:work:preview` then Shopify extension Dev Console to launch its Web preview; alternatively add `My JILL` as a WORK-only app page through Settings → Checkout → Customize → Apps, and add to the WORK account menu. Do not modify LIVE customer account menus.

### WORK account page activation and QA entrypoint recovery (October 10, 2026)

The merchant confirmed sign-in to the **new QA customer** from the WORK Profile page, while the native account Home and Profile pages rendered and the separate **My JILL** full-page route showed Shopify's generic "There's a problem loading this page" error. Canonical navigation in `extensions/jill-account-home/src/AccountHome.jsx` uses the correct `extension:jill-account-dashboard/` protocol and `jill-account-dashboard` is a `customer-account.page.render` full-page extension, so **do not** replace its link with a guessed `/account/pages/{uuid}`. Shopify's account-page activation documentation and developer forum note that an unreleased/unregistered full-page extension can show this exact error while other pages and profile blocks load. Required WORK-only recovery: run interactive, guarded `npm.cmd run rewards:work:app:deploy` (it validates the WORK Client ID and config before `shopify app deploy --config work`), then in **WORK Shopify Admin** Settings → Checkout → Customize/Edit → Apps select **My JILL** → Add page to Accounts → Save; optionally Add to menu. Do not touch LIVE account customization or theme. If a Dev Console preview for the full-page extension with its `dev-` URL fails too, investigate extension runtime/console errors before claiming the page-registration theory is confirmed.

Additional QA findings: previous Profile block used a hard-coded `https://jillonlinestore.com` URL even when shown in WORK, risking navigation from WORK into LIVE. Replaced that with the single canonical `storefrontOrigin(shopify.shop)` helper, plus a regression guard. The QA customer's initial 30-point synthetic ledger was verified, but its `redeem_request_nonce` key had never been created; the dashboard's compareDigest-based request writer requires both nonce and points request metafields to exist. The missing QA nonce was initialized to `qa:ready` (not pending: request points remains zero), and Shopify returned its digest. This action created no discount and spent no points. First real redemption still requires WORK UI proof and after-state verification.

### WORK customer-account page runtime startup crash — code correction

Merchant screenshots after **JILL WORK Rewards app release** showed two new navigation entries (`My JILL`, `Coupons`) on WORK Accounts, but both pages returned Shopify's generic `There's a problem loading this page`. The built-in Orders and Profile pages loaded; the `JILL Settings` profile block previously shown on Profile was no longer visible after the latest release. This distinguishes page registration success from a common extension runtime startup failure.

Source-layer root-cause hypothesis supported by Shopify 2026-07 target API docs: all three extension modules initialized `const STORE = storefrontOrigin(shopify.shop)` at module top level, but Shopify's `Shop` target API is supported for **order-related targets only**, not `customer-account.page.render` or `customer-account.profile.block.render`. On unsupported targets `shopify.shop` may be undefined, and the central `storefrontOrigin` intentionally throws when identity cannot be established; module evaluation aborts before extension UI renders. This is consistent with BOTH full-page failures and the absent updated profile block. Runtime error logs have not yet been captured, so confirm with a successful WORK redeploy/preview.

Implemented a single canonical safe fix in `shared/rewards.mjs`: `loadCustomerAccountStorefront()` fetches `shop { url myshopifyDomain }` through the automatically authenticated Customer Account GraphQL endpoint, and `storefrontOrigin` now understands that API's `url` property. Both full pages and the profile block resolve asynchronously **after** rendering. They fail closed when the store identity isn't available: links aren't rendered or are disabled, with a visible warning in Dashboard/Coupons. No hardcoded production store fallback. Added source and executable regression tests for all three target modules, WORK/LIVE origins, and API failures. [CI for code fix](https://github.com/JILLOnline/JILL-WEB/actions/runs/38063455911) passed.

**Not yet deployed to JILL WORK Shopify app**; no Google Apps Script/backend change required, no new coupons generated, and no points spent. Next merchant action: `git pull --ff-only origin jill/rewards-work`, then `npm.cmd run rewards:work:app:deploy` (guarded WORK-only interactive release), refresh both account pages and Profile block, verify 30 QA points before any redemption. If pages still fail, inspect Shopify Dev Console extension runtime logs and authenticated Customer Account API responses before new changes. Do not redeploy the live theme or reset the healthy WORK Rewards worker.


### WORK v3 full-page failure — audit from app registration to runtime

**Symptom:** merchant successfully released `jill-work-rewards-3` with three UI extension bundles and published WORK menu links `My JILL` and `Coupons`. Both account pages still show Shopify's generic "There's a problem loading this page" error. Shopify-native Orders/Profile render. Do NOT repeat a release or touch LIVE as a troubleshooting shortcut.

**Read-only account/store verification:** Connected Admin GraphQL directly confirms `jill-work.myshopify.com` uses `NEW_CUSTOMER_ACCOUNTS`; `JILL WORK Rewards` is installed with all nine scopes `customer_read_customers,customer_read_orders,customer_write_customers,read_customers,read_discounts,read_orders,write_customers,write_discounts,write_orders`. Customer Account full-page target support is documented by Shopify for the existing `customer-account.page.render` target and `api_version=2026-07`. Manifest UIDs/handles are distinct and Shopify's releases successfully bundle all three. The WORK customer is authenticated and has zero orders. Its unchanged synthetic ledger is 30 earned/30 spendable/0 redeemed/zero coupons/zero pending redemption requests, with a populated nonce. SHOP promotion metafield is fresh (2026-10-10T15:32:42Z, one public offer). These facts rule out a missing QA balance, bad Shopify account mode, missing extension target registration, and backend redemption as the *immediate* blank-page cause.

**Source/import audit:** `jill-account-dashboard/src/Dashboard.jsx`, `jill-account-coupons/src/Coupons.jsx`, and `jill-account-home/src/AccountHome.jsx` each use documented `@shopify/ui-extensions/preact`, Preact render entrypoints, shared `rewards.mjs`, and no executable `shopify.shop` on generic account surfaces after v3. The new supported `Customer Account API shop {url myshopifyDomain}` lookup is initiated inside `useEffect` and guarded by `catch`; so an API rejection there **should not cause a fatal pre-render page error**. Other Customer Account/Storefront fetch errors in both full-page modules are also caught and should show a banner. Shopify Customer API 2026-07 publicly documents the shop fields. Thus another blind edit to this lookup has insufficient evidence.

**Open root cause:** The generic error is in Shopify's extension loading/worker execution or the render tree before first paint, but we **do not have the WORK browser worker exception, failed network asset, active remote extension response, or Shopify Dev Console trace**. This audit does not prove a single precise fault. Published CLI build success and CI source tests do **not** prove remote rendering. Collect at least the **first red Chrome DevTools Console error after refresh** on the failing full-page WORK URL (preserving the browser's existing session; redact secrets) and the exact sanitized URL/path. If Chrome Console has no relevant errors, test Shopify CLI Dev Console `jill-account-dashboard` and `jill-account-coupons` Web previews and collect worker/extension errors there, then inspect extension deployment version mapping. Hold all WORK releases until failure evidence identifies the owner. No Google backend redeploy, new coupons or ledger changes warranted by this UI defect.

**Post-render risks to audit separately:** Customer Account `metafieldsSet` write permissions/compareDigests, Storefront API public metafield visibility, full coupon issuance, discounts, Use Now cart transition, refund accounting, session persistence semantics, and the existing webhook query-secret authentication mode. The green Apps Script watchdog proves infrastructure freshness, not those end-to-end journeys.
