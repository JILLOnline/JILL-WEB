# JILL HQ WORK — Custom Orders navigation performance

## Observed symptom

Owner reports 10–15 seconds to navigate from JILL HQ into Custom Orders
or from inbox into the request workspace. Screenshots confirm that the
WORK management UI loads the two verified requests, but they do not
contain a network timing trace or prove successful real status mutation.

## Source-level cause

Before this change, the /app route runs Shopify Admin authentication,
and the inbox child runs Shopify authentication, WORK D1 Owner policy
and the signed Google QA merchant read. Its per-isolate source cache
lives for 20 seconds, but hits cannot be guaranteed across Workers.
The request workspace had an independent loader that reran the entire
inbox loader, including the potential 15-second Google fetch timeout.
No amount of CSS animation fixes that data waterfall.

## Canonical fast-navigation architecture

- `/app/requests` and `/app/requests/:submissionId` now share ONE
  parent React Router WORK-only loader. The existing inbox reader remains
  the sole Owner + WORK D1 + signed Google QA source.
- A directly opened detail URL **still authenticates** on the server and
  returns **only its nine whitelisted fields**, or HTTP 404 for an
  unknown request. It never returns another request's data.
- During sibling navigation, the client can reuse an already Owner-verified
  **full inbox projection** for at most **15 seconds**, with no new source
  request. Only transient React Router in-memory loader state is used;
  there is no localStorage, sessionStorage, browser secret, PII cache,
  customer identity inference, or independent status authority.
- Direct detail-only data cannot be reused to render a full inbox.
- A save attempt, including an ambiguous source commit result, forces
  parent loader revalidation. Explicit same-page Refresh always revalidates.
  If a newer canonical revision is not yet visible, the UI blocks a
  second edit pending revalidation. Server CAS and HMAC enforcement remain
  unchanged.
- JILL HQ → Custom Orders link now uses intent prefetch for faster
  expected navigation, without background polling on every page view.
- The outer /app parent skips redundant Shopify SDK authentication only
  during client navigation between two already matched request sibling
  pages; direct page loads and mutations still authenticate.
- Existing `server-timing: merchant-auth, merchant-feed, merchant-total`
  and `x-jill-feed-cache` headers remain to diagnose **cold** Google
  read time separately from navigation time.

## Performance verification (must be performed after WORK-only rollout)

Record Chrome DevTools Network (Preserve log) for a signed-in WORK Owner:
1. JILL HQ → Custom Orders inbox from a cold tab. Note request
   `server-timing` merchant-auth/feed/total and x-jill-feed-cache.
2. Within 15 seconds, click Open request workspace and back.
   This should reuse the existing verified parent record, with no
   second Google read for the sibling navigation. Target perceived
   navigation under 1 second on a healthy client, not a guarantee.
3. Refresh direct detail URL and verify Shopify Owner authorization,
   one-record projection, HTTP 404 for missing ID and no browser cache.
4. Save an internal note to a disposable WORK QA request only, confirm
   canonical revision increments and My JILL customer isolation.
5. Measure a cold return after 20+ seconds. If slow remains, use the
   server timing headers to isolate Shopify session/D1 vs Google QA.
   Do NOT introduce unauthorized long-lived or optimistic status caches.

## Release boundary

Source-only PR. No Cloudflare upload or traffic change. This is a new
code version and MUST NOT reuse the pinned previous management release
commands. Stage and inspect a new WORK-only candidate after determining
the exact currently active WORK Worker/version, preserving all FOUR
secrets, Owner bootstrap OFF, OAuth ON, write opt-in, and rollback.
No LIVE, KEEP, Rewards or Google Apps Script update.
