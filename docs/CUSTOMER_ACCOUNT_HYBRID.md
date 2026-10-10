# JILL Account Hub — Hybrid Customer Account architecture

Status: **approved architecture / implementation planned, not deployed** (2026-10-10). Working lane: `jill/rewards-work`. Account work is not equivalent to storefront theme work. No LIVE promotion or customer mutation is authorized by this document.

## Goal and boundary

JILL presents one coherent **My JILL** customer hub in Shopify **new customer accounts**. Shopify remains authoritative for login, logout, standard profile, addresses, order history, fulfillment links, cart, checkout and discounts applied at checkout. JILL presents Rewards, Coupons, Custom Requests, Celebrations and Saved Preferences through a single app-owned **full-page extension entrypoint** with internally modular screens. The separate, optional Shopify **Profile block** remains a distinct target because it is an integration into Shopify's native Profile page, not a second hub.

A **single extension entrypoint** does *not* imply one gigantic component or one Rewards backend. Domain-specific screens are internal components, not independently installed/published extension pages. Use Shopify supported navigation `extension://` / Navigation API to transition among internal routes; use `shopify:customer-account/...` only for supported native account pages. Preserve one registered My JILL route and UID across migration. Never invent a customer account `/pages/{id}` URL.

## Proposed customer experience and information architecture

**Native Shopify navigation** (outside our ownership): My JILL | Orders | Profile. The app can optionally expose a shortcut to My JILL from native Profile via the existing JILL Settings block. Retire the standalone Coupons navigation page **only after** its replacement in My JILL is proven and the existing menu entry is deliberately removed from WORK.

| Internal My JILL route | Primary job | Data owner | Initial release |
| --- | --- | --- | --- |
| `/` Overview | Greeting, points badge, next celebration, recent order/request, quick actions | aggregate of read-only account queries | shell / first |
| `/rewards` | balance, history/tiers, Yes/No redemption, progress, failure/retry, access to wallet | backend v13; Shopify customer metafields as delivery state | first transactional phase |
| `/coupons` | personal active/used/expired wallet separately from sanitized storewide offers | v13 customer wallet; public promotions mirror | same transactional phase |
| `/custom-orders` | request history, proof/status, repeat request, event/fulfillment info | Custom Order domain; **history data contract not yet certified** | next |
| `/celebrations` | upcoming dates, theme/colors, reminder consent | JILL customer preferences store; **definitions and edit contract not yet created** | next |
| `/saved` | favorite colors, themes, preferred fulfillment, saved request details | JILL preferences store; **definitions and edit contract not yet created** | next |
| `/settings` | JILL-specific consent, reminders/preferences and links to Shopify Profile/addresses | Shopify native for identity; JILL-specific preference contract | after preference contract |

Links out: **Shop JILL / Create Custom Order / Contact JILL** are storefront routes, not duplicate account modules. **Orders, Profile, addresses, authentication, logout** remain native Shopify. Order cards in Overview are small read-only summaries with deep links to native order views. No custom checkout, custom session store or shadow customer database.

### Layout contract (Shopify extension components, not raw storefront CSS)

Use Shopify's 2026-07 Preact `<s-page>`, `<s-stack>`, `<s-section>`, `<s-button>`, `<s-banner>` and platform-safe primitives; responsive behavior is controlled by Shopify account UI constraints. Don't copy JILL Theme Core CSS into an extension.

- **Persistent top:** JILL welcome, points snapshot, last refresh/error status, prominent account navigation (Overview, Rewards, Coupons, Custom Orders, Celebrations, Saved) with accessible keyboard/focus state.
- **Overview first screen:** points / active coupons / next celebration / active request, then recent orders and quick tasks; omit empty cards gracefully.
- **Rewards detail:** show available points and rules before redemption; confirmation Yes/No; instant non-duplicated pending state; backend-authoritative completion; `Use Now` only after coupon is verified in wallet.
- **Coupons detail:** two distinct groups, `For you` and `Storewide offers`; show minimum spend, expiry, nonstacking, used/revoked state and safe errors, no promotion leaks.
- **Custom-order detail:** request status and delivery/event timeline, links into *existing* storefront Custom Order form; never copy its validation or product-option engine.
- **Celebrations & saved details:** human-friendly summary + edit flows only after customer-specific storage and consent are defined. No speculative automated messages.

