# JILL HQ WORK — Faster Custom Orders navigation staging

## Grounded active baseline

On 2026-10-15 the owner ran:
`wrangler deployments status --name jill-order-desk-canary-work --config ./wrangler.canary.jsonc`

The actual deployed version is **100%**
`a57b9b91-84e8-44db-bd2b-144646d5b342` — reviewed Owner-only
management v2 with Google QA read/write, four WORK secrets, OAuth ON,
Owner commissioning OFF, WORK D1, and explicit write opt-in.

The navigation improvement from PR #81 is **merged source**, not yet a
deployed Worker. Previous `work:hq:write-release:stage` scripts were
pinned to the **pre-management** `e67a2209...` baseline and must NOT
be used to stage the optimized dashboard.

## Inactive WORK-only performance stage

From the current clean, synced `jill/rewards-work` checkout run:

```powershell
npm.cmd run work:hq:navigation:stage
```

The new guarded script refuses to run if the currently deployed Worker
is anything other than management v2 `a57b9b91...`. It checks all
existing nine Worker bindings including **all four existing secrets**,
WORK D1, Owner OFF, OAuth ON, merchant writes ON, and stage canary.

It runs the Owner-only merchant/UI/performance/canonical mutation
tests and the real compiled local Cloudflare/workerd OAuth smoke,
typechecks/builds the React Router app, prepares a temporary
WORK canary manifest with existing write flag ON, and uses
`wrangler versions upload --secrets-file` with the existing dedicated
private-vault WORK key so that the new inactive version contains the
key. Wrangler preserves the other three secrets. The private temporary
file is deleted, and the new version is compared with the active one.

It refuses differences to any original binding, Worker entrypoint,
runtime compatibility or asset routing; only reviewed code and
compiled assets may change. **No traffic switch.**

Do not rerun after partial staging or an error without inspecting the
inactive versions; only one candidate with this unique marker is valid.

## Release plan after staging

1. Note the newly staged **inactive** version ID and confirm the active
   deployment has not changed.
2. Prepare a **separate**, pinned, reviewed WORK-only activation script
   using the exact new candidate and the verified management v2
   version for rollback; never reuse the earlier activation script that
   expects the read-only dashboard.
3. Before and after traffic switch, verify health, OAuth, Owner setup
   denial, an unauthenticated inbox request, and the exact anonymous
   command `HTTP 403, {ok:false,error:"invalid_origin"}` denial.
4. Compare DevTools timings: cold JILL HQ → inbox `Server-Timing` and
   `x-jill-feed-cache`; then inbox ↔ workspace inside 15 seconds.
5. On a disposable WORK QA request, test a real authorized status change
   with revision increment, a stale revision failure, and correct
   My JILL visibility. Email remains QUEUED, not sent.

Do not touch LIVE, KEEP, Rewards, Shopify app configuration or the
canonical Google QA deployment for this navigation optimization.
