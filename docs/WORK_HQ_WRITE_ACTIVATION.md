# JILL HQ WORK — guarded release activation

## Verified staging checkpoint

- WORK Google QA HMAC handshake PASSED; no mutation.
- Original Cloudflare WORK deployed version:
  `e67a2209-f6d9-4671-b6fc-33994015af30`.
- Inactive key-only version (never deploy this):
  `6b70350e-0a5f-4630-8888-fe8a356a0a54`.
- Inactive **new application code + matching write key**:
  `a57b9b91-84e8-44db-bd2b-144646d5b342`.
- Staging regression suites, compilation, build, local OAuth integration,
  WORK D1/Owner/off and all original bindings: PASS.
- Email delivery still NOT connected: WORK queue remains QUEUED, not SENT.

The earlier version `e7bad727-b876-4895-866d-bc4dc583e280`
briefly activated but the anonymous command post-release check failed;
the guarded rollout reported successful rollback. **Never redeploy v1.**
New v2 was staged inactive after a real compiled Worker test confirmed
that requests with missing/foreign Origin receive 403 before Shopify.

V2 activation requires the anonymous POST to return **exact HTTP 403**
with a JSON `{ok:false,error:"invalid_origin"}` acknowledgment.
A Shopify redirect or generic 404/410 is not sufficient. The release
attempts automatic rollback after any failed post-release test.

The source PR adds **no deployment**. Local activation is the only
operation that can switch traffic, and requires direct confirmation.

## Owner procedure

1. From the exact clean, synced `jill/rewards-work` checkout run
   `npm.cmd run work:hq:write-release:inspect`.
   This is read-only and validates the exact active, inactive key-only,
   and full app versions, including the preserved Worker runtime.
2. Run `npm.cmd run work:hq:write-release:activate`.
   This repeats the integrity checks, re-runs the LIVE Google QA
   **non-mutating** HMAC handshake, and checks existing WORK health,
   OAuth, Owner setup OFF, and anonymous inbox denial.
3. Only when all gates pass, type the precise local approval:
   `RELEASE JILL HQ WORK MANAGEMENT`.
4. The script deploys ONLY the exact full WORK candidate at 100%.
   It checks health, login, Owner setup OFF, anonymous inbox denial,
   and denial of an unauthenticated POST to the command endpoint.
   If a post-release check fails while this exact candidate is active,
   the script attempts automatic rollback to the original version.
   If rollback is unconfirmed, **STOP** and inspect current deployment.
5. In signed-in **Shopify WORK Admin**, verify the two existing
   requests still render. Use a disposable, clearly labeled QA
   request to test an Owner-only status update from the inbox and
   then the detail page, observing canonical revision increments.
   Confirm My JILL displays customer-visible notes only for that
   request's verified Shopify customer, not another account.
   Negative tests: unrelated staff/customer denied, invalid transition,
   stale revision blocked, no duplicate retry events.
6. Customer messaging is a second test, after validating the outbox
   health: it records a My JILL event and QUEUES an email. No actual
   outbound email provider is enabled; never call it SENT/DELIVERED.
   Do not message a real customer during these WORK QA tests.

## What remains unavailable

Live email dispatch, provider webhooks/receipts, full historical merchant
details, quote/invoice/payment processing, Shopify fulfillment, and
real-time performance measurements are separate work. This release must
not claim those features are functional. LIVE/KEEP/Rewards are out of scope.

If the CLI stops, do not rerun before inspecting the active deployment
and inactive version list. Never share private keys or raw Cloudflare
secret metadata in screenshots.