## Existing files: keep, extract, then retire

| Current path | Decision | Required action / guard |
| --- | --- | --- |
| `extensions/jill-account-dashboard/shopify.extension.toml` | **KEEP** | Sole full-page UID/handle `jill-account-dashboard`; preserve target `customer-account.page.render` |
| `extensions/jill-account-dashboard/src/Dashboard.jsx` | **KEEP PATH / REWRITE IN PLACE** | Becomes thin `<AccountHub />` entrypoint; remove copied page-specific queries, state and JSX only once migrated into owned modules |
| `extensions/jill-account-coupons/src/Coupons.jsx` and its TOML/package | **TEMPORARY COMPATIBILITY, THEN RETIRE** | Remain available while old page/menu links exist; migrate Coupons as an internal module; remove stale menu target first, then retire extension without UID reuse or ghost routing |
| `extensions/jill-account-home/src/AccountHome.jsx` + TOML/package | **KEEP** | Minimal Profile bridge/shortcut to My JILL; it must not recreate the hub, ledger, preferences store or account navigation logic |
| `shared/rewards.mjs` | **KEEP** | Pure, canonical Rewards tier/state/wallet helpers and discount link builder; move account GraphQL transport out during extraction, without parallel owners |
| `rewards.config.json` | **KEEP** | Sole Rewards policy/config |
| `backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs` | **KEEP WORK ENGINE** | v13 privileged points/order reconciliation, coupon integrity, webhook, idempotent command authority; no UI-driven rewrite during account migration |
| `backend/google-apps-script/JILL_Public_Promotions.gs` | **KEEP** | Sole sanitized storewide offer mirror, independently fresh and reconciled |
| `scripts/*rewards*.mjs`, `scripts/test-account-coupons.mjs` | **KEEP AND EXTEND** | Existing invariants and WORK guards; replace old route assertions only when parity has shipped |
| `shopify.app.work.toml` | **KEEP LOCAL, GITIGNORED** | Shopify CLI-linked WORK app configuration, not a generated or committed credential source |
| `.github/workflows/deploy-customer-account.yml` | **KEEP ISOLATED** | Manual LIVE gate stays manual; never point WORK source at LIVE app, and never auto-release UI based on source tests alone |

Do **not** create another installed full-page extension, another backend reward engine, a second Rewards math helper or another customer-account authentication layer.

## Target ownership and planned files (create only as implementation begins)

```text
extensions/
  jill-account-dashboard/               # EXISTING single full-page target/UID
    shopify.extension.toml                # KEEP
    src/
      Dashboard.jsx                       # entrypoint, then thin shell composition
      hub/AccountHub.jsx                  # create: lifecycle/nav/error boundaries
      hub/routes.mjs                      # create: sole internal route definitions
      ui/AccountPrimitives.jsx            # create: canonical safe JILL account primitives
      pages/Overview.jsx                  # create: read-only overview
      pages/Rewards.jsx                   # extract from Dashboard
      pages/Coupons.jsx                   # move from current Coupons extension
      pages/CustomOrders.jsx              # create after history contract
      pages/Celebrations.jsx              # create after storage contract
      pages/SavedPreferences.jsx          # create after storage contract
      pages/Settings.jsx                  # create for JILL-only settings
  jill-account-home/                      # EXISTING native Shopify Profile block
    src/AccountHome.jsx                   # retained minimalist shortcut
  jill-account-coupons/                   # EXISTING until migration verified; RETIRE later
shared/
  rewards.mjs                             # KEEP pure Rewards helper
  customer-account-api.mjs                # create: one authenticated Customer Account API transport
  storefront-origin.mjs                   # only create if genuinely shared across >=2 owners
contracts/
  customer-account-data.schema.json      # create when preferences/custom-order model is agreed
scripts/
  test-account-hub.mjs                    # create: shell/navigation/data isolation contracts
  test-account-hub-runtime.mjs            # create: smoke/canary in browser-backed WORK test
docs/
  CUSTOMER_ACCOUNT_HYBRID.md              # THIS document — canonical architecture/release plan
```

