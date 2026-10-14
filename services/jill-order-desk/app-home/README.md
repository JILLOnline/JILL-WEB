# JILL WORK — Embedded Shopify Admin App Home (unreleased)

This is the **candidate replacement** for the existing fail-closed
`jill-order-desk-work` health Worker, using Shopify's official React Router
authentication SDK and Cloudflare's React Router Workers plugin.

**Do not run `wrangler deploy` or `shopify app deploy` here yet.**
The production-facing WORK merchant Worker remains the known-good, deny-only
runtime. The new host must pass independent dependency installation, Worker
bundle, session-storage compatibility, and authenticated Owner/other-staff
browser QA before the exact same hostname can be cut over.

## Source ownership

- `app/shopify.server.ts` owns official `shopifyApp` SDK initialization.
  It uses the existing JILL WORK client ID and `AppDistribution.SingleMerchant`,
  and requires online Shopify staff sessions.
- `../shopify-host/work-shopify-runtime.mjs` composes the SDK with encrypted
  D1 SessionStorage; the SDK handles OAuth and JWT authenticity.
- `../shopify-host/d1-session-storage.mjs` stores AES-GCM encrypted tokens
  in the isolated D1 `jill_shopify_sessions` table.
- `app/routes/app.tsx` sets the embedded Shopify App Bridge shell and
  authenticates every page load.
- `app/routes/app.index.tsx` performs a second explicit JILL Owner/staff
  grant check; it is read-only and returns setup/denial until the verified
  Owner is bootstrapped. It does not fetch requests or change money.
- `workers/app.ts` and `vite.config.ts` implement the Cloudflare
  React Router SSR entrypoint using the documented Cloudflare Vite plugin.

## Dependencies and preflight

```powershell
# From the repository root. Compile only; no Cloudflare/Shopify deployment.
npm.cmd run test:jill-app-home-scaffold
Push-Location .\services\jill-order-desk\app-home
npm.cmd install
npm.cmd run build
Pop-Location
```

GitHub WORK CI runs the same real framework build under Node 24.

**Important compatibility gate:** the Shopify React Router package currently
documents a Node adapter; Workers requires `nodejs_compat`. Successful
bundling is necessary but does not prove OAuth, session persistence, or
embedded iframe compatibility. The SDK must authenticate genuine WORK Admin
sessions in a controlled canary prior to URL updates.

## Future Shopify host cutover checklist (not yet authorized)

1. Preserve Worker version `9d83e689-9d7f-4496-b460-179d6cece4c2`
   and record current Git/Shopify extension versions.
2. Confirm new remote D1 migration `0002_shopify_sessions.sql` is pending
   (not already applied), then apply to **only** `jill-order-desk-work`.
3. Generate a new random 32-byte key locally; set Cloudflare secret
   `JILL_WORK_SESSION_KEY_B64` and Shopify app secret
   `SHOPIFY_API_SECRET` in the WORK merchant Worker. Never print or commit
   either secret.
4. Validate the SDK's installed Session serialization, Worker Node adapter
   runtime, OAuth redirects, Shopify CSP/App Bridge, and automated 401/403
   tests. A build alone does not satisfy this.
5. Only after canary acceptance: enable WORK `embedded=true`, set its
   `application_url` to the exact WORK hostname, configure legitimate
   auth redirect URLs, and release the WORK app version **without touching**
   LIVE. Retain the current customer-account extension UIDs and scopes.
6. Bind the real WORK Shopify account Owner through a separately confirmed
   staff-authenticated bootstrap action; do not enter an Owner ID manually.
7. Check Owner and unauthorized staff A/B, revocation, and return the merchant
   database to deny-only on any conflict.

There are intentionally no invoice, refund, fulfillment, or staff-grant
mutation routes in this host. The existing Google CustomOrderEvents writer
and Shopify commerce authority remain unchanged.

## Owner onboarding command — prepared, not activated

- `app/routes/app.setup-owner.tsx` and `../owner-bootstrap-route.mjs` implement an authenticated first-Owner setup route inside the embedded WORK application. Both GET and POST call Shopify's official `authenticate.admin(request)` before any staff or D1 decision. The body cannot set a shop, email or Owner ID.
- It requires `onlineAccessInfo.associated_user.account_owner === true`, the exact WORK shop, a server-only `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=true` flag, same-origin POST, and one explicit confirmation field. Attempts by nonowners, LIVE sessions, wrong origins, no-flag deployments or already-bound different Owners fail closed.
- Owner registration is idempotent for the existing Owner, never changes financial or production data, and creates one Owner authority binding plus one audit receipt using the existing transactional D1 adapter.
- The configuration flag must remain OFF until WORK Shopify login, SDK online session signatures, D1 persistence, OAuth redirect URLs and a rollback are fully certified. This source is not deployed, and its button cannot be used yet.
- Regression command: `npm.cmd run test:jill-work-owner-setup`. Do NOT manually insert Owner staff IDs or enable this flag through the existing public customer gateway.

