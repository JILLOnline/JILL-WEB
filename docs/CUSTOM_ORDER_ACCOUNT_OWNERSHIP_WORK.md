# My JILL WORK Custom Orders — authenticated ownership bridge

Status: DESIGN / IMPLEMENTATION GATE — not customer-facing, not LIVE.
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
- Current `CustomOrders.jsx` is deliberately a placeholder; no production
  account history can be inferred from these tests.

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
   be written by an internally signed gateway operation using a distinct
   action and strict receipt; conflicting owner IDs are rejected.
   Verify the intake exists, submission ID and payload hash are unchanged.
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
  validation, Google signature and receipt ownership, unchanged for
  the future account READ route.
- `services/custom-order-cloudflare/handler.mjs`: Cloudflare adapter.
  Add an explicitly separate authenticated path; do not replace signed
  app-proxy ingress or relax its origin validation.
- `backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs`:
  canonical append-only event ledger and merchant-authorized controls.
  Keep the customer projection internal and least-privileged; no public
  status-read or status-write handler.
- `extensions/jill-account-dashboard/src/pages/CustomOrders.jsx`:
  one page owner; currently a truthful disconnected placeholder.
- `extensions/jill-account-dashboard/src/hub/ConnectedHub.jsx`:
  one authenticated connection owner; no duplicate API pollers.
- `extensions/jill-account-dashboard/shopify.extension.toml`:
  currently `api_access=true` but NOT `network_access=true`.
  Do not enable or release before network permission/access review.

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

A. Implement pure JWT verification, owner-binding domain and scoped
   projection tests locally. Negative privacy tests must pass.
B. Build a WORK-only Google QA ownership/read operation behind the
   gateway's distinct internal HMAC action and QA spreadsheet. Preserve
   existing Submissions and CustomOrderEvents contracts.
C. Validate a new synthetic, **authenticated** WORK customer request,
   owner binding and A/B privacy denial. Existing anonymous synthetic
   record is purposely unowned and MUST remain invisible to accounts.
D. Enable customer-account external network capability only when
   Shopify confirms approval. Stage with `--no-release`; certify
   extension loading, loading/error/empty states and actual secure
   read results in the browser.
E. After security QA, audit UI/UX. Only after separate user approval
   prepare a LIVE migration with exact endpoints, secret rotation,
   private data access, backup, manual gated release and rollback.

Official Shopify guidance:
- https://shopify.dev/docs/api/customer-account-ui-extensions/latest
- https://shopify.dev/docs/api/customer-account-ui-extensions/2025-10/target-apis/platform-apis/session-token-api
- https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
