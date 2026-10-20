# JILL HQ WORK — guarded v3 activation

## Grounded staging result (2026-10-15)

Owner's Windows PowerShell executed
`npm.cmd run work:hq:navigation:stage` on `jill/rewards-work`
Git `002f062` and reported:

- **PASS** all merchant/inbox/action/mail/Google key regression suites,
  TypeScript, React Router client/server production build, and the local
  Cloudflare runtime OAuth/anonymous-command integration test.
- **NEW INACTIVE v3:** `545795da-c7f4-40cf-baab-19ab8f04df69`.
- **ACTIVE navigation v1:** `e818c639-f962-4a09-9399-54ab521531c3`.
- Staging preserved all FOUR existing WORK secrets, D1, OAuth ON,
  Owner commissioning OFF, merchant writes ON, Worker routing and runtime.
- No Cloudflare traffic switch, LIVE/KEEP/Rewards, Google script or
  customer record mutation happened during staging.

Old inactive `f777d728-ef6f-456a-b0be-2e2495bcd804` **must never be
promoted**. It contains the earlier single-reader fix but also the
Shopify-embedded `prefetch="intent"` which v3 deliberately removed.

## Read-only inspection first

From a clean, synced checkout of `jill/rewards-work`:

```powershell
npm.cmd run work:hq:navigation:inspect
```

This checks Cloudflare is **still** serving exactly e818...,
the v3 candidate ID and unique annotation match, no later Worker
version exists, all original nine WORK bindings (four secrets, one D1,
four plain variables), the source etag changed, asset routing is
identical, and the old known-good management release
`a57b9b91-84e8-44db-bd2b-144646d5b342` is suitable as fallback.

It does NOT deploy, upload, or modify secrets/records.

## Explicit release

Only if read-only inspection passes:

```powershell
npm.cmd run work:hq:navigation:activate
```

The command repeats live Cloudflare checks, independently re-probes the
private WORK Google QA HMAC key **without any status/mail mutation**,
checks WORK health, Shopify login, anonymous inbox denial, Owner
commissioning OFF and exact unauthenticated command
`HTTP 403 {"ok":false,"error":"invalid_origin"}`.

Before switching, the owner must type:

```text
RELEASE JILL HQ WORK AUTH SAFE V3
```

Only then the command switches **WORK** to the exact v3 version at
100%, checks the deployment is v3, and runs the public security
probes again.

On post-release failure or an ambiguous deploy response it checks the
current deployed version. If the v3 candidate is active, it attempts
rollback to the older known-working management v2
`a57b9b91-84e8-44db-bd2b-144646d5b342`, **not the currently
broken navigation v1**. If another version is active, it refuses to
overwrite it. If rollback is unconfirmed, stop and inspect Cloudflare.
Never blindly rerun an activation.

## Shopify browser verification is separate

**Public HTTP 200 is not proof of a working Shopify embedded app.**
After activation, sign into JILL WORK Shopify Admin and test:
1. JILL HQ → Custom Orders, verify visible two-request inbox.
2. Repeated inbox ↔ request workspace navigation, including >15s
   snapshot-expiration boundary; test a disposable WORK QA status save
   only if the UI is stable.
3. DevTools **Network / Preserve log**: record the specific
   `/app/requests` request, redirect chain and any
   `/auth/session-token.data` or `/auth/login` response, timing,
   sanitized `Server-Timing` and `x-jill-feed-cache` headers.
4. DevTools **Console**: look for client hydration, Router or
   Shopify session-token errors. Never share access tokens, cookies,
   private customer contact details or full request bodies.
5. If 200-but-blank recurs, stop releasing and investigate the
   actual browser request/session handling. Do not assume the
   single-loader/prefetch repair fully explains it.

The optional shared D1 fast-inbox index from PR #88 stays **OFF**;
migration 0003 is NOT applied. Private attachments, full request
detail source operation, quotes, payment and Shopify order creation
are NOT enabled by v3.
