# JILL HQ WORK — command-route authentication hardening

## Observed rollback

On 2026-10-15 the exact staged Worker candidate
`e7bad727-b876-4895-866d-bc4dc583e280` passed code,
bindings, OAuth, Owner-OFF, Google QA HMAC and health checks, but
post-release unauthenticated POST verification stopped with
`anonymous_command_not_denied`. The guarded script reported a
successful rollback to the old WORK active version
`e67a2209-f6d9-4671-b6fc-33994015af30`.

The old verifier accepted only narrow denial statuses/redirects. The
record does not include the failing HTTP status, so we cannot claim
a missing authentication control or merely a benign redirect.

## Fail-closed fix

A POST to **exactly** `/app/requests/command` now requires
`Origin` to be the canonical WORK Worker origin at the outer
Cloudflare entrypoint. Missing, `null`, foreign, or LIVE origins
receive HTTP 403 *before* Shopify SDK redirects, D1, or the body.
A matching Origin does **not** authorize a command: the React Router
action still runs Shopify's signed `authenticate.admin`, WORK D1 Owner
policy, the explicit opt-in write gate and Google QA HMAC verification.
No guest/customer endpoint acquires merchant authority.

The local compiled workerd integration test verifies missing, null,
foreign, and LIVE origins receive 403 under simulated D1 and OAuth.
No live customer records are used.

## Re-stage corrected code, do NOT reactivate old candidate

This code must be built/uploaded into a **new inactive WORK version**.
`npm.cmd run work:hq:write-release:stage` uses a separate
`origin-guarded command release v2` message, so the previous staged
candidate cannot accidentally be selected as this fix.

After staging succeeds, record the NEW Cloudflare version ID.
The old activation command is deliberately blocked by the changed
release marker until its exact candidate ID is updated and reviewed
in a separate PR. Do not rerun the prior activation command or
delete the old version. Rollback remains to the original WORK Worker.

Current follow-up:
- get new inactive v2 version ID;
- validate the exact bindings and original active Worker unchanged;
- update the separately reviewed release command to pin that ID;
- retry only after explicit local approval and real HTTP 403 denial check.

Outbound email remains QUEUED ONLY. LIVE, KEEP, WORK Rewards and
Google QA are outside this source change.
