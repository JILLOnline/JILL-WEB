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
If hub renders, phase-zero startup is proven: next move its tested entrypoint
into the canonical Dashboard and introduce the authenticated read adapter
before Rewards or Coupons writes. Capture screenshots and exact preview result.

The command is **`shopify app dev --path .work-account-canary`**, not
`shopify app deploy`. A Dev Console preview **does not certify the active
released pages**, and the WORK app's active version is not promoted. No 
customer points, coupons or the Apps Script worker are changed.

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
