# JILL WORK Custom Orders — no-card Cloudflare gateway

**Status:** GitHub WORK source + Cloudflare Wrangler dry-run are available.
Cloudflare account/deployment and Shopify proxy remain separate; nothing
is connected to LIVE, nor to the existing WORK Rewards backend.

## Why we switched

The merchant declined Render's card/billing step. Render's Blueprint,
web server, Redis dependencies, CI packaging and runbook were removed
from `jill/rewards-work`. **No Render services were provisioned from chat.**

Cloudflare's official Workers page advertises **Workers Free without a
credit card**. SQLite-backed Durable Objects are supported on Workers Free
with daily limits; requests over free-tier thresholds are refused.
Cloudflare is therefore a suitable **QA** host, not an unlimited-SLA
production guarantee.

Sources:
- https://www.cloudflare.com/products/workers/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/

## Architecture

WORK Shopify app proxy:
`https://jill-work.myshopify.com/apps/jill-custom-order`
→ Cloudflare Workers Free `/jill-custom-order-proxy`
→ verifies signed Shopify app-proxy HMAC, WORK shop, clock and path
→ Cloudflare SQLite Durable Object applies a **global-shop quota plus
per-client quota** synchronously and atomically
→ existing canonical Node-compatible gateway signs Google requests
→ isolated WORK Google Apps Script `doPost`
→ separate durable `custom_order.receipt.result` verification
→ one verified customer-side receipt (not account ownership).

The Cloudflare worker:
- `services/custom-order-cloudflare/worker.mjs`
- `services/custom-order-cloudflare/handler.mjs`
- `services/custom-order-cloudflare/limiter.mjs`
- `services/custom-order-cloudflare/wrangler.toml`
- `services/custom-order-cloudflare/package.json`

It is a single Worker and an included SQLite-backed Durable Object.
No standalone paid Redis service, VM, process, DB credentials or Render
subscription is needed.

## Provision only a Free account

Go to https://dash.cloudflare.com/sign-up and select Workers Free.
If Cloudflare asks for a card or charges to create **this Free Worker**,
**stop** instead of entering billing details. The source does not require
any paid service or automatic CI deployment.

On local Windows PowerShell:

```powershell
git switch jill/rewards-work
git pull --ff-only
cd services/custom-order-cloudflare
npm.cmd install
npx.cmd wrangler login
npm.cmd run build
```

`wrangler login` requires the merchant's Cloudflare browser
authorization and cannot be supplied through GitHub. `npm run build`
is a dry-run bundle; it creates NO deployed Worker.

After inspecting the WORK-only `wrangler.toml`, deploy explicitly:

```powershell
npm.cmd run deploy
```

Wrangler should display a new
`https://jill-work-custom-orders-qa.<YOUR-SUBDOMAIN>.workers.dev`
address. **Do not invent or assume the subdomain.**

The deployment starts **without Shopify/Google secrets**, so
`/healthz` should be 503 until the secrets are added.
Then add the three secrets through Wrangler's interactive prompts,
without pasting their values in chat, source, logs or screenshots:

```powershell
npx.cmd wrangler secret put SHOPIFY_WORK_APP_SECRET
npx.cmd wrangler secret put JILL_CUSTOM_ORDER_GATEWAY_SECRET
npx.cmd wrangler secret put JILL_CUSTOM_ORDER_QA_BACKEND_URL
```

- `SHOPIFY_WORK_APP_SECRET`: the distinct **WORK Rewards app secret
  key** from Shopify developer/admin, not the client ID and not LIVE.
- `JILL_CUSTOM_ORDER_GATEWAY_SECRET`: the exact same private random
  WORK Custom Orders QA secret already in Google Script Properties.
- `JILL_CUSTOM_ORDER_QA_BACKEND_URL`: the isolated Google QA web-app
  public `/exec` endpoint that the merchant verified online.

The Worker validates these bindings on every health and POST request;
none are bundled as public `[vars]`. Never create a `.dev.vars`
containing real secrets in Git.

## Pre-Shopify host checks

When `GET https://YOUR-WORKER/healthz` responds:

```json
{"ok":true,"environment":"WORK_CUSTOM_ORDERS_QA"}
```

it proves only the Worker configuration and DO reachability.
An unsigned request to the POST endpoint must return 401 without
calling Google. A forged signature, wrong shop or stale timestamp must
also be refused. A missing Durable Object must return 503, never bypass
the quota.

Only once the host passes may the WORK Shopify app config receive
`write_app_proxy` and `[app_proxy]` by the existing guarded command:

```powershell
$env:JILL_WORK_CUSTOM_ORDER_PROXY_URL = 'https://YOUR-WORKER.workers.dev/jill-custom-order-proxy'
npm.cmd run custom-orders:work:proxy:prepare
```

That command only edits the ignored `shopify.app.work.toml` and does
**not** deploy WORK Shopify. The separate explicitly authorized
`shopify app deploy --config work` may require reauthorization to add
`write_app_proxy`. Never deploy the production account app here.

Then send one synthetic request through Shopify WORK, reconcile
Submissions + CustomOrderEvents on the isolated Google QA sheet,
repeat identical submission and then send a conflicting payload.
Only after both proofs work should WORK theme form settings use
`/apps/jill-custom-order`. LIVE remains unchanged.

## Deployment/operational guards

- Manual Wrangler deploy ONLY, no GitHub credentials or automated
  Cloudflare deployments.
- WORK Shopify shop and Google QA endpoint are pinned by source/config.
- Requests exceeding 256 KB fail. Signed Shopify query is verified
  before use of the gateway.
- The single shop-wide Durable Object quota is always consumed,
  even if client IP hashing is missing/spoofed; client partitioning
  is additional defense, not authorization.
- Free usage limits can produce errors. This is QA only; review
  long-term hosting durability and production requirements separately.
- Google `/exec` may be online while POST receipts are still
  unverified; never claim success from the GET health check.