## WORK canary build — preserves deployed deny-only Worker

A **separate planned** Worker name `jill-order-desk-canary-work` is declared
in `wrangler.canary.jsonc`. It shares only the existing WORK D1 database;
its server-only `JILL_WORK_HOST_STAGE=canary` flag pins Shopify's app URL
to the exact planned canary origin and owner bootstrapping is OFF. The
original `jill-order-desk-work` deployment and D1 schema stay untouched.

Build the canary using `JILL_BUILD_TARGET=canary` and `npm run build`
(CI does this alongside the normal build). This selects only the canary
Wrangler input. This is a **build gate, not deployment**. The canary hostname
must be independently confirmed from Wrangler when/if it is later deployed.

The Worker entrypoint's public `/healthz` proves all four D1 tables and
always reports `admin_ready:false`. Requests to other endpoints return
HTTP 503 until the separate Shopify API secret and 32-byte session key are
bound in the **canary Worker only**. It rejects incorrect Host origins.
No Owner ID can be supplied through request bodies or query strings.
A real Shopify login will require a controlled WORK app URL/embedding
update; a canary health check by itself cannot establish Shopify authentication.

CI test: `npm.cmd run test:jill-app-home-canary`. Neither source nor CI
provisions Cloudflare secrets, calls Shopify, or deploys to LIVE.

## Canary deployment receipt and read-only certification — 2026-10-14

- Merchant's Wrangler output confirmed `jill-order-desk-canary-work` deployed at `https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev`, version ID `b3a9ef0c-b6a5-4501-963d-36962630a00a`. The deployed binding is only the existing WORK D1; `JILL_WORK_HOST_STAGE=canary` and `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=false`.
- Merchant's remote migration output separately confirmed `0002_shopify_sessions.sql` applied successfully, with session count 0 and Owner count 0. Neither migration needs repeating.
- **Runtime still needs confirmation:** `npm.cmd run custom-orders:work:canary:remote:audit` sends exactly five anonymous GET requests. It expects 200 on `/healthz` (all four D1 tables) and 503 on `/`, `/app`, `/auth/login` and `/app/setup-owner` (no secrets/OAuth/Owner actions activated). This script is read-only and never sends a credential. Its deterministic offline contract test is `npm.cmd run test:work-canary-runtime-audit`.
- **Do not yet configure Shopify API secret or encryption key**, enable Owner setup, or switch the WORK Shopify application URL. The canary is infrastructure-only until runtime denial/health results are reviewed.

## Real Shopify SDK Session serialization gate (no customer sessions)

- Run from `services/jill-order-desk/app-home`: `npm.cmd run test:shopify-session-real`.
- This imports the **installed actual** Shopify `Session` class, generates an entirely synthetic online session, encrypts it with the same production storage adapter into an in-memory fake D1, restores the true Shopify Session instance, then validates the stored staff Owner ID and effective scopes with `requireWorkMerchantIdentity`.
- Requires no Shopify credentials, authorization, Cloudflare access or personal records; added to the real App Home GitHub build job before typecheck and bundling.
- If a new Shopify package version changes its Session serialization, **block credential provisioning** until the adapter passes this gate. Passing still does not certify Cloudflare OAuth or authorize Owner registration.

## Shopify real-SDK session restoration finding and remediation

- The first real package test caught a **fail-closed** incompatibility: `Session.fromPropertyArray(..., true)` preserved Shopify staff identity but omitted `onlineAccessInfo.associated_user_scope`. Our merchant policy correctly denied that restored session rather than incorrectly trusting the app's `session.scope`.
- The D1 adapter now uses a versioned authenticated encryption envelope (`version: 1`) containing the official Shopify property array **plus the original Shopify-provided effective user scope**. Restore explicitly applies that scope only after AES-GCM verification, WORK shop/session ID validation, and rehydration into a genuine Shopify `Session` instance. Missing scope on an online session fails closed.
- The real SDK test requires online staff Owner ID/effective scopes to survive restore, a missing staff scope to fail, offline sessions to round-trip, and the D1 rows to contain no plaintext staff information or token. **No real credentials have been stored**; this is pre-activation remediation.
