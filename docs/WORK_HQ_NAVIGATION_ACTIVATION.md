# JILL HQ WORK — activate faster request navigation

## Verified baseline and staged build

The owner completed guarded navigation staging on 2026-10-15.

- Current active management v2 (rollback target):
  `a57b9b91-84e8-44db-bd2b-144646d5b342`
- New **inactive** fast inbox/workspace version:
  `e818c639-f962-4a09-9399-54ab521531c3`
- All eight requested regression tests, typecheck, client/server build,
  compiled Cloudflare/workerd OAuth route and anonymous command 403: PASS.
- Stage verified **four** WORK secrets, WORK D1, OAuth ON,
  Owner commissioning OFF, merchant writes ON, identical routing.
- LIVE, KEEP, Rewards, QA Google scripts, customer events and email
  sending: unchanged. No request-status save yet verified remotely.

## Owner-only activation procedure

1. Sync the clean `jill/rewards-work` branch.
2. `npm.cmd run work:hq:navigation:inspect`: **read-only** version
   inspection using Cloudflare. Require exact active/candidate IDs, one
   unique candidate marker, no unexpected newer versions, all original
   bindings, changed code and preserved runtime.
3. If inspection passes, `npm.cmd run work:hq:navigation:activate`.
   The script repeats the version checks, re-probes the private Google QA
   HMAC key without mutations and verifies active WORK
   `/healthz`, `/auth/login`, Owner commissioning OFF,
   anonymous inbox denial and a command POST returning exact
   `HTTP 403` + `{ok:false,error:"invalid_origin"}`.
4. Only after these checks, the owner may approve by typing
   `RELEASE JILL HQ WORK NAVIGATION V1` locally.
5. Only the exact new candidate is then switched to 100% WORK traffic.
   The script checks new deployed version, WORK health, OAuth,
   Owner commissioning OFF, anonymous inbox access and exact
   command POST denial.
6. If deployment or any post-release test stops while the candidate is
   actually active, the script attempts automatic rollback to management
   v2. If rollback cannot be confirmed, STOP and manually inspect
   deployment status. Never rerun blind.

## Verify performance, not assumptions

Signed in to JILL WORK Shopify Admin as verified Owner:

- From HQ, open Custom Orders and inspect the **Server-Timing** header
  (merchant-auth, merchant-feed, merchant-total) and
  `x-jill-feed-cache` for the first/cold inbox response.
- Within 15 seconds click Open request workspace and Back to inbox.
  Parent metadata should be reused without a second Google read.
  Measure in Chrome Network with Preserve log. Sub-second perceived
  navigation is the target, not a guaranteed result.
- Open request workspace by direct URL in a fresh tab: Owner/D1
  authentication remains mandatory, with only the matching nine-field
  summary and no cross-request customer data.
- Test a disposable QA-only request revision via Update Status after
  the performance release. Confirm canonical Google update and
  fresh revision in both views, then test stale-write conflict.
- Customer message remains a My JILL public event plus
  **QUEUED** email outbox. No verified outbound sender exists yet.
  Do not send a QA message to a real customer.

Never activate with the earlier `work:hq:write-release:activate`.
Its expected versions are for the **previous** rollout.
