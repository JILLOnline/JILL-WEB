# JILL HQ WORK — request-list responsiveness

The WORK Custom Orders inbox and individual request detail read the same
HMAC-signed Google QA merchant-list snapshot. Previously, each page navigation
performed an independent Shopify Owner/D1 gate **and** a fresh Google Apps
Script HTTP round-trip, including a potentially slow Google cold start.

## Scoped performance change

- Every request still authenticates its Shopify online session and verifies
  Owner permission in WORK D1 **before** consulting the cache.
- Only nine whitelisted request metadata fields are held in Worker-isolate
  memory for **20 seconds**. No raw payload, email/phone, staff token, secret,
  customer ownership data, message, or internal notes are cached.
- Concurrent authorized loads share one in-flight source request. A source
  error/invalid payload is not cached and fails closed at the original boundary.
- Cache is not shared between isolates and is not persisted. There is no
  browser caching: responses retain `Cache-Control: private, no-store`.
- A later certified status-write path must call
  `invalidateWorkMerchantSourceCache()` **after confirmed canonical commit**.
  Until then, the visible metadata may be up to 20 seconds old.
- Every inbox/detail response includes `Server-Timing` entries
  (`merchant-auth`, `merchant-feed`, `merchant-total`) and
  `X-JILL-Feed-Cache` (`miss`, `hit`, `joined`, `not-requested`).
  These expose timings and cache state only, not customer data or tokens.

## How to verify on signed-in Shopify WORK

Open browser Developer Tools → Network → select the request for `/app/requests`.
Check the Response Headers `server-timing` and `x-jill-feed-cache`.
Open a request workspace promptly. On the same active Worker isolate, the
second request should say `hit` with substantially smaller `merchant-feed`
time. If it says `miss`, the previous isolate expired/changed, or the
20-second TTL elapsed. Never infer performance from bundle size alone.
Investigate Shopify/OAuth and D1 separately if `merchant-auth` dominates.

This is source-only WORK code until a guarded WORK rollout is separately
reviewed and authorized. LIVE, KEEP, Google QA, My JILL, Rewards and all three
existing Cloudflare secrets remain unchanged.
