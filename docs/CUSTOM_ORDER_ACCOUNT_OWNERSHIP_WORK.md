# My JILL WORK Custom Orders — authenticated ownership bridge

Status: IMPLEMENTED IN WORK SOURCE, NOT DEPLOYED TO GOOGLE QA/CLOUDFLARE/SHOPIFY. LIVE untouched.
Scope: `jill/rewards-work`, JILL WORK Rewards app, `jill-work.myshopify.com`,
existing Cloudflare `jill-work-custom-orders-qa` and isolated Google QA spreadsheet.
This is the next backend phase after successful real merchant/ingress QA.

## Evidence already established (2026-10-12)

- An actual signed Shopify WORK storefront POST reached Cloudflare and persisted
  one synthetic submission in the isolated QA Google Sheet.
- A separate signed receipt verified intake and the initial append-only event.
- Replay of the same immutable request returned 200 duplicate without new rows;
  same submission ID and changed data returned 409.
- An authorized merchant advanced revision 1 received/new to revision 2
  reviewing/needs_quote. Exact merchant replay succeeded as duplicate.
- Stale revisions, illegal transitions, and reused operation IDs with changed
  content were rejected. No unauthorized event appeared.
- The account screen is now wired in WORK source only; the released WORK app
  still uses its previously proven extension version, not this new read endpoint.

## Canonical owner and data flow

1. **Submission/ingress (unchanged authority).** The storefront posts to
   Shopify WORK app proxy `/apps/jill-custom-order`; Cloudflare verifies
   Shopify's app proxy signature, shop, timestamp, origin, payload and rate
   quota. Existing Google QA Apps Script is canonical for Submissions,
   CustomOrderEvents, merchant commands and immutable receipt IDs.
2. **Attach immutable ownership ONLY from verified identity.** On an actual
   signed-in storefront submission, Shopify may append
   `logged_in_customer_id` in the Shopify-SIGNED proxy query. After
   verification, bind it to the corresponding Shopify customer GID using
   the expected shop and store-scoped numeric ID. Never accept a
   `customer_id` or `owner_gid` field from a posted form, email or
   client-selected submission ID as identity proof. Guests remain UNOWNED.
   Do not replace the existing immutable Submissions payload or invent
   status rows. The eventual ownership ledger must make an ownership
   change/competing claim fail closed. Ownership must not be conferred by
   replaying a guest submission while logged in.
3. **Separate immutable ownership index.** Use exactly one canonical
   source of truth for `submission_id -> owner_customer_gid`, in the
   isolated QA backend (a new, reviewed `CustomOrderOwners` ledger, not
   extra status columns or a parallel second worker). The index must
   be written under the existing intake lock, BEFORE saving a new verified
   signed-in submission; the Shopify-verified owner GID is a FIFTH mandatory
   gateway HMAC segment. This prevents a guest replay from claiming an
   old order; an interrupted row write can only be retried by the original
   signed customer using the identical raw payload. Existing source and
   event ledger fields remain unchanged.
4. **Read from an authenticated Customer Account extension.**
   In `customer-account.page.render`, request a fresh
   `shopify.sessionToken.get()` just before contacting the Cloudflare
   account read endpoint. Use `Authorization: Bearer <JWT>` in a
   POST; never put the token, customer ID or secret in the query string.
   Shopify's current docs require `network_access=true` on the
   customer-account UI extension and Partner authorization for external
   requests. UI-extension requests have a null origin, so CORS must
   permit the extension in the documented manner; CORS is NOT an
   authorization mechanism.
