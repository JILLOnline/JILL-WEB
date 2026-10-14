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

## Canaries cannot auto-open login when secrets are provisioned

- WORK and canary configs now both declare `JILL_WORK_OAUTH_ENABLED=false` by default, separate from `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=false`. The Worker refuses `/app`, `/auth/*` and Owner setup unless its stage-pinned OAuth flag is explicitly enabled **and** both server-only secrets are present. Its public `/healthz` still verifies the four D1 tables without disclosing whether any secret exists.
- This guard permits operator-only Cloudflare secret provisioning without immediately enabling OAuth on a public canary URL. The next user-visible rollout must first deploy this guarded version, rerun the anonymous GET audit, then provision canary secrets and rerun the same audit (still locked). Enabling WORK OAuth requires a separate reviewed configuration change, browser authentication test and WORK-only Shopify app URL plan.

## WORK canary private credentials — operator-confirmed October 14, 2026

- Merchant's Wrangler output confirms **both** secret names were uploaded to only `jill-order-desk-canary-work`: `JILL_WORK_SESSION_KEY_B64` and `SHOPIFY_API_SECRET`. `wrangler secret list` returned both as `secret_text` without values.
- Subsequent live `custom-orders:work:canary:remote:audit` passed: `/healthz` HTTP 200, and `/`, `/app`, `/auth/login`, `/app/setup-owner` HTTP 503. The canary's **separate** `JILL_WORK_OAUTH_ENABLED=false` and `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=false` remain the intended protections.
- Actual Cloudflare version after the hardened canary rollout: `d9965be4-b0e5-4d96-a41a-ac65402206a9` (this is the last operator-reported deployment; Wrangler secret uploads may create subsequent versions). Do not assume the exact version stays constant after secret provisioning.
- Verified secret **names** do NOT prove the supplied Shopify Client Secret belongs to the WORK Client ID. Only a genuine Shopify WORK authenticated login can establish that.
- **Do not paste either secret, reset the encryption key, or rerun secret provisioning.** OAuth and Owner commissioning must stay disabled pending WORK app configuration/extension release plan and SDK integration review.
- Before modifying any Shopify settings, from the repository root inspect the CURRENT WORK app config/active version using `npx.cmd shopify app info --config work` and `npx.cmd shopify app versions list --config work`. This is read-only. Compare Client ID, `application_url`, `embedded`, auth redirects, scopes, and the three existing Customer Account UI extensions; never link a new app or switch to LIVE.
- Shopify app version changes may include the existing account extensions. Prepare a `shopify app deploy --config work --no-release` *only after* the candidate app config is reviewed; `--no-release` creates an unreleased app version and does not activate it. No candidate TOML or app version has yet been generated.

## Prepared Shopify OAuth canary switch (NOT deployed)

- The staged Shopify candidate `jill-work-order-desk-canary-1` remains **inactive**, while `jill-work-rewards-4` remains active. Operator screenshot confirms the staged exact canary URL, `embedded=true`, `/auth/callback`, ten unchanged scopes, existing app proxy and all three extension handles/UIDs consistent with the WORK source.
- `npm.cmd run prepare:work-canary-oauth` produces an ignored local manifest `dist/server/wrangler.oauth-canary.json` only after validating the compiled canary Worker name, D1 binding, stage, OAuth disabled, and Owner setup disabled. The candidate sets only `JILL_WORK_OAUTH_ENABLED=true`; it does NOT deploy or release anything. Existing `dist/server/wrangler.json` remains OAuth-disabled for rollback. Script refuses overwrite.
- `npm.cmd run test:work-canary-oauth-manifest` verifies failure for WORK/LIVE targeting, unexpected D1, changed Owner flag, already-enabled OAuth, and plaintext secret values. CI dry-runs the isolated opt-in manifest using Wrangler, without deploying it.
- **Release checkpoint:** genuine Shopify Admin OAuth cannot be certified solely from a public unauthenticated health page. Following an approved canary OAuth activation, test the login route and Shopify-generated authorization redirect in WORK; Owner setup must stay `false`. Only then should `jill-work-order-desk-canary-1` be released, with `jill-work-rewards-4` ready for immediate Shopify rollback.

## Root-cause fix: Cloudflare SSR HTTP 500 (2026-10-14)

- The initial OAuth-enabled canary version `9c4a1773-e0a2-4ca8-ad19-eb496c584c49` returned HTTP 500 on anonymous `/auth/login`, `/app`, and `/app/setup-owner`. The merchant rolled back to version `63c3e8e6-f907-4d3e-a14a-240a4e185919` with OAuth OFF and five live fail-closed audit checks passing. This rollback remains deployed until a new operator-approved deployment.
- New actual React Router SDK initialization test with synthetic credentials passed in Node, ruling out a basic SDK app-config exception.
- A further `wrangler.createTestHarness` integration test of the **real compiled Worker running in local Cloudflare workerd**, backed only by synthetic secrets and isolated simulated D1, **reproduced** HTTP 500 with `TypeError: server_browserExports.renderToPipeableStream is not a function`. This is a Node-vs-Web Streams SSR mismatch, not a failure of Shopify OAuth credentials.
- Added canonical `app/entry.server.tsx` using `renderToReadableStream` and `ServerRouter` for Workers. CI now verifies the real local Cloudflare app with `npm run test:workerd-oauth`, after a full canary build and candidate manifest preparation. The test confirms `/healthz` HTTP 200, `/auth/login` HTTP 200, and anonymous no-context `/app` and `/app/setup-owner` HTTP 410 instead of HTTP 500. These 410 responses are fail-closed behavior from the SDK for direct unauthenticated requests, **not proof of successful Shopify OAuth**.
- Before another OAuth attempt: pull the new branch; rebuild only the canary; deploy `dist/server/wrangler.json` first with OAuth OFF, verify all five remote audit checks; only after this matches the known-good secure baseline prepare/deploy the opt-in OAuth manifest. Keep Owner commissioning OFF and the staged Shopify version `jill-work-order-desk-canary-1` unreleased.
- No customer or merchant records, real secrets, LIVE app URL, or live Shopify version were modified by this source fix or CI simulation. Do not rerun remote D1 migrations or rotate secrets.

