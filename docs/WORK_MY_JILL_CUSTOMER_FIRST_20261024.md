# My JILL — customer-first experience pass (October 24, 2026)

## Release status
**SOURCE ONLY, DRAFT.** This changes the My JILL customer account
extension source and its isolated WORK canary/template. It does **not**
publish the Shopify Customer Account extension, change the deployed WORK
gateway or HQ Workers, run migrations, connect native Contact Us,
send messages, or modify LIVE/KEEP. Owner approval and authenticated
WORK visual acceptance remain mandatory before any publication.

## Improvements visible after a separately approved WORK preview

### My JILL Home / Overview
- Friendly welcome and direct primary paths to Custom Orders and Messages.
- **Signed recent activity**: the new `RecentRequests` component reads
  the exact same canonical `loadWorkCustomerConversationState` as the
  existing Custom Orders and Messages. Displays up to **three** newest
  verified requests, their real current customer status, and separate
  tracking/conversation actions. No new endpoints, customer directory,
  unsafely claimed guest forms, copied timeline store or fake unread
  counts.
- If the account token/read is unavailable, display an explicit
  verification error (not “zero requests”); if the signed response is
  valid but empty, display an honest guest-isolation explanation.
  On unmount or changed refresh attempt, abort the stale request.
- Rewards points come only from `loadAccountHubSummary`'s verified
  Shopify Customer Account projection. Missing points stay
  **Not available**, never zero; the actual RewardsCard still owns
  redemption authorization and wallet checks. Coupons unchanged.
- Cards for Coupons, Contact Requests, Celebrations and Saved for You.
  Native Shopify Orders and Profile/addresses remain canonical.
  Future Contact, celebrations and saved preferences are clearly
  labeled disconnected or coming later, never pretended live.

### Navigation
- The exact same nine `HUB_ROUTES` and `extension://` paths are grouped
  into **Your activity / Rewards & offers / Make it yours**.
- The existing Shopify account page, browser entry navigation,
  in-memory draft state and signed request handoff are preserved.
  No extra full-page extensions, new authentication or persistent
  customer-message storage.

### My JILL Contact conversation V2
- New `ContactConversationV2.jsx`, mounted separately from unchanged
  V1 `ContactThread` and passing through an explicit
  `v2Enabled=false` default. The ContactRequests parent requires
  **enabled AND threadEnabled AND replyEnabled** to expose V2.
  The app hub still supplies `enabled={false}` and no opt-in flags.
- Imports the **identical shared V2 signed client** used by the HQ
  three-lane draft. The Customer A JWT and exact claimed ticket ID
  are the only future authorization path. Customer B or guest is not
  matched by email, phone or name.
- Reply input (500 characters) uses an immutable idempotency operation
  ID and source-specific reply sequence. If a POST is uncertain, retain
  the text/operation and check the exact author, sequence and text via
  a *fresh signed account thread read* before clearing.
  Retrying uses the **same** operation ID and payload. No automatic
  duplicate sends, invented delivery/read receipts or notifications.
- Closure/full-thread/failed verification clearly disables new replies
  without discarding an existing uncertain operation. Switching
  tickets resets sensitive local UI state.
- Existing Contact V1 remains available in the original, separately
  gated route. This is source preparation for the future account
  interface; there is **no published customer reply composer today**.

## Source-only tests and build
`scripts/test-myjill-customer-home.mjs` verifies the authenticated
recent-order projection: stable ordering, capped records, zero PII,
invalid/duplicate history refusal, original 9 routes, and unchanged
Shopify native paths plus Rewards/Coupons/Messages protocols.

`scripts/test-myjill-contact-v2-source.mjs` verifies OFF blocks all
session/network activity, signed read and bounded V2 public projections,
wrong ticket/author/sequence/read receipts are refused, exact customer
command/receipt parity, and explicit triple feature gate.

`.github/workflows/jill-myjill-customer-home-preview.yml` runs those
and existing account template/conversation regressions, then compiles
the Preact customer account extension without publishing.
`scripts/prepare-account-hub-canary.mjs` now copies the extra
customer-home and V2 modules into the ignored WORK-only canary source.

A green source build is not a verified Shopify WORK customer session.
Before any release: review account layout on phone/desktop; test real
Customer A/B and guest account switching, signed order and Contact
claim isolation, ordinary Rewards/coupon redemptions, uncertain message
retries and exact readback, and do not publish before separate Owner
authorization. LIVE/KEEP must remain untouched.
