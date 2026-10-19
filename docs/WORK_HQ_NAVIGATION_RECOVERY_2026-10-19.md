# WORK navigation recovery and dashboard

## Owner report and evidence

Owner screenshots after visual v2 activation show three Requests links on Home
and a new tab on the raw WORK Worker `/app/requests` displaying `200 OK`.
Owner also reports ordinary Requests navigation no longer opens. The theme is
liked so far; this is partial visual feedback, not acceptance of other tabs.
The report authorizes a navigation repair plus a single Requests entry/dashboard.
This change is explicitly NOT classified as a visual-only release.

Current runtime `d301efb4-b015-40d4-87ad-159a9fff82eb` at 100%, quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0%, deployment
`3fbc20ff-1f9e-4e70-8f14-3e941638347c`; runtime source `5815213b29999310ea44049ef99d20b5178948c5`.
All old release/upload receipts remain spent. No keys/scopes/URLs are rotated.

## Reproduction and repair

The compiled SDK/React Router test reproduced a concrete defect: the
request-scoped authentication helper gave parallel loaders the SAME thrown
Response object. React Router independently consumes each loader response body.
`/app/requests.data` included both Shopify bootstrap HTML and a sanitized
Unexpected Server Error when that body was consumed twice. This is source/runtime
proof of a transport failure, not a claim that every prior Owner failure had
this exact cause. The earlier local visual fixture did not exercise real SDK
renewal or new-tab entry; passing that fixture was insufficient coverage.

`work-admin-auth-once.mjs` retains ONE SDK attempt per incoming request and gives
each caller a clone of a rejected SDK Response. Status, headers, HTML and denial
semantics are preserved. Successful SDK context and ordinary Error propagation
remain shared; no cross-request/session cache, retry or auth bypass is added.

A top-level browser document (`Sec-Fetch-Dest: document`) on the raw WORK `/app`
path is redirected to the SAME WORK app in Shopify Admin, with its route path.
The destination derives from canonical shop/client constants in `sdk-config.mjs`
and follows the SDK's `/apps/{apiKey}` URL structure. No source query, host, token,
return-to URL or browser identity is forwarded. Iframe reloads, `.data`,
Authorization-bearing requests, foreign hosts and command POSTs retain their
existing paths/SDK checks. A redirect grants no access: Shopify online auth and
WORK D1 permission checks still govern every data read or command.

## Home

Only the shared navigation links to Requests. Duplicate hero/card actions are
removed. Home shows Requests / In review / Needs a quote, using the existing
canonical nine-field Owner-only reader, cache and `inboxStats`, not a new counter
store. Counts stream after the authenticated page shell via Suspense/Await.
Only aggregate stats serialize to Home; staff/denied sessions never request the
feed. Unavailable reads show unavailable, never invented zero counts. Existing
Shopify shortcuts and the approved JILL theme remain.

## Verification

- Request-scoped auth tests preserve one SDK attempt, new-request reauth, all
  independent 200 HTML/401/403/302 response bodies and headers, and denial gates.
- Actual React Router parallel loader execution retains both SDK response bodies.
- Actual Home loader with synthetic boundary adapters: staff/denied never read
  feed, Owner stats do not block shell, no private record IDs serialize, outage
  is not zero. This is not a substitute for live SDK/Owner verification.
- Actual compiled workerd + real installed Shopify SDK + local D1: raw new-tab
  documents redirect only to WORK Admin with no forwarded query; iframe and
  `.data` bootstrap bodies survive; normal SDK bounce remains; invalid JWT denied.
- Local actual JSX/Polaris review: six screens × four widths (1600/1024/390/320),
  no overflow, >=44px touch links/controls/disclosures, exactly one Requests link
  on Home, navigation/filter/status-panel/estimate and keyboard disclosure work.
- Typecheck, fresh canary build, repository/source and existing affected contracts
  pass. New compiled navigation test runs in CI and before any new repair upload.