5. **Validate identity server-side.** Cloudflare verifies the token JWT
   signature using ONLY the correct WORK app's private client secret,
   requires the expected `aud` (the WORK app's client ID), expected WORK
   `dest`, validity window (`exp`, `nbf`, `iat`) and an authenticated
   `sub` shaped as a Shopify Customer GID. Do not trust decoded claims
   without signature verification; reject anonymous tokens and mismatched
   stores. Never accept customer IDs supplied in the request body, query or
   HTTP headers as authorization to another customer's orders.
6. **Server-side scoped read.** The verified customer GID is the
   ownership lookup key. Cloudflare calls the isolated Google QA backend
   with a separate short-lived, internally signed read action and requests
   ONLY that customer's owned submissions. The Google side checks the
   signature and ownership index before returning a minimal projection of
   the existing event ledger. Never expose public `doGet` history,
   spreadsheet URLs with private data, or unrestricted ID lookups.
7. **Display is read-only.** `My JILL > Custom Orders` shows the
   `submission_id`, current public status, `revision`, `updated_at`,
   and timeline of `status`, `public_note` and timestamp only. Never
   return `internal_note`, `internal_status`, staff emails, `actor`,
   `evidence_ref`, marketing fields, raw payload, full addresses or
   privileged merchant events. Keep Shopify native Orders separate from
   custom requests.
8. **Guest requests.** Do NOT attach guests retroactively by matching
   typed email to their account email, a Shopify customer metafield,
   or `last_custom_request_id`. An explicit one-time, short-lived,
   independently verified claiming/ownership process is a separate
   feature and must have its own replay and takeover defenses.
   Until that exists, the guest sees a safe empty/claim-help state.

## Existing code owners — do not duplicate

- `backend/shopify-work-app-proxy-auth.mjs`: existing signed shop-proxy
  verifier; exposes signed `loggedInCustomerId` once verified.
- `backend/custom-order-gateway.mjs`: canonical storefront submission
  validation; rejects caller-supplied owner/gateway signing fields,
  signs verified Shopify owner into Google intake and receipts. Bounded
  upstream reader is reused by account history, no new transport owner.
- `services/custom-order-cloudflare/handler.mjs`: WORK Cloudflare adapter.
  Existing app-proxy ingress remains separate. The distinct
  `/jill-custom-order-account` path requires a verified customer JWT;
  CORS wildcard is only for this bearer-authenticated read endpoint.
- `backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs`:
  canonical append-only event ledger and merchant-authorized controls.
  Keep the customer projection internal and least-privileged; no public
  status-read or status-write handler.
- `extensions/jill-account-dashboard/src/pages/CustomOrders.jsx`:
  one screen owner, now fetches signed-in WORK customer timelines via
  `shared/customer-custom-orders.mjs` with safe loading/error/empty states.
  No write actions and no email lookup.
- `extensions/jill-account-dashboard/src/hub/ConnectedHub.jsx`:
  one authenticated connection owner; no duplicate API pollers.
- `extensions/jill-account-dashboard/shopify.extension.toml`:
  WORK source declares `network_access=true`. The published app version
  is unchanged. Partner-approved external network access is a separate
  release gate; do not promote the capability without verification.

## Non-negotiable negative tests

- Customer A may list only A; Customer B cannot list or guess A's ID.
- Verified WORK token only; reject invalid signature, wrong `aud`,
  wrong `dest`, expired/early, missing `sub` and guest tokens.
- App proxy signature without customer identity cannot confer ownership;
  client-supplied `owner_gid` or URL `submission_id` does not suffice.
- A guest intake can remain guest; logged-in replay cannot claim it.
- Same submission/owner registration is idempotent; different owner
  registration, altered payload or late claim must fail closed.
- A customer's account response excludes all private merchant fields.
- Stale revision and invalid merchant transitions continue to fail.
- Never permit customer account reads to mutate Rewards points/coupons.
- No Google spreadsheet export, customer list, arbitrary public status
  endpoint, or LIVE theme/app/backend deployment as part of the bridge.
- Network capability must be explicitly validated against the actual
  customer-account UI extension and its approved external access.

## Staging and cutover gates

A. **WORK source implemented:** pure JWT verification, strict HMAC owner
   registration with immutable owner index and scoped projections. Unit
   tests exercise guest takeover denial, owner conflict, corrupted index,
   forged tokens and cross-customer privacy.
B. **Needs controlled WORK deployment:** new Google QA owner/read handlers,
   followed by updated Cloudflare Worker and WORK account canary. Existing
   Submissions and CustomOrderEvents contracts are preserved.
C. Validate a new synthetic, **authenticated** WORK customer request,
   owner binding and A/B privacy denial. Existing anonymous synthetic
   record is purposely unowned and MUST remain invisible to accounts.
D. Seek Shopify Partner approval for network access; then validate the
   WORK account extension, stage with `--no-release`, and certify loading,
   empty, error and actual authenticated results in the browser. Do not
   auto-release the existing JILL WORK Rewards version.
E. After security QA, audit UI/UX. Only after separate user approval
   prepare a LIVE migration with exact endpoints, secret rotation,
   private data access, backup, manual gated release and rollback.

Official Shopify guidance:
- https://shopify.dev/docs/api/customer-account-ui-extensions/latest
- https://shopify.dev/docs/api/customer-account-ui-extensions/2025-10/target-apis/platform-apis/session-token-api
- https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies


## WORK-only controlled deployment sequence (not yet executed)

1. Confirm a passing source CI run for the exact `jill/rewards-work` SHA.
   The Apps Script changes DO NOT update an already deployed Google /exec.
2. In the **local Windows PowerShell**, run:

       cd C:\Users\itzen\JILL-WEB
       git switch jill/rewards-work
       git pull --ff-only
       $env:JILL_CUSTOM_ORDER_WORK_SHEET_ID = "1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA"
       npm.cmd run custom-orders:work:backend:update

   The updater refuses dirty source, wrong branch, wrong sheet/project,
   unrecognized historical remote source, missing exact existing /exec
   deployment, and a local SHA that differs from origin. It will update
   ONLY the existing JILL WORK Custom Orders QA Apps Script deployment.
   It neither deploys WORK Rewards nor changes production accounts.
3. In the QA Apps Script editor, run **jillCustomOrderQaPreflight** and
   confirm scope `WORK_CUSTOM_ORDERS_QA`, proper private secret, verified
   headers and authorized operator. Never run `setupJillRewards()` here.
4. **Only after step 3**, deploy the new Cloudflare Worker:

       cd C:\Users\itzen\JILL-WEB\services\custom-order-cloudflare
       npm.cmd run build
       npm.cmd run deploy

   This preserves the existing three Cloudflare Worker secrets and the
   SQLite Durable Object. Do not create a new Worker/domain/account.
5. Smoke-test `/healthz` and existing storefront `probe=1`: HTTP 200
   and HTTP 400 `invalid_submission` respectively. Verify existing
   unowned synthetic submission is NOT visible in signed-in accounts.
6. Arrange Shopify's required `network_access` approval for the WORK
   account extension. Only after approval, prepare and preview its
   template canary. Do not release the extension to production customers
   or replace the proven Rewards Dashboard entrypoint.
7. Use two distinct, signed-in **WORK test customers**, submit a
   synthetic request while signed-in as A, verify the new
   `CustomOrderOwners` mapping, check status received then update
   reviewing using the authorized merchant desk, and confirm A sees
   the timeline while B cannot. The prior QA guest request stays
   UNOWNED even if the form email matches a Shopify customer.
8. Production migration, data backup, coupon regression, real-user
   privacy verification and rollback remain separate later approval gates.

## Important implementation boundary

The new Apps Script `customer_list` operation is a backend-to-backend
HMAC-authenticated POST, NEVER a public unauthenticated account data API.
The Cloudflare direct account endpoint requires an independently verified
Shopify Customer Account JWT issued for the exact WORK app and shop. Shopify
notes that customer-account extension fetches to password-protected shop
app proxies are unsupported, so the account **read** uses direct HTTPS to
Cloudflare instead of the storefront proxy. Submission **writes** retain
the proven Shopify app proxy.

`CustomOrderOwners` is restricted to isolated QA. Its HMAC signed
customer ID is stored in a private sheet, not in public order responses.
The production/live Apps Script will refuse owner registration/list
until a separately certified production migration changes its runtime
gate deliberately.
