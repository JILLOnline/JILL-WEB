# JILL HQ WORK — v4 pending requests.data release

## Owner-verified staging result (2026-10-15)

The owner's local PowerShell staging ran nine WORK regression suites,
TypeScript validation, optimized WORK App Home build and compiled Cloudflare
OAuth/runtime tests. No LIVE/KEEP/Rewards, Google QA, order event or mail
outbox changes occurred.

Cloudflare versions:
- ACTIVE v3: `545795da-c7f4-40cf-baab-19ab8f04df69`
- NEW INACTIVE v4: `52adfbde-afb6-453e-b779-7be6f4e02519`
- Last previously working merchant management v2, recovery:
  `a57b9b91-84e8-44db-bd2b-144646d5b342`

The new v4 includes PR #92's one-SDK-authentication-attempt per incoming
HTTP request, preserving online Shopify Owner verification and D1 permission.
It also logs sanitized `JILL_WORK_INBOX_PHASE` begin/end timing messages for
Shopify auth, WORK Owner/D1 and signed Google QA. It does **not** enable the
optional D1 index, alter shipping, change Shopify scopes or enable any
invoice/order features.

## Step 1: read-only inspection

Use latest clean `jill/rewards-work` with
`npm.cmd run work:hq:navigation:inspect`.

This command insists that active WORK traffic is still at exact v3, that
the unique staged v4 annotation belongs only to the exact version above,
that no newer Worker version exists, and that all nine original Cloudflare
bindings, four secrets, WORK D1 identity, OAuth ON, Owner bootstrap OFF,
merchant writes ON, code entrypoint/runtime/asset routing are preserved.
It verifies the older management recovery version has identical WORK
binding/security policy. It makes **no traffic, secret or data changes**.

## Step 2: explicit WORK-only activation

Only after a successful inspection, use
`npm.cmd run work:hq:navigation:activate`.
The script re-inspects Cloudflare, performs a nonmutating Google QA HMAC
handshake, checks WORK health, Shopify login route, anonymous inbox denial,
disabled Owner commissioning and exact unauthorized command response
`403 {"ok":false,"error":"invalid_origin"}`. The operator must type:

`RELEASE JILL HQ WORK INBOX DIAGNOSTICS V4`

Only then switch the exact v4 version at 100% WORK; repeat public security
checks and verify the deployed version. If a deployment error is ambiguous
or the post-release probes fail while v4 is active, attempt rollback to
the earlier management v2 version, not the historically broken navigation
v1. Never overwrite an unexpected third-party active version.

## Step 3: a real signed-in browser test, not just HTTP health

Public health and anonymous 403 checks **cannot verify** that Shopify
Admin's embedded WORK Custom Orders UI rendered.

Sign into Shopify WORK Admin and click JILL HQ → Custom Orders once.
In Chrome DevTools Network, enable Preserve Log. Select `requests.data`:
- If complete, record status, content-type, numeric `Server-Timing`
  stages (merchant-shopify, merchant-authority, merchant-google),
  `x-jill-inbox-trace` and `x-jill-feed-cache` only.
- If pending over ~15 seconds, capture Timing → Waiting (TTFB).
  Non-PII `JILL_WORK_INBOX_PHASE` BEGIN/END logs on the WORK Worker
  can reveal the stuck stage for that specific trace. **Never paste raw
  Worker log fields with Shopify session/query tokens, cookies, customer
  contact info or request bodies.**
- Verify visible request cards and 10 alternating inbox/workspace
  navigations. Test an actual status update only on an isolated QA
  request and only after the inbox is stable.

If a white HTTP-200 page or stuck data loader remains, do not repeat
deployments or keep clicking. Investigate the last traced phase and
React Router/Shopify App Bridge network response before modifying another
layer. v4 removes redundant auth and improves diagnostics; it is not yet
proof that the observed minute-long wait has been solved.

No production LIVE changes, payment creation, invoice dispatch, customer
mail, Shopify catalog modifications or remote D1 migrations are part of
this release.
