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

### WORK Google project bootstrap — prepared, not executed

The first local Google Apps Script setup is consolidated into `npm run rewards:work:backend:bootstrap` (on Windows: `npm.cmd run rewards:work:backend:bootstrap`). Prerequisite: authenticated developer checkout of branch `jill/rewards-work`, locally linked `shopify.app.work.toml` pointing to Client ID `f8e1ebdbae84490dc8ea5b133637e6c0`, and Google's Apps Script API enabled in the Google account.

This command rebuilds the existing canonical engine into ignored `.work-backend/`, validates the Shopify WORK identity, requests a **separate interactive Google clasp authorization** if needed, creates `JILL WORK Rewards Engine` in Google Apps Script when no recorded WORK project exists, pins its Script ID to ignored local metadata, refuses a mismatched/replaced Script ID, rejects unexpected code files, uploads the two canonical JILL sources, and leaves any production Apps Script project untouched. Source build includes a Google web-app manifest with `ANYONE_ANONYMOUS` ingress executed as the deploying user: this is necessary to receive Shopify server-to-server webhooks; topic-scoped request authentication and WORK-only ingress restrictions remain mandatory. The bootstrap explicitly **does not deploy** a public web app, register webhooks, or start the sweep.

The Google owner must then, in that independently created WORK project only, configure WORK-scoped Script Properties without disclosing secret values in chat, authorize Google execution, deploy a distinct `/exec` web app, and validate health before running `setupJillRewards()`. No new Google project or running worker exists until the owner actually completes this authorization. Do not confuse successful GitHub tests or local source upload with a running webhook endpoint.

On October 9, 2026, the WORK store additionally received a `SHOP` metafield definition `jill_promotions.active_public_codes` with storefront `PUBLIC_READ`. There is intentionally no made-up fresh promotion snapshot; the WORK backend must perform the real source scan and write it on first successful sync.
