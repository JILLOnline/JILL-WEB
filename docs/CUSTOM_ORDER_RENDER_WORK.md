# JILL WORK Custom Orders — Render Gateway Deployment

**Status:** infrastructure-as-code prepared, not provisioned/deployed. This is
for the isolated test shop `jill-work.myshopify.com`, not the production store.

## Identity and environment

- GitHub: `JILLOnline/JILL-WEB`, branch `jill/rewards-work` only.
- Blueprint: repository-root `render.yaml` (no LIVE references).
- Web: `jill-work-custom-order-gateway` (Node 24, Virginia).
- Private data service: `jill-work-custom-orders-rate-limit` (Render Key Value).
- Render app-proxy route: `POST /jill-custom-order-proxy`.
- Shopify customer-facing route after WORK app setup: `/apps/jill-custom-order`.
- Health check: `GET /healthz`.
- Google QA backend: independent WORK Custom Orders Apps Script deployment,
  not the WORK Rewards or LIVE Custom Order deployment.
- `autoDeployTrigger: off`: only an explicitly approved Render deploy updates the service.

## Before syncing the Blueprint

Render's connection to GitHub does not automatically connect Render to
ChatGPT. If the Render app is connected here, ChatGPT can manage it directly;
otherwise the merchant uses Render Dashboard > New > Blueprint.

Select the GitHub repo and branch `jill/rewards-work`, with Blueprint file
`render.yaml`. Review the two proposed WORK resources and pricing *before*
clicking Approve/Apply. The Blueprint selects a paid, always-on Starter-class
web service (`0.5c-512mb`) and a separate 256 MB Key Value plan; deploying
them can incur charges. No charges are incurred by GitHub source commits.
Never sync the Blueprint against LIVE or create a second Rewards backend.

## Render environment variables (secrets entered ONLY in Render)

The Blueprint prompts for these three variables with `sync: false`:

1. `SHOPIFY_WORK_APP_SECRET`: the **JILL WORK Rewards app client secret**,
   from Shopify's developer dashboard. It is not the Shopify client ID,
   Admin API token or the LIVE app's secret.
2. `JILL_CUSTOM_ORDER_GATEWAY_SECRET`: the **exact same independent value**
   already stored in the QA Google Apps Script Script Properties and the
   merchant's password manager. It is NOT the Shopify secret.
3. `JILL_CUSTOM_ORDER_QA_BACKEND_URL`: the isolated WORK Apps Script
   public `/exec` URL confirmed to show `JILL WORK Custom Orders QA online.`.

`REDIS_URL` is injected automatically from Render's private Key Value
instance. Never expose Redis publicly; the Blueprint sets `ipAllowList: []`.

Secrets must never be shared in this chat, committed to GitHub, pasted
into Render build logs, browser JavaScript, Shopify theme code or Liquid.
Credential validation blocks startup if keys are missing/short/identical
or the Google endpoint is not a valid Apps Script URL.

## Service verification

1. Sync the Blueprint after reviewing cost and setting the three secrets.
2. Confirm the Render gateway deployment is healthy. Check the service
   at `https://YOUR-RENDER-HOST.onrender.com/healthz` and expect:
   `{ "ok": true, "environment": "WORK_CUSTOM_ORDERS_QA" }`.
   This only proves that Redis is reachable and secrets parsed;
   it DOES NOT prove valid Shopify HMAC, Google write acceptance, or an
   account owner binding.
3. Direct, unsigned attempts to POST `/jill-custom-order-proxy` must return
   an authentication error and must not reach Apps Script.
4. Validate private Key Value rate limits, global shop quota, wrong
   `shop`, malformed signatures, stale timestamp, oversized payload and
   broken Google upstream. All must fail without an accepted order.
5. The app must remain manually deployed. Check that the branch is the
   certified WORK source SHA and auto-deploy stays disabled.

## Shopify proxy activation (a SEPARATE gated operation)

The JILL WORK Rewards app currently has no `write_app_proxy` scope.
Once the hosted route is confirmed and tested, on the merchant's local
WORK-only checkout:

```powershell
git switch jill/rewards-work
git pull --ff-only
$env:JILL_WORK_CUSTOM_ORDER_PROXY_URL = 'https://YOUR-RENDER-HOST.onrender.com/jill-custom-order-proxy'
npm.cmd run custom-orders:work:proxy:prepare
```

This edits ONLY the ignored, already-verified `shopify.app.work.toml`.
Inspect the result before an explicitly approved `shopify app deploy --config work`.
Shopify may require WORK app reauthorization for the newly added
`write_app_proxy` scope. DO NOT run the production account app deploy.

Shopify forwards storefront requests from `/apps/jill-custom-order` to
the hosted Render path. The signed query verifies the WORK shop, but
does NOT authenticate a customer for My JILL order-history access.

Test a synthetic request through the real Shopify proxy, reconcile it in
the isolated Google `Submissions` and `CustomOrderEvents` tabs, verify
a second independent receipt, repeat the same ID, and send a conflicting
request to verify rejection. Google QA must send no merchant emails or
write Shopify customer records. Only after these pass may WORK theme
`verified_submission_endpoint` be set to `/apps/jill-custom-order`.

**No LIVE app, theme, backend, order or customer data is authorized to
change during any of these steps.**

## Troubleshooting

- Gateway fails to start: check the three secret variables, the QA
  endpoint URL, Render Key Value connection and same-region deployment.
- Health returns 503: private Redis is unavailable; there must be no
  in-process rate-limit fallback.
- Shopify returns 401: signed shop, WORK app secret, path_prefix,
  timestamp or Shopify app proxy configuration is incorrect.
- Shopify returns 403: origin allowlist or installed app/store mismatch.
- Google returns `receipt_unconfirmed`: check Apps Script execution
  logs (never print secrets) and reconcile intake/event history before
  allowing the storefront to display a confirmed receipt.
- Render services use paid compute in this Blueprint, review
  Render's current price breakdown in your workspace first.

Source owner: `services/custom-order-work-gateway/` and
`backend/custom-order-work-proxy-route.mjs`. Canonical business rules
and receipt logic remain in existing JILL Google Apps Script source.