Prefer **`shared/customer-account-api.mjs`** as the one authenticated customer-account query/mutation transport; no redundant fetch clients per screen. Browser UI receives normalized states, not backend tokens. The future storefront-origin helper should be extracted from `shared/rewards.mjs` only when callers justify it; do not create files merely to mirror this drawing.

## Domain truth and APIs

| Data or action | Authoritative source | Browser access / behavior |
| --- | --- | --- |
| Identity, sign-in/out, addresses, Orders, checkout | Shopify new customer accounts | native pages/links; never duplicate |
| Points, earning, refund solvency, redeem/cancel, expiry, revocations | canonical Apps Script Rewards v13 + Shopify Admin | customer-account read state, CAS-protected `redeem_request_points` + `redeem_request_nonce` mutation; 25s non-destructive refresh; user never sets points directly |
| Wallet and customer-targeted code | Shopify discount source of truth, reconciled to `jill_rewards.coupons` | read-only wallet; backend creates codes; customer account never calls Admin API |
| Public promotions | `JILL_Public_Promotions.gs` → `jill_promotions.active_public_codes` Shop metafield | Storefront API public read; reject stale/malformed snapshot; exclude customer-targeted campaigns |
| Custom Order requests | existing form + backend, not the theme view | read-only status/history adapter **after** durable persisted request IDs, customer ownership, scope and signed-in merge rules are verified |
| Event reminders and saved preferences | customer-specific contract to be designed | consent/visibility/access to be established first, customer-specific read/write only, no unconsented reminders |
| Contact form / product configuration | existing storefront | link, don't clone flow |

**Sensitive boundary:** customer id comes from Shopify authenticated context, never user-entered or URL-selected; requests must validate ownership server-side. WORK app scopes are required but *not sufficient*: metafield definitions must also grant the exact Customer Account access. Avoid marketing consent by default; track separate consent for event reminders. No credentials, coupon HMAC, Shopify Admin token or Google Script Property in frontend/Git.

### Proposed JILL-owned customer data contracts — not yet created

These are **provisional schemas**, not existing Shopify definitions. First decide whether each feature is enabled and validate Shopify-supported Customer Account access and privacy before provisioning or implementing UI.

| Proposed field/record | Candidate type/authority | Customer permissions | Important constraint |
| --- | --- | --- | --- |
| `jill.saved_preferences` | Shopify Customer JSON metafield | Customer Account READ_WRITE after schema validation | Only non-secret theme, color, fulfillment and interest selections; input validation and size bounds; never duplicate rewards wallet |
| `jill.celebrations` | Shopify Customer JSON metafield, array of event ID/date/optional theme | Customer Account READ_WRITE after validation | Optional customer-entered dates; deletion/edit support and time zone rules; don't infer children's information |
| `jill.reminder_opt_in` | Shopify Customer boolean metafield | Customer Account READ_WRITE after consent design | Default false; not the same as marketing email consent; explicit purpose, frequency, revocation and audit |
| Custom-order history record | backend-owned list indexed by durable request ID and authenticated Shopify Customer ID | Backend read adapter exposes **only the requesting customer's** timeline | Existing Custom Order submission remains untouched; guest orders require separate verified claim/reconciliation; do not treat a title/email match as authorization |
| Customer Custom Order overview | small backend-authored projection / optional Customer READ metafield | Customer Account READ | Projection only for overview; primary request ledger stays with Custom Order backend |
| `jill_rewards.*` (7 existing fields) | existing Shopify Customer metafields and backend v13 | READ except two CAS request fields READ_WRITE | Verified existing definitions; do not change their access or shape for a new UI |

