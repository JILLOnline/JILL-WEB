# JILL Customer Account extensions — WORK migration runbook

**Source of truth:** [Customer Account Hybrid Architecture](../docs/CUSTOMER_ACCOUNT_HYBRID.md). Behavioral contracts: [Feature Contracts](../docs/FEATURE_CONTRACTS.md). Owner registry: [Domain Ownership](../docs/DOMAIN_OWNERSHIP.md). Do not maintain another feature contract here.

## Current state

- `jill-account-dashboard/`: existing **My JILL** full-page extension, planned permanent single hub entrypoint.
- `jill-account-coupons/`: existing **Coupons** full-page extension. This is a **temporary compatibility page** until a working internal hub Coupons route is certified. Do not remove its Shopify account menu target prematurely.
- `jill-account-home/`: existing **JILL Settings** native Shopify Profile block. Retain as a small My JILL shortcut, not another dashboard.

All three are source-backed in `JILLOnline/JILL-WEB`; published extension UIDs are preserved. WORK v3 is released but My JILL and Coupons still return a generic Shopify runtime loading error. **A successful build or deploy is not evidence of successful page render.**

## Non-mutating checks

From repo root:

```powershell
npm.cmd run check:account-hub
npm.cmd run check:rewards
npm.cmd run test:rewards
npm.cmd run test:rewards-redemption
npm.cmd run test:account-coupons
```

### Diagnostic fix — React runtime resolution in throwaway canary (2026-10-10)

The first `rewards:work:hub:canary` attempt aborted during bundling with
`Could not resolve "react/jsx-runtime"` for all three diagnostic extensions.
**Cause confirmed:** the canary project copied each manifest and `package.json`
but omitted each extension's canonical `tsconfig.json`. Shopify's default
JSX transform then looked for React, even though all extensions use Preact.

The generator now validates and copies all three source `tsconfig.json`
files with `jsx="react-jsx"` and `jsxImportSource="preact"`. The canary test
enforces this ownership. **Do not install React**; that would mask a
misconfigured diagnostic. The original extension source and active v3 WORK
release have not changed. This fix only unblocks the isolation test: it does
not explain the pre-existing My JILL/Coupons release-time page errors.

After `q` stops the aborted CLI preview, pull the updated branch and run
`npm.cmd run rewards:work:hub:canary` again. Expect all three bundles to
compile without `react/jsx-runtime`. Only then open the Dev Console Web preview.

### First: isolate the failing page without changing released WORK code

Both the minimalist Shopify-style canary and the actual data-free My JILL hub shell
use the same existing Shopify WORK app and extension UIDs in an **ignored
`.work-account-canary/` project**. No source file in `extensions/` is overwritten.
The canonical Dashboard, Coupons and Profile code remains intact.

With an existing locally linked WORK app and installed dependencies, run:

```powershell
npm.cmd run rewards:work:hub:canary
```

The script verifies `shopify.app.work.toml` identity, creates the throwaway
project, and opens Shopify's WORK-only app dev session from that path.
In Shopify's Dev Console open the **My JILL** and **Coupons Web previews**.
Expected texts are `JILL WORK My JILL full-page extension rendered.` and
`JILL WORK Coupons full-page extension rendered.`. JILL Settings should show
`JILL WORK Profile extension rendered.` in its Profile preview.

**Decision A:** If *both* minimal pages still show Shopify's generic error,
do NOT edit Rewards or its GraphQL queries. Inspect the Shopify Dev Console,
Chrome Console first red exception and Network failed requests; investigate
app worker/asset delivery, installation/version mapping and page host behavior.
Stop with `q`, and run the Shopify CLI `app dev clean` command if a preview
remains attached. No app release is needed.

**Decision B:** If the minimal pages render, stop with `q`, then run:

```powershell
npm.cmd run rewards:work:hub:preview
```

Open **My JILL Web preview**. The new real `AccountHub.jsx` must display
**Welcome to My JILL**, with no customer/API calls. Coupons remains minimal.
If minimal renders but hub fails, isolate the `AccountHub.jsx` composition.
If hub renders, phase-zero startup is proven: the merchant confirmed this
in WORK on 2026-10-10. The connected data layer is now available as a THIRD
isolated preview mode (still no published app release or backend changes).

```powershell
# Stop the existing Shopify CLI dev session with q before running:
npm.cmd run rewards:work:hub:read
```

Open **My JILL → Web preview** as the signed-in, separate WORK QA customer.
The preview should retain the same Hub shell and show the authenticated
customer name, `Available Rewards points: 30`, `Lifetime earned: 30`,
and `Lifetime redeemed: 0`. Reward requests and checkout links are disabled.
A different customer's balance must *not* be presented as the QA fixture.

If values are unavailable, the interface says **Unavailable**, never 0. If
the Customer Account API rejects the query, a contained error appears while
the Hub shell stays visible. Capture the first actual Console/API error;
do not seed credits, loosen metafield definitions, or install another app.
A successful browser read is required before integrating redemption controls.
Only then migrate the tested entrypoint and read adapter into the canonical
Dashboard incrementally. Capture preview and backend snapshots.

