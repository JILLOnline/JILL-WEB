# JILL Order Desk — WORK merchant host integration

Status: dedicated Cloudflare WORK database provisioned and schema migration 0001 verified remotely; no Shopify App Home, staff/owner assignments or Worker deployed.

This folder deliberately has **no public admin HTTP endpoint**. The current
WORK repository currently ships three Customer Account UI extensions and
no verified hosted App Home implementation (October 14, 2026). Shopify CLI
reports "Update URLs: Not yet configured"; this refers to development URL
updates and **does not by itself prove that application_url is absent**.
Inspect the local gitignored \`shopify.app.work.toml\` before altering URLs.
Preserve extension UIDs, app ID and existing Rewards/data boundaries.

## Source pieces (built)

- \`../backend/jill-merchant-auth.mjs\`: strict Shopify WORK online staff
  session adaptor. It does **not** authenticate a request by itself.
- \`../backend/jill-merchant-policy.mjs\`: one operation/role policy; merchant
  writes intentionally disabled pending later phases.
- \`merchant-access.mjs\`: prepared D1 authority lookup and explicit
  owner-bootstrap command; no HTTP router and no actual database.
- \`admin-home.mjs\`: server-only read-only landing loader, requiring
  the official \`authenticate.admin(request)\` contract before D1 access.
- \`migrations/0001_staff_authority.sql\`: isolated WORK database schema; NOT applied.
- \`wrangler.toml\`: exclusive WORK merchant D1 binding and reserved service name.
- \`worker.mjs\`: fail-closed entrypoint; only a public health indicator, every merchant route returns HTTP 503 until real Shopify authentication is connected.

## Required Shopify host (not yet configured)

Use the existing **JILL WORK Rewards app** identity
\`f8e1ebdbae84490dc8ea5b133637e6c0\` and
\`jill-work.myshopify.com\`. Do not run \`shopify app init\` in the repository
to create a second app. Use an official Shopify React Router scaffold as the
implementation reference for a new hosted App Home, with
\`@shopify/shopify-app-react-router\` and \`useOnlineTokens:true\`. Shopify
session storage, OAuth callback handling, and App Bridge must be provided
by that official host. The actual loader must invoke \`authenticate.admin\`
before calling this source adapter.

Pseudo-integration contract (NOT a deployed route):

\`\`\`js
import {loadJillOrderDeskHome} from '../../merchant/admin-home.mjs';
import {authenticate} from '../shopify.server';

// React Router loader on the authenticated APP HOME origin, after host setup.
const result = await loadJillOrderDeskHome({
  request, authenticate, db: env.JILL_ORDER_DESK_WORK_DB,
});
return Response.json(result.model, {
  status:result.status,headers:result.headers,
});
\`\`\`

The host's app configuration will ultimately need an exact WORK HTTPS
\`application_url\`, \`embedded=true\` and validated auth redirect URLs. The
user controls the required Shopify/Cloudflare authorizations. Until those
are established, do not set arbitrary URLs or deploy/release an app version.
A working React Router host and real authenticated staff session are
prerequisites to an actual merchant UI.

## Runtime gates before calling it operational

1. Verify WORK-only public Client ID, WORK shop, exact app version and current
   installed scopes; do not invoke the LIVE Shopify connector.
2. Deploy a supported Shopify React Router App Home host using the official
   auth/session SDK, with online tokens enabled. Keep WORK-only app URL.
3. Provision one isolated D1 database and apply migration after explicit
   permission. Never use an existing customer/Rewards database.
4. From the **genuine WORK store owner session**, explicitly bootstrap Owner.
   No emails, manually typed staff IDs, or guesswork; role writes disabled.
5. Test Owner -> 200, non-owner/no-grant -> 403, offline session -> 401, D1
   disconnected -> 503 and LIVE shop -> 401. Inspect zero customer data leaks.
6. Unlock the read-only merchant inbox only after a scoped, audited Google
   merchant reader exists (P2). Production statuses and drafts still disabled.
7. Stage WORK app changes and verify existing customer extensions/Rewards
   remain unaffected. Do not publish to LIVE without separate authorization.

## Independent source checks

\`npm.cmd run test:jill-order-desk-home\`

No Shopify SDK, D1 or Google secrets are required for this source test.

## Cloudflare database provisioning — October 14, 2026

The merchant created a NEW Cloudflare D1 database using `wrangler d1 create jill-order-desk-work --location enam`; its immutable database ID is `3f17c186-c794-4e00-8f20-017191373a19`. `d1 list` showed 0 user tables immediately after provisioning. The database is not Shopify LIVE and is not bound to `services/custom-order-cloudflare`.

The service's `wrangler.toml` now binds ONLY that D1 database as `JILL_ORDER_DESK_WORK_DB`. The Worker is intentionally not deployed. Its health route returns HTTP 200 **only if the bound D1 database contains all three required merchant tables**; otherwise HTTP 503. Every merchant route returns HTTP 503, and `admin_ready:false` is always reported. There is no authenticated merchant endpoint yet.

From the repository root, prepare using the existing local Wrangler installation:

```powershell
git pull --ff-only origin jill/rewards-work
npm.cmd run test:jill-order-desk-work-config
Push-Location .\services\custom-order-cloudflare
npx.cmd wrangler d1 migrations list jill-order-desk-work --remote --config ..\jill-order-desk\wrangler.toml
# After confirming that 0001_staff_authority.sql is the only unapplied migration:
npx.cmd wrangler d1 migrations apply jill-order-desk-work --remote --config ..\jill-order-desk\wrangler.toml
npx.cmd wrangler d1 execute jill-order-desk-work --remote --config ..\jill-order-desk\wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'jill_merchant_%' ORDER BY name;"
npx.cmd wrangler d1 execute jill-order-desk-work --remote --config ..\jill-order-desk\wrangler.toml --command "SELECT COUNT(*) AS owners FROM jill_merchant_authority;"
Pop-Location
```

Cloudflare's versioned `d1 migrations apply` records `0001_staff_authority.sql` and takes a backup; don't substitute an untracked one-off `d1 execute --file` call for normal migrations. No owner row should exist after schema creation (expected count: 0). Apply only to `jill-order-desk-work` with `--remote` and the merchant service's explicit config. Do not deploy the Worker, add this binding to the existing public gateway, or manually insert owner/staff records. Owner binding requires a future authentic Shopify WORK account-owner session.


## Verified remote migration receipt — 2026-10-14

Merchant-supplied Wrangler output confirms the migration was **applied remotely** to the dedicated D1 database `jill-order-desk-work` (ID `3f17c186-c794-4e00-8f20-017191373a19`):

- `0001_staff_authority.sql`: success, six SQL commands executed
- `jill_merchant_audit`: present
- `jill_merchant_authority`: present
- `jill_merchant_grants`: present
- `SELECT COUNT(*) AS owners FROM jill_merchant_authority`: **0**, correct initial state
- No Shopify Admin session authenticated, no Owner inserted, no grants activated, no merchant Worker deployed, no Shopify app URL changed and no customer-facing gateway changed.

**Do not reapply the migration**, manually bootstrap Owner, or expose merchant endpoints. The next infrastructure step is a safe, *separate* WORK Worker deploy that can verify D1 health while returning 503 on all merchant routes. A real merchant UI still requires a Shopify-authenticated App Home host and owner registration.

For a read-only follow-up after deploying this separate Worker:

```powershell
curl.exe -sS -i --max-time 20 "https://jill-order-desk-work.<YOUR-CLOUDFLARE-WORKERS-SUBDOMAIN>.workers.dev/healthz"
```

The actual endpoint must be taken from Wrangler's deployment output. Do not invent or guess the Workers subdomain or publish anything on LIVE.

