# JILL HQ WORK — single-reader repair v2 release

## Urgent observation

The owner reports **Custom Orders inbox cannot currently render**:
browser may show `200 OK` yet Shopify Admin does not display the
inbox, sometimes returning after a long delay. Other earlier WORK
status saves were confirmed across Google and My JILL.

The exact browser 200 source (HTTP response, React Router error
boundary, embedded iframe, or OAuth) is **not identified yet**.
Do not equate a Cloudflare public health check with a successful
authenticated browser render.

## Confirmed Cloudflare status (owner read-only, 2026-10-15)

- **Active 100%**: `e818c639-f962-4a09-9399-54ab521531c3`,
  initial navigation performance v1. This build had a duplicate
  React Router inbox child loader.
- **Staged inactive**: `f777d728-ef6f-456a-b0be-2e2495bcd804`,
  isolated **single-reader stress fix v2** created at
  2026-10-15T20:31:33.794Z.
- PR #84 removed the duplicate index loader and placed the verified
  Shopify/WORK D1/signed Google reader in one `.server.ts` source.
- PRs #86–88 came **after** this staged build. They are source-only
  and NOT contained in `f777...`; they do not affect this release.
  The D1 shared index remains OFF and migration 0003 is NOT applied.

## Guarded repair release

From clean synced `jill/rewards-work`:

1. `npm.cmd run work:hq:navigation:inspect` (**read-only**).
   Require exact current active and inactive candidate IDs, unique v2
   annotation, no newer version, identical original nine Cloudflare
   bindings (four WORK secrets, D1, four flags), unchanged asset routing,
   distinct source etag, Owner bootstrap OFF, Shopify OAuth ON and
   signed merchant writes ON.
2. If PASS, run `npm.cmd run work:hq:navigation:activate`.
   It repeats the Cloudflare inspection and HMAC QA handshake and
   validates WORK health, auth/login, anonymous inbox denial,
   disabled Owner commissioning and exact anonymous merchant POST
   `403 {"ok":false,"error":"invalid_origin"}`.
3. Local owner must type `RELEASE JILL HQ WORK SINGLE READER V2`.
   Only then promote the exact `f777...` candidate to 100% WORK.
4. Post-release check repeats health, OAuth, Owner bootstrap denial,
   anonymous inbox denial and signed-write Origin gate.
   Failed post-release checks attempt rollback to the earlier WORK
   management release `a57b9b91-84e8-44db-bd2b-144646d5b342`,
   which previously rendered when navigation v1 was not installed.
   The currently active navigation v1 has reported 200-OK rendering
   failures and is **not** treated as the last working rollback.
   Unknown status -> STOP; do not blindly rerun.

## Real browser acceptance is mandatory

These public checks do not validate the signed-in Shopify browser UI.

After release, use Shopify WORK Admin's JILL HQ (not a bare
`workers.dev/app/requests` tab). Navigate into Custom Orders and
capture Chrome **DevTools → Network**:
- Preserve log, reload WORK JILL HQ, then click inbox.
- Select the specific `/app/requests` document/fetch request and
  record its status, **type/content-type**, TTFB/total timing,
  `Server-Timing`, `x-jill-feed-cache`, redirect chain and any
  route data requests. Do not share Cookies, Authorization, URL query
  tokens or response bodies containing customer data.
- Capture Chrome **Console** errors or Shopify's visible `200 OK`
  screen, redacting private values. A 200 response with an error
  boundary is not functional success.
- Repeat 30 back/forth navigations and re-open a direct authorized
  workspace; perform one disposable QA status save only if safe.

If WORK still cannot render, do not keep deploying staged versions.
Capture failing request path, response type and Console error to
determine whether SDK OAuth, loader execution, JS hydration or
Shopify embedding is responsible. Preserve LIVE, KEEP and Rewards.

This release only repairs the **known duplicate reader**; no claim
of solving the unexplained 60-second auth/render latency.
