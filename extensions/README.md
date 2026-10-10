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

Shopify WORK local preview (no LIVE changes):

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