Request status vocabulary is proposed as `received → reviewing → proof_ready → approved → in_production → shipped/pickup_ready → completed`, with `cancelled/on_hold` exceptional states. This vocabulary must be reconciled with actual production Custom Order operations before coding it. Every customer history query needs server-side ownership checks, pagination, immutable request IDs, and bounded sanitized public-facing details; never expose internal supplier notes, unrelated customer files, or private upload credentials.

**Rollout order:** verify an authenticated read-only request-history query in WORK first; then enable custom-order page. Define saved-preference metafields and their Shopify Customer Account permissions next, validate read/write and deletion with a synthetic customer, and only then add celebrations/reminders. No scheduled reminder worker or marketing automation is implied by adding a preferences card.

### Coupons / cart: unresolved product contract

The existing native `/discount/{code}?redirect=/cart` URL can take customers to Shopify's cart but does **not establish** the user-requested “only until this browser session ends” lifetime. Do not promise session-only persistence until Shopify-supported cart/discount clearing behavior is demonstrated. Choose and record a supported native persistence policy or implement a separately audited explicit removal action. Login/session vs browser lifetime must be tested on WORK checkout. No custom session workaround as a default.

## Verified WORK facts — 2026-10-10

- Admin API connection identifies `jill-work.myshopify.com` and `NEW_CUSTOMER_ACCOUNTS`; login links visible. The independent `JILL WORK Rewards` app is installed with all **nine** required Admin/Customer Account scopes.
- Customer `jill_rewards` metafield definitions (7) are present: `points_balance`, `eligible_spend_cents`, `points_earned_lifetime`, `points_redeemed_lifetime`, `redeem_request_points`, `redeem_request_nonce`, `coupons`. Only the two redemption-request fields are `customerAccount: READ_WRITE`; all other Rewards fields are `READ`.
- Shop `jill_promotions.active_public_codes` definition is present and Storefront `PUBLIC_READ`.
- **Zero** defined `jill` Customer metafield definitions in WORK; custom-order saved-details/celebration card data cannot be certified from the current definition layer.
- Merchant-provided v13 WORK watchdog reported `ok:true`, 6/6 subscriptions, 1 sweep trigger, 1 promotions trigger and fresh sweeps; the most recent independent connected WORK Admin query found the synthetic QA ledger intact at 30 points, zero redeemed, zero wallet coupons, zero pending request and no purchases. This is **not** proof of end-to-end redemption.
- Shopify CLI confirmed **`jill-work-rewards-3`** released all three existing UI extension bundles and the native account navigation shows My JILL + Coupons. Both full-page routes fail at runtime with Shopify's generic error. Do not claim runtime fixed from compilation. First console/worker exception is not yet available.
- KEEP is currently a **Git comparison branch**, `jill/rewards-keep`; it has **no separately verified Shopify store/app/deployment**. LIVE is a distinct production Shopify app and store. A true three-environment pipeline requires an intentionally provisioned and verified KEEP target or must remain two-stage WORK → explicitly approved LIVE with source baseline preserved.

## Delivery plan and proof gates

**Gate 0 — freeze and capture.** Preserve current working Rewards backend and protected test customer. Snapshot WORK extension UID/handles, app install, metafield access, Shopify account nav, backend SHA/watchdog. Obtain the failing full-page Chrome DevTools *first error and network trace*; if unavailable, instrument a minimal Shopify-documented canary in the existing My JILL target via **WORK dev preview only**. Do not create a new UID or publish LIVE. Decide whether the fault is worker/bundle delivery, module evaluation, render tree, or API. Fix the identified owner. An empty canary failing means fix app delivery, not Rewards.

