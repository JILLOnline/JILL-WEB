# JILL Order Desk — WORK merchant host integration

Status: dedicated WORK database migrated and isolated Worker deployed with D1 binding; real remote health response and Shopify Admin authentication still require certification; no staff/Owner assignments.

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

The service's `wrangler.toml` now binds ONLY that D1 database as `JILL_ORDER_DESK_WORK_DB`. The isolated Worker was deployed and verified by the merchant's Wrangler receipt. Its health route returns HTTP 200 **only if the bound D1 database contains all three required merchant tables**; otherwise HTTP 503. Every merchant route returns HTTP 503, and `admin_ready:false` is always reported. There is no authenticated merchant endpoint yet.

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

**Do not reapply the migration**, manually bootstrap Owner, or expose merchant endpoints. The next infrastructure step is a safe, *separate* WORK Worker deploy that can verify D1 health while returning 503 on all merchant routes. A real merchant UI still requires a Shopify-authenticated App Home host and owner registration. The WORK Worker has since been deployed; its actual health must be checked before labeling the remote D1 runtime ready.

For a read-only follow-up after deploying this separate Worker:

```powershell
curl.exe -sS -i --max-time 20 "https://jill-order-desk-work.<YOUR-CLOUDFLARE-WORKERS-SUBDOMAIN>.workers.dev/healthz"
```

The actual endpoint must be taken from Wrangler's deployment output. Do not invent or guess the Workers subdomain or publish anything on LIVE.



## Isolated merchant Worker deployment — 2026-10-14

- Merchant's successful Wrangler deployment for `jill-order-desk-work` used only the dedicated WORK D1 binding `JILL_ORDER_DESK_WORK_DB`, not the public Custom Order gateway.
- Wrangler returned the exact URL `https://jill-order-desk-work.jill-work-custom-orders.workers.dev` and Worker version ID `9d83e689-9d7f-4496-b460-179d6cece4c2`.
- No Shopify app URL, Shopify installation, staff/Owner record, Rewards service, invoice or Customer Order event changed.
- To certify remote infrastructure, run from repository root: `npm.cmd run custom-orders:work:merchant:remote:audit`. This command sends only four **GET** requests to that exact WORK hostname, with **no Authorization or cookies**, and checks D1-backed `/healthz` HTTP 200 plus fail-closed merchant routes HTTP 503. Nothing can be created or modified by it.
- Deterministic contract unit test: `npm.cmd run test:work-merchant-runtime-audit`, included in standard CI/postinstall without making network requests.
- Do not call the Admin host operational until the real Shopify SDK-authenticated online staff session is integrated, real owner is bootstrapped, and customer/staff A-B denials are confirmed.

## Shopify online-staff host handoff source — 2026-10-14

- `shopify-host/sdk-config.mjs` is a pinned WORK-only configuration factory for Shopify's **official** `@shopify/shopify-app-react-router/server` `shopifyApp` function. It requires a real runtime client secret (never commit it), durable Shopify session storage and exact WORK App Home URL. It sets `useOnlineTokens:true` and expiring offline tokens; it does NOT implement OAuth or verify arbitrary ID tokens itself.
- `shopify-host/app-home-route.mjs` takes the **trusted** `authenticate.admin(request)` from that Shopify SDK and invokes the existing canonical `admin-home.mjs` authorization gate against the WORK D1 binding. No privileged route or merchant API is enabled by this handoff.
- Test: `npm.cmd run test:jill-shopify-host-wiring` verifies pinned WORK client/origin, required online sessions, rejects incomplete config, preserves Shopify login redirects and checks Owner/failed-D1/foreign-shop paths. The test uses synthetic sessions and does NOT constitute a Shopify runtime login.
- **Still missing:** an actually built and hosted Shopify React Router application, Shopify SDK session storage (separate from JILL roles; access tokens must remain server-only), secure Shopify app secret binding, official SDK runtime registration, asset/iframe rendering, a WORK-only app config approval, and explicit Owner registration. Do not change `shopify.app.work.toml` merely because this factory exists.
- Planned hosted origin is the already isolated Worker URL `https://jill-order-desk-work.jill-work-custom-orders.workers.dev`; currently that Worker is deliberately fail-closed. Migrating it to an SDK host needs a separately tested replacement and rollback, not an inline tweak to the live fail-closed deployment.

## Shopify SDK session storage — source added 2026-10-14

- Prepared `migrations/0002_shopify_sessions.sql` for a **separate encrypted Shopify SDK session table** in the already-existing isolated WORK D1. This migration is NOT applied yet. No tokens have been captured or stored.
- `shopify-host/d1-session-storage.mjs` implements Shopify's five SessionStorage methods. Token+staff session payloads are AES-256-GCM encrypted with a dedicated, secret 32-byte `JILL_WORK_SESSION_KEY_B64`. Nonces are randomly generated, authenticated data binds each ciphertext to the immutable session ID and WORK shop. Staff grants stay in `jill_merchant_grants`, not in the encrypted session table.
- Always instantiate this adapter with the actual `Session` class supplied by the installed Shopify SDK; it needs `Session.toPropertyArray(true)` and `Session.fromPropertyArray(..., true)` to preserve authenticated staff metadata. If the chosen SDK version's serialization differs, DO NOT proceed until its actual session round-trip is certified.
- Online tokens must expire; encrypted offline SDK sessions may be retained only within approved Shopify/session security requirements. Rotate the encryption key via a reviewed re-encryption strategy, not by overwriting the secret without session migration.
- Independent source test `npm.cmd run test:jill-shopify-d1-sessions` checks ciphertext round trips, nonce tampering, different-row substitution, expiry, deletions and LIVE-shop rejection. No real Shopify credentials are used.
- **Do not run the migration yet:** certify the real SDK adapter and its Workers runtime bundling first, then apply remote `0002` to `jill-order-desk-work` only. Provision the secret through Wrangler after validating host runtime; never write it into Git, `.env` screenshots, CLI output or Google.

## Candidate embedded Admin App Home — source compilation gate

- The real React Router + Cloudflare Vite + Shopify SDK app is now under `services/jill-order-desk/app-home/`. It has authenticated `/app`, `/auth/login`, and OAuth-catchall routing, an embedded Shopify App Bridge shell, plus a deny-by-default Owner/staff landing screen.
- This is a **candidate WORK replacement**, not the deployed Worker. Do not modify `shopify.app.work.toml`, public Cloudflare bindings, app scopes, or LIVE while source builds and a real online staff session remain unverified. It uses its own package dependencies and GitHub CI build job.
- See `app-home/README.md` for the complete compilation, secure session secret and Worker cutover gates. Never deploy it on top of the healthy fail-closed Worker before a rollout manifest and rollback are recorded.
