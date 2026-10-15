# JILL HQ WORK — pending `requests.data` during Shopify Admin navigation

## Browser evidence (2026-10-15)

The owner captured Chrome DevTools Network with Preserve Log.
The `requests.data` fetch, initiated by App Bridge, remained
**(pending)** while the request-route JS/CSS assets were served,
including 304 cached responses. Their DevTools waterfall covered
over 60 seconds. This identifies the **server data route** as the
immediate render blocker, not the storefront CSS or image assets.
A late 200 is not proof that the route UI rendered correctly.

The current source makes the following calls on this single
React Router data navigation:
1. `routes/app.tsx` runs Shopify `authenticate.admin()`.
2. `routes/app.requests-source.server.ts` independently ran the
   same Shopify `authenticate.admin()` and only THEN verifies WORK
   D1 Owner authority and reads signed Google QA merchant data.
   Two independent SDK auth attempts can race token exchange for
   one request. This is a code-level redundancy; the browser
   evidence does **not** yet establish that it caused 60 seconds.
3. Google signed POST is timed out at 15 seconds. End-of-request
   `Server-Timing` is helpful only once the pending request finishes.

## Repair and observability

- Use one **per-incoming-HTTP-request** promise for Shopify Admin
  authentication, keyed only on the unique Cloudflare context object
  created by `workers/app.ts` for each fetch. Neither the authenticated
  session nor response is persisted between requests or shared across
  users/shops. Rejections and SDK redirects propagate unchanged.
  The WORK D1 Owner authorization is still required and always runs.
- Add one opaque random trace ID to `x-jill-inbox-trace` response header.
  Emit `JILL_WORK_INBOX_PHASE` logs when each server phase starts
  and finishes: `shopify_auth`, `work_owner`, `google_feed`.
  Logs have only trace IDs, phase names, and rounded milliseconds.
  No session tokens, customer contacts, search terms, request URLs,
  signing keys or binary data appear in the logs.
- Preserve existing `Server-Timing` phase headers and source-cache
  freshness safeguards. The optional D1 index remains OFF.

## How to find the actual time sink after a reviewed WORK-only rollout

Keep Shopify WORK Admin opened in browser and use DevTools:
1. **Network → Preserve log → Fetch/XHR**. Click Custom Orders once.
2. Select the **`requests.data`** row while pending; open the
   **Timing** tab and note whether the time is spent in
   *Waiting for server response (TTFB)*. Don't share query-string
   tokens or the Request Headers Authorization/Cookie values.
3. Once completed, look at **Response Headers**:
   `Server-Timing`, `x-jill-feed-cache`,
   `x-jill-inbox-trace`, HTTP status and Content-Type.
4. For requests that never complete, start an **Owner-only** Cloudflare
   Worker tail separately on the Windows machine. The trace-safe
   `JILL_WORK_INBOX_PHASE` logs identify the **last started** phase.
   Tail output must be filtered/redacted before sharing; Shopify
   sessions/request URLs can appear in unrelated Wrangler log fields.
5. If last phase is Shopify auth, inspect SDK token exchange/D1
   session storage; if WORK Owner, inspect its two D1 queries; if
   Google feed, independently investigate Apps Script read latency,
   bounded timeout and shared WORK D1 index commissioning.

**No changes by merging this PR**: Cloudflare v3 remains active
until a new inactive candidate is separately staged and approved.
Do not rerun previous staging/activation scripts pinned to historical
versions. No LIVE/KEEP/Rewards, Google Script, Shopify checkout,
production records or QA events change.