**Gate 1 — certified hub shell.** Existing My JILL target renders heading + native account links reliably on WORK (signed out/in; QA customer; hard reload; 390/768/1440 widths). Add one navigation/router owner and account-wide error/loading boundary. Profile block remains a shortcut. No privileged writes.

**Gate 2 — authenticated data adapter.** Normalize read-only Customer Account API identity, Customer Rewards metafields, public promotions and recent Orders. Individually report unavailable vs empty and staleness; no one failed panel may take down the whole shell. Verify schema permissions and real API responses from WORK. Add actual browser smoke tests, not only source/compilation tests.

**Gate 3 — transactional Rewards + Coupons.** Extract existing Dashboard Rewards and Coupons module into the hub, preserve state machine and source-of-truth; ensure old extension stays temporarily available. Prove No/Yes, idempotent nonce, 30→20 point transition, exactly one $5/30-day customer-targeted discount, wallet and Coupons after refresh, exact checkout threshold/nonstacking, duplicate/concurrent/errors/refunds, and accepted cart behavior. Do NOT spend points until the shell and QA account are verified.

**Gate 4 — custom-order history and saved context.** Agree on persisted request timeline keyed to authenticated customer, mixed signed-in/guest requests, statuses and upload visibility. Then provision definitions/backend read contracts. Add Custom Orders, Celebrations, Saved Preferences and JILL Settings behind feature readiness; don't render aspirational fields as real data.

**Gate 5 — housekeeping and migration.** Remove `jill-account-coupons` *only after* parity, Shopify WORK menu cleanup and route/link migration. Keep the distinct Profile block if useful. Remove obsolete imports/old query owners/tests in touched paths; no ghost pages, duplicated state machines or temporary fallback URLs. Validate account navigation, accessibility, privacy, failure states, refresh and desktop/mobile.

**Gate 6 — release governance.** Versioned release manifest includes commit SHA, extension UIDs, app/store targets, backend SHA, 7 Rewards metafield definitions, promotion read exposure, screenshots and smoke/test evidence. WORK → KEEP only if independently provisioned and verified; otherwise KEEP Git baseline is archival only. LIVE requires explicit approval and independent credentials; no automatic LIVE deployment from WORK. Rollback restores prior known-good app release and preserves backend ledger; never reset points as a UI rollback.

### Required QA matrix

1. Signed out and authenticated QA, full-page cold start, reload and menu-to-module navigation.
2. Missing network, denied Customer Account API, partial metafield definitions, stale/empty promotions, zero orders/requests, invalid wallet JSON.
3. Rewards no-click, Yes-click, double-click, stale digest, worker delay/failure, wallet reconcile, expiration/revocation, partial writes and refund accounting.
4. WORK-only checkout with qualifying and sub-minimum baskets, stacking rules and discount persistence across tab/window/session changes.
5. 390px / 768px / 1440px, keyboard, screen readers, focus restoration, pending feedback, loading shift and regional EN/ES (FR when ready).
6. Confirm Shopify and Google source-layer state after each simulation; CI green at the *exact deployed SHA*, not just at branch HEAD.

## Immediate next implementation step

**Do not move Rewards files yet.** First isolate the WORK full-page loading failure with runtime stack/worker evidence, or a single minimal-shell dev-preview canary within the existing My JILL UID. When that shell renders, create `hub/AccountHub.jsx`, `hub/routes.mjs`, `shared/customer-account-api.mjs`, and tests as **replacement owners**, extracting one section per validated commit. Avoid adding empty placeholder files before their behavior exists.

Detailed behavioral contracts remain in `docs/FEATURE_CONTRACTS.md`; domain ownership in `docs/DOMAIN_OWNERSHIP.md`; decision rationale in `docs/DECISIONS.md`; proof in `docs/QA_CERTIFICATION.md`; backend v13 semantics in `backend/google-apps-script/REWARDS_ENGINE_V13.md`.
