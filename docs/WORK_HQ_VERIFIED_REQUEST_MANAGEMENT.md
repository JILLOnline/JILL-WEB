# JILL HQ WORK — signed request management, My JILL and email queue

## Strict environment boundary
Source branch: `jill/rewards-work`. Deployed merchant: WORK only.
Neither merge nor CI deploys. LIVE, KEEP and Rewards stay unchanged.
The merchant dashboard is still read-only until a separate, audited WORK
commissioning sets `JILL_WORK_MERCHANT_WRITES_ENABLED=true`.

## One source of truth
- The signed-in Shopify Admin Owner uses the same WORK D1 identity/authority
  boundary for status writes as for reads. No team grant or customer token
  can call `requests.write`.
- POST `/app/requests/command` requires a WORK Owner session, same-origin
  POST, bounded form, unique operation ID and explicit expected revision.
- A NEW, separate `JILL_HQ_MERCHANT_WRITE_SECRET` (32+ random characters)
  signs every command to the pinned Google QA /exec. It must be present
  independently in the canary Worker and isolated QA Script Properties.
  NEVER reuse the existing read secret, Shopify app secret, or gateway key.
- Google QA verifies HMAC, shop, staff identity, timestamp (±2 minutes),
  nonce shape and duplicate signed parameters. LIVE and Rewards WORK reject.
- The actual canonical `jillCustomOrderMerchantUpdateAsActor_` still enforces
  revision CAS, status transitions, immutable event IDs and append-only
  `CustomOrderEvents`; desk UI and Shopify Owner now share ONE writer.
- On a confirmed update, invalidate the short-lived metadata cache; do
  not infer source success from a timeout. Retry only with the SAME operation
  ID after an ambiguous response.

## Two different actions
**Update status** changes the public status / private stage and may add a
private note or an optional customer-visible note. Notes visible to customers
flow through the existing verified, customer-ID-scoped `My JILL` tracking
timeline. Production status does NOT by itself send email.

**Message customer** appends a same-status public event to
`CustomOrderEvents`; this appears in `My JILL` for the verified request
owner when that extension is deployed and reads the new revision.
The same operation ID produces one private outbox record in the QA
`CustomOrderMailOutbox` sheet, with recipient taken solely from the
original immutable `Submissions` request after email/payload verification.
The UI says **email queued, not sent**. Guest submissions are never silently
linked to My JILL by matching an email/phone.

## Deliberate email delivery boundary
Google QA has NO mail scopes and **does not send email**.
`QUEUED` is not `SENT` or `DELIVERED`. No message should claim a delivery
until a separate, approved WORK-only dispatcher/provider is installed,
receipt IDs are persisted, retries are controlled and provider webhooks are
authenticated. Never write directly to LIVE mailing services or use Shopify
Admin's generic notification actions as a shortcut.
No mail provider credentials are in this repository.

## Operational release gates
1. Source CI all green, including `test:work-hq-merchant-command`.
2. Independently audit the isolated QA Apps Script deployment, headers,
   security and original customer ownership, then deploy the reviewed
   QA source. Verify HMAC tampering, replay idempotency, unauthorized staff,
   stale revision and email queue recovery against disposable QA requests.
3. Store WRITE secret only in private WORK QA Script Properties and the WORK
   canary Worker; never in tracked source, screenshots or PowerShell history.
4. Release a separately reviewed canary Worker version with the explicit
   write-enabled flag, after validating preservation of all existing secrets,
   D1, Owner commissioning OFF, OAuth ON, and correct traffic routing.
   The previous guarded **read-only** rollout script is not a write release.
5. Test both real WORK requests in Shopify: one status update from inbox,
   one from detail, stale edit rejection, resulting My JILL revision for
   verified customer A, denial for unrelated customer B. Inspect outbox
   QUEUED records privately. No real email sending at this stage.
6. Only after provider/outbox delivery implementation and verification,
   enable email dispatch behind another explicit approval.

## Performance
The Owner-only 20-second source cache stays in place for read requests.
After a successful canonical write in the same Worker isolate the cache
is invalidated. Other isolates may show the previous verified snapshot for
at most 20 seconds; a later improvement may use versioned invalidation.
Never display optimistic statuses as committed. Status updates and messaging
remain disabled when the WORK write secret/flag is absent.
