# JILL HQ WORK — shared D1 inbox accelerator (feature OFF)

## Why

The existing 20-second source cache is **per Cloudflare Worker isolate**.
A newly started Worker cannot reuse another isolate's Google QA result;
on a miss the React Router loader blocks until Shopify online Admin/D1
authorization and a signed Google Apps Script request finish. The signed
Google request is limited to 15 seconds, but full Shopify embedded
navigation (including retries) can take longer. Header timing from
PR #86 can isolate the true >60-second cause.

## Implementation in this PR

Migration `0003_work_verified_inbox_index.sql` adds exactly one
WORK-only row. It holds only the previously certified nine merchant
summary fields, a signed-source verification timestamp, expiration time
and monotonically increasing generation. This is a **derived index**, not
another authority; source of truth remains Google QA.

- Every page still runs Shopify online Admin auth and WORK D1 Owner
  authorization BEFORE accessing the index.
- A valid D1 hit returns immediately without an extra Google request
  across isolates. Cache TTL is 60 seconds; after that the source
  MUST be reverified. A manual `?refresh=1` query forces fresh source.
- A miss calls the existing signed Google reader, whitelists the
  result and atomically warms D1. Concurrent readers compare their
  original generation and start time before storing, so old Google
  responses cannot replace newer cache data.
- After a confirmed canonical status/message update, the Worker
  invalidates both per-isolate cache and the shared D1 generation.
  If D1 invalidation is uncertain **after** Google may have written, the
  existing command returns `commit_unconfirmed` for idempotent
  reconciliation rather than pretending it knows the view is fresh.
- No customer contact, raw request payload, notes, attachment,
  Shopify access token or source signing secret enters D1.
- Malformed or failed source returns are never silently substituted
  with stale/empty inbox data.

## Rollout safety — not automatically enabled

**Source merge is not deployment.** The feature is gated by exact
`JILL_WORK_HQ_FAST_INBOX_ENABLED="true"` on the future, WORK-only
Cloudflare release. No current Wrangler manifest includes this flag,
so until explicitly configured the app continues using its existing
Google reader and status command behavior.

Before enabling, require:
1. Confirm current WORK active Worker version and GitHub branch.
2. Run the exact isolated WORK D1 migration (never LIVE/KEEP), inspect
   table, scope, schema and single `jill-work.myshopify.com` seed row.
3. Run the index test and real browser cold-load instrumentation.
4. Stage a **new inactive Worker candidate** with all four existing
   secrets, original D1, Owner bootstrap OFF, OAuth ON, merchant writes
   ON and fast index flag ON; update expected binding count in guarded
   staging/activation scripts after review.
5. Verify DB cache warm, D1 hits on a second isolate, a legitimate
   disposable QA status update invalidating generation, direct URL Owner
   access, expired source read, and no cross-customer access.
6. Approve separate WORK-only activation with original active version
   retained for rollback.

If timings show Shopify OAuth/session navigation (not Google) causes
most of the minute, **don't enable D1 just to mask the wrong issue**;
fix that specific SDK/router path first.

No Google Apps Script deployment, Shopify Draft Order creation, new
public endpoint, LIVE changes, email sends or remote D1 write occurs
in this PR.
