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