## Latest live WORK canary OAuth receipt and rollback — 2026-10-14

- User deployed new login route with OAuth ON, canary Worker version `b2f60080-2669-4ab1-b815-dfb27229e5ff` and Owner setup OFF. First anonymous check showed health 200, login 503, /app 410, /app/setup-owner 410. This failure has **not** been reproduced later and its exact cause remains undetermined. Do not claim a resolved underlying cause for the transient 503.
- Subsequent remote tests **before rollback** confirmed /auth/login HTTP 200 using both curl and browser user agents, and GET /auth/login?shop=jill-work.myshopify.com HTTP 302 whose redirect host was admin.shopify.com. These constitute a live anonymous login/redirect preflight, not a real installed Shopify online staff session, token exchange, or D1 persistence certification.
- User immediately relocked the canary with `JILL_WORK_OAUTH_ENABLED=false` and `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=false`, confirming deployed Worker version `2e5c1ad9-77be-4332-b876-32cec14a14bf`. All five remote deny-only checks (200 health, four 503 routes) passed.
- Existing WORK Shopify `jill-work-rewards-4` remains the known active version based on latest user-provided `shopify app versions list`, and staged `jill-work-order-desk-canary-1` remains unreleased. No staff Owner has been commissioned, and LIVE remains untouched.
- Correct deployment order for a controlled WORK-only staff login: check Shopify versions read-only, enable OAuth ONLY on the dedicated WORK canary using the matching compiled candidate, verify health and live anonymous login (200), verify WORK-only redirect (302), then release the specific staged Shopify WORK version with the operator's explicit confirmation. Test actual Shopify WORK admin staff sign-in and session D1 identity. If failed, **re-release `jill-work-rewards-4` first**, then relock canary OAuth. Do not alter owner bootstrap, Shopify LIVE, account customer ownership or D1 migrations.
- An existing app-version release replaces the active Shopify app configuration **and all bundled extensions**, not just the App Home URL. Preserve and QA three My JILL extensions and customer Custom Orders after this WORK release. Shopify rollback release may take several minutes to propagate.

## One-time WORK Owner commissioning candidate (NOT deployed)

- The latest operator read-only Cloudflare D1 checks found **2 saved sessions, 2 unexpired sessions, 0 registered Owners and 0 `owner.bootstrap` audit records** in the isolated WORK D1. This proves storage but **not** the current user's Shopify account-owner status.
- The signed-in Shopify WORK Admin now renders the embedded JILL Order Desk and its fail-closed `merchant_setup_required` state. `authenticate.admin` succeeds before the merchant authority query; no Owner was bound yet.
- `npm.cmd run prepare:work-owner-commissioning` creates a local-only manifest `dist/server/wrangler.owner-commissioning.json`, with exactly `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=true` added to the **same, verified OAuth-on WORK canary build**. Neither existing OAuth nor OAuth-locked manifest is mutated, and the script refuses any WORK/LIVE misrouting, D1 mismatch, changed bundle, extra binding or plaintext secret.
- The setup route checks official Shopify SDK online owner identity and the canary Origin, presents a human confirmation button, and uses a transactional, immutable D1 Owner binding plus audit. A GET does not commission anyone. The user must explicitly confirm registration; no owner ID or email is manually supplied.
- Only after the Shopify account owner is identified and the user approves the one-time Owner registration should the prepared manifest be deployed. Test the authenticated setup page, click the confirmation once, read-only verify `registered_owners=1` and `owner_audit_records=1`, then immediately deploy `dist/server/wrangler.oauth-canary.json` to disable Owner commissioning **while keeping OAuth enabled for the already-active Shopify WORK App Home**. Do not deploy `wrangler.json` as a post-commissioning rollback; it disables OAuth and would break the active embedded WORK Admin.
- No changes to LIVE, active Shopify app version, existing account extensions, customer ownership, Shopify sessions, or D1 migrations are part of this preparation.

## P2 WORK merchant inbox (source-only candidate)

The initial `/app/requests` route is explicitly Owner-only, authenticated through the existing Shopify SDK and D1 merchant policy. Until a separate signed WORK Google QA merchant list is implemented and certified, the app displays **source not connected** and never claims there are zero orders. `merchant-inbox-read.mjs` owns a strict bounded, whitelisted projection for the future canonical source. Do not substitute the customer account listing endpoint, typed email, D1 synthetic request records or Google operator impersonation. Tests: `npm run test:work-merchant-inbox`.

This section describes candidate source work; it is NOT deployed and it does NOT provision a merchant read secret or enable an Order Desk data feed. Releasing it requires separate WORK-only browser/runtime acceptance after CI.
