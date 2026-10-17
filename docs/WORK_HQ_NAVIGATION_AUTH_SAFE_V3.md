# JILL HQ WORK — embedded Shopify navigation recovery (v3)

## Observed incident

On 2026-10-15 owner reports Shopify embedded JILL HQ returns/visibly
displays `200 OK` after repeated Custom Orders navigation/status actions,
and sometimes fails to open the inbox for over one minute.

The active Cloudflare WORK Worker is `e818c639-f962-4a09-9399-54ab521531c3`.
The previously staged but never activated `f777d728-ef6f-456a-b0be-2e2495bcd804`
includes the single-parent-loader fix but **still has an intent-prefetching
JILL HQ link**. Do not activate it as the repair candidate.

Shopify's embedded React Router SDK has an externally reported issue where
repeated useFetcher requests eventually navigate to a
`/auth/session-token.data` HTTP 200 response and render a white screen.
This is a relevant pattern, not proof of this shop's exact failure:
https://github.com/Shopify/shopify-app-js/issues/3112

Shopify has also documented that Remix/React Router `Link` prefetch
requests historically lack the embedded authentication header and can
redirect to login on click:
https://github.com/Shopify/shopify-app-template-remix/issues/386

## Source fix + validated timing

- Keep one parent `.server.ts` authorized Shopify/D1/Google merchant
  loader (from PR #84). Index/workspace routes remain presentation-only.
- Remove `prefetch="intent"` from **JILL HQ → Custom Orders**. Do not
  automatically prefetch Owner-authenticated data without Shopify
  App Bridge's verified session header. Do not fake a 200 success with
  skeleton or optimistic data.
- Existing phase timings `merchant-shopify`, `merchant-authority`,
  `merchant-google` and total, plus `x-jill-feed-cache`, identify
  the cold delay after v3 activation. Shared D1 index stays OFF until
  its isolated migration/consistency commissioning.
- Repeat-load regression asserts there is no route index loader,
  no prefetch attr, direct URLs still check Owner, all writes still
  use HMAC/WORK D1, and all 4 existing secrets remain intact.

## NEW inactive-only staging

The *canonical existing* `npm.cmd run work:hq:navigation:stage`
is re-pinned to the current deployed WORK version e818... with a NEW
unique v3 candidate annotation:

`JILL HQ WORK auth-safe single-reader v3; inactive`

This **does not redeploy old f777**; Wrangler generates a new inactive
Worker version from the latest Git source with no flag changes. After
staging, inspect and pin its exact new ID in a separately reviewed
activation script. The old version's management write key is reused
privately without printing it.

## Browser verification

After explicit approved WORK-only activation:
1. From Shopify WORK Admin, open JILL HQ then Custom Orders. It should
   show the inbox, not a blank 200 page. Open request and back 30 times.
2. Try status action on a disposable QA request; ensure canonical
   revision updates, and My JILL follows the verified owner.
3. If a white 200 recurs, Chrome DevTools > Network > Preserve log.
   Identify if the iframe navigated to `/auth/session-token.data` or
   `/auth/login` rather than `/app/requests`, plus timing and content
   type. Screenshot the visible page and Console errors with private
   auth tokens/customer information redacted. The exact SDK behavior
   must be diagnosed before any further releases.
4. Compare slow cold route with numeric Server-Timing. If Google
   dominates, separately test/activate the optional shared D1 index;
   if Shopify/session dominates, focus auth/runtime instead.

No LIVE, KEEP, Rewards, Google Apps Script, checkout, customer records,
D1 migration or actual order creation changes in this PR.