No secrets, raw sessions, private customer screenshots or real request IDs are
copied into Git. No data command, Shopify create, canonical event, migration or
payment was run. Media/quote/conversation activation and app URLs are unchanged.

## New release and remaining operational check

`work:hq:navigation:repair:check` checks seven exact reviewed files against
`scripts/work-hq-navigation-reviewed.json`, normalizing CRLF. Backend policies,
theme and extensions cannot change. The new static profile delegates to the
existing canonical release driver and preserves ALL current runtime bindings,
flags, D1 and quote canary. `visual_only: false` and the explicit navigation/
dashboard change scope appear in its receipt.

Commands: `work:hq:navigation:repair:inspect` (read-only),
`work:hq:navigation:repair:release-once` (new one-use inactive upload/read-back/
activation), `work:hq:navigation:repair:restore-once` (separate guarded owned
restoration only). New private receipt stem: `work-hq-navigation-dashboard-v1`,
with `-upload-once-20261019.json`, `-activate-once-20261019.json`, and
`-restore-once-20261019.json`. Never reset/repeat any spent receipt. Concurrent
allocation changes, unreadable metadata or uncertain upload outcomes HOLD for
inspection. Old navigation/performance and visual release commands stay spent.

NOT DEPLOYED yet. Owner credentials are required for provider inspection/release.
After exact runtime receipt, verify ordinary Home → Requests → detail → back
repeatedly in the authenticated WORK app, then open Requests in a new tab and
verify Shopify Admin route/session recovery. Verify Home counts independently
against the canonical inbox; capture authenticated timings and screenshots
without tokens/customer data. No status/message/quote submission is needed for
this navigation check. Do not claim the reported incident closed until that
Owner UI proof passes. Full WORK acceptance and separate LIVE review remain open.

## Navigation repair activated — 2026-10-19 19:53 UTC

Owner receipt supersedes preceding repair-not-deployed status. Runner/source
`576d6b0bcde43c43fda939f42513eefcb5adefb7`; package SHA-256
`2576094d1cbfdc196c07f6b8a47dbbda0677b7ab8d1903324517958d5e31d5f4`.
Runtime `6473444f-86f8-4a83-a47a-56d1a2e19f05` is at 100%; quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` remains at 0%. Deployment
`1ffdde49-e556-43a6-b7bb-e10cd3a71048`, created
`2026-10-19T19:53:44.176641Z`. Exact runtime health and allocation verified by
Owner; upload and activation acknowledged and both receipts SPENT. Never repeat
`work:hq:navigation:repair:release-once` or reset receipts. Read-only inspection
uses `work:hq:navigation:repair:inspect`. Prior studio runtime `d301efb4-b015-40d4-87ad-159a9fff82eb`
is the guarded restoration baseline, not ordinary active traffic.

Independent executor GETs verified the exact active version and database-ready
health at 19:55:29 UTC; top-level `/app/requests` now returns 302 to the existing
WORK Shopify Admin app/Requests path with no-store; anonymous `.data` bootstrap
retains App Bridge and no longer contains the reproduced Unexpected Server
Error. These reads send no signed POST, grant no access and do not certify a
signed-in browser session. Canonical evidence:
`docs/evidence/work-hq-navigation-activation-2026-10-19.json`.

Change scope is explicitly navigation transport and authorized dashboard,
`visual_only: false`. All current bindings/flags preserved: catalog ON, quote
and conversation OFF, quote canary unchanged. No secret, schema/data command,
new billable service, gateway, app release, extension, wallet or LIVE change.

Next gate: refresh the existing authenticated WORK app; verify the single
Requests entry, Home counts against inbox, repeated Home → Requests → detail →
back navigation and a new-tab request entering Shopify Admin successfully.
Capture actual UI/screenshots and timings without tokens or private customer
records. No write/status/message/quote submission is required for this check.
The authenticated navigation incident remains OPEN until this Owner UI proof
passes. Full WORK operational acceptance and separate LIVE review remain open.
