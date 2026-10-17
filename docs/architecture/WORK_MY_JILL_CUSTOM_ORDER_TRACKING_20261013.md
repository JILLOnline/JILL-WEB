# JILL WORK — owner-scoped Custom Orders tracking checkpoint (2026-10-13)

## Verified runtime evidence
- The new WORK form completed a real Shopify WORK app-proxy submission. A durable intake row and a corresponding `received` event exist in the isolated Google QA Sheet, not in LIVE.
- Private `CustomOrderOwners` contains an immutable Shopify Customer GID binding for that same submission ID. Do not use the form's free-text name/email/phone as owner identity.
- WORK Cloudflare /healthz: HTTP 200. Unsigned /jill-custom-order-proxy: HTTP 401. Anonymous /jill-custom-order-account: HTTP 401 `unauthenticated_account`. Probe results: https://github.com/JILLOnline/JILL-WEB/actions/runs/38471724912.
- The storefront Custom Order submit path works. WORK customer account app deployment/browser rendering is **not yet certified** by these source and route checks.

## Canonical owned tracking flow
1. Shopify-signed WORK storefront app proxy authenticates `logged_in_customer_id` at intake. The Cloudflare gateway signs the owner GID as an additional HMAC segment and Google stores it in `CustomOrderOwners` before intake. An anonymous guest request stays unowned.
2. On `My JILL → Custom Orders`, the extension requests a fresh `shopify.sessionToken.get()` JWT, sends a POST Bearer token directly to WORK Cloudflare (never through password-protected storefront app proxy), with NO owner/order/email/phone parameter.
3. Cloudflare validates the JWT signature, audience, shop, subject, timestamps and quota. It signs a strictly owner-scoped `customer_list` request to Google QA.
4. Google compares the verified customer GID against `CustomOrderOwners`, verifies the original saved payload hash, reads append-only `CustomOrderEvents`, and returns only status timeline plus bounded item title, quantity, date needed and pickup/shipping from the owned request.
5. Cloudflare validates/whitelists that summary, and the My JILL adapter sanitizes again. No internal notes, evidence, customer contact fields, raw payload or privileged metadata leave the backend.

## Implementation
- Isolated Google QA: `backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs` / `jillCustomOrderAccountSummary_`, projection, signed customer listing.
- Cloudflare: `backend/custom-order-account-read.mjs`, `services/custom-order-cloudflare/handler.mjs`.
- Signed-session adapter: `backend/customer-account-work-session.mjs`.
- Customer extension: `shared/customer-custom-orders.mjs`, `extensions/jill-account-dashboard/src/pages/CustomOrders.jsx`.
- Tests: `scripts/test-custom-order-ownership.mjs`, `scripts/test-custom-order-account-read.mjs`, `scripts/test-customer-custom-orders.mjs`.
- Source synchronized on ACCOUNT (WORK Shopify-connected storefront theme) and jill/rewards-work (the WORK customer-account app/Google deployment branch). DO NOT blindly merge either branch into THEME/LIVE.

## Guest email/phone association — security gate
**Not automatically implemented**. Matching a typed email or phone to an existing Shopify customer profile is NOT ownership proof. A typo or intentional impersonation could otherwise reveal a guest's private request in someone else's account. Build a separate explicit account claim flow:
- Signed-in WORK customer obtains a fresh JWT.
- Customer supplies a request ID, never arbitrary owner GID.
- Backend sends a short-lived, one-time code/link to the contact captured in the original submission, using an approved WORK-only email/SMS provider. It sends nothing until the customer initiates claim.
- The code must be rate-limited, single-use, hashed at rest, bound to request ID + verified customer GID + contact channel, and expire promptly. Compare it under an atomic claim lock.
- Once verified, write a distinct auditable guest-to-owner claim event; never reinterpret the original signed owner binding or permit changed-payload replay. Any previously owned request must fail claim.
- Re-check both WORK shop identity and the authenticated account token. Validate customer A/B denial and no user lookup via email/phone alone.
- No QA notification provider or phone OTP was provisioned, so do not claim this is live.

## Controlled rollout (no LIVE)
1. SOURCE: Ensure latest `jill/rewards-work` CI and `ACCOUNT` CI are all green, including WORK account ownership and project guards.
2. GOOGLE QA: From clean Windows checkout `jill/rewards-work` and the exact WORK QA sheet ID, run `npm.cmd run custom-orders:work:backend:update`. Confirm existing QA /exec deployment updated. Do not run setupJillRewards.
3. CLOUDFLARE QA: From the same branch, `cd services/custom-order-cloudflare`; `npm.cmd run build`; `npm.cmd run deploy`. Confirm /healthz 200 and anonymous account POST denied with 401. Do not change WORK/Shopify/separate gateway secrets.
4. ACCOUNT EXTENSION WORK PREVIEW: Return to repository root and run `npm.cmd run rewards:work:preview` to preview the exact isolated JILL WORK Rewards app `f8e1ebdbae84490dc8ea5b133637e6c0`. This is NOT deployed by Shopify GitHub *theme* sync.
5. Confirm approved `network_access=true` for the customer-account UI extension in Shopify, then test the logged-in original WORK QA owner on `My JILL → Custom Orders`.
6. Test logged-in customer B: no access to customer A request, and no guest request auto-claim. Check new item summary and status revisions, no private fields, reload and retry behaviors.
7. Only after A/B browser verification, and separate user approval, use guarded WORK-only Shopify app release. Never run the LIVE customer-account deployment workflow as part of WORK testing.

## Acceptance conditions
- Owner's recently submitted Coloring Books request appears only in their WORK My JILL account.
- Current status `received`, revision 1, timestamps, item/quantity, needed date and pickup/shipping display correctly.
- Merchant status change appended to `CustomOrderEvents` is reflected on next authenticated My JILL reload.
- Guest and unrelated account requests are invisible.
- Customer Account orders remain separate from Shopify's native paid Orders.
- Do not infer customer emails were sent: the isolated Google QA backend intentionally does not send them.