The command is **`shopify app dev --path .work-account-canary`**, not
`shopify app deploy`. A Dev Console preview **does not certify the active
released pages**, and the WORK app's active version is not promoted. No 
customer points, coupons or the Apps Script worker are changed.

### Full My JILL hybrid template preview (all seven sections)

The authenticated WORK QA read preview rendered successfully: customer name, 30
available points, 30 earned and 0 redeemed, as independently confirmed by
Shopify Admin and the merchant screenshot. That proves the **read-only account
boundary**; it does not yet certify coupon issuance, Use Now or custom-order
history.

The next isolated preview uses the same My JILL extension UID and the
validated signed-in account query, but composes the **complete seven-screen
template**:

```powershell
# Stop the previous dev preview with q first:
git pull --ff-only origin jill/rewards-work
npm.cmd run rewards:work:hub:template
```

In Shopify's Dev Console, open **My JILL → Web preview**. Click each internal
tab: Overview, Rewards, Coupons, Custom Orders, Celebrations, Saved for You and
JILL Settings. Check small/mobile and desktop layouts, including the native
Shopify Orders/Profile links and browser back navigation.

- Overview and Rewards use **real, authenticated** QA customer Rewards data.
- Rewards options read their terms from existing `shared/rewards.mjs`;
  redemption controls stay disabled. Do not redeem.
- Coupons distinguishes its unavailable personal wallet/public-offer adapter
  from a verified empty coupon list; no `Use Now` action is offered.
- Custom Orders, Celebrations and Saved for You show explicit connection
  pending states, because customer-owned backend records/metafield definitions
  are not yet certified. They do not create, edit, send or reveal customer data.
- JILL Settings links only to Shopify's authenticated native Profile and
  in-hub preference section; no independent password/identity implementation.
- All seven screen modules, single route registry and canonical Rewards rules
  are copied into **`.work-account-canary/`**. The original released
  `Dashboard.jsx`, standalone Coupons page and Profile block are unchanged.

Source regression suite: `npm.cmd run test:account-hub-template`. Passing
GitHub CI proves source/test contracts, **not** that the app is responsive in
the actual Shopify browser. Capture a screenshot of the navigation and every
page before we connect any additional backend domain or release the app.
Never run `shopify app deploy` from this throwaway preview directory.

### WORK read-only Coupons integration (no redemption)

The approved My JILL seven-section layout now has **two real, independent,
read-only Coupons feeds** inside its internal Coupons tab:

1. Authenticated Shopify Customer Account API read of the signed-in customer's
   `jill_rewards.coupons` wallet, with strict JSON/status/date validation and
   the existing canonical Rewards status helper. No customer ID is supplied
   from UI inputs and no customer writes occur.
2. Shopify Storefront API read of sanitized
   `jill_promotions.active_public_codes` (version 1) with a **10-minute**
   freshness requirement. Personal and public reads have separate loading,
   error and empty states. One failing must not conceal the other's data.

On independent WORK Admin read, the synthetic QA customer had `coupons=[]`
and the public snapshot contained a **FREESHIPPING2026** free-shipping offer.
This is source data verification, **not** proof the customer-account extension
read works in the browser. Both GraphQL queries were separately validated
against Shopify's 2026-07 **customer** and **storefront** schemas.

Preview this through the unchanged, WORK-only command:

```powershell
npm.cmd run rewards:work:hub:template
```

Navigate to **Coupons**. The expected signed-in QA result is **no personal
Rewards coupons yet** and the real public free-shipping offer, provided the
promotion snapshot is still fresh. If either source fails, the corresponding
panel shows a recoverable error rather than inventing an empty result.
Do not redeem points, generate coupons or click Use Now at this stage:
**there is no redeem or Use Now button in this read-only template**.
Capture the complete browser view and any first Shopify Dev Console errors
before starting the later backend transaction phase.

Regression test: `npm.cmd run test:customer-coupons`.
The original published WORK extensions, Apps Script worker and LIVE are
intentionally unchanged. This module will replace the standalone Coupons
page only *after* WORK account integration and release parity is certified.

Shopify WORK normal local preview (original code, no LIVE changes):

```powershell
npm.cmd run rewards:work:preview
```

Inspect the Shopify Dev Console's **My JILL Web preview** and the browser console/worker logs. Save the first actual exception and the sanitized failed request. If there is no useful exception, run a minimal Shopify-documented page canary **inside the existing My JILL UID** using WORK dev preview (not LIVE and not as an added extension). The full repair decision tree is in the architecture document.

## Controlled WORK-only release

Only after a passing WORK browser preview and an explicit review of the diff:

```powershell
git pull --ff-only origin jill/rewards-work
npm.cmd run rewards:work:app:deploy
```

This command verifies the CLI-linked `shopify.app.work.toml` identity and targets the separate WORK app. Shopify prompts for an interactive release. Never bypass review or use `npm run deploy` / an unqualified CLI command for WORK. No extension deploy should imply a Google backend update; the live Rewards worker is separate and must remain unchanged during UI diagnosis.

**Do not redeem test points until** the account shell, authenticated Rewards read, correct customer and 30-point QA ledger are visible. Never put account secrets, scripts properties, customer emails or tokens into this repo. LIVE needs separate approval and certification.
