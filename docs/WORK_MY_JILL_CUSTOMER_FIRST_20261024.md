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

## Contact V2 reply recovery across My JILL navigation

The original source-only Contact V2 editor kept the text and pending
operation in its own component state. Switching My JILL sections
unmounted it and could discard an uncertain save, encouraging a
duplicate retry.

Updated customer source:
- New `shared/customer-contact-draft-ledger.mjs`: in-memory
  ticket-scoped draft/receipt ledger retained by the **existing**
  `AccountHub`; no browser storage, URL query, account metafield,
  second conversation database or external sender.
- `ContactRequests` must first read a **fresh authenticated Customer
  Account ticket list**. Only the ticket IDs in that verified list
  are admitted into the ledger. Missing/duplicate/invalid list,
  not-connected mode and read error purge existing drafts.
  Old async callbacks cannot restore removed/foreign tickets.
- Switching sections and returning revalidates the ticket list, then
  resumes an uncertain operation as **unconfirmed** with the **exact
  original idempotency UUID, source reply sequence and immutable text**.
  It never auto-sends on navigation.
- A new incoming response cannot overwrite the pending operation;
  completion cannot clear a newer message or a different ticket.
  The editor clears ONLY through a ledger mutation carrying the
  **fresh signed V2 thread**, with exact ticket ID, customer author,
  source sequence and text. A stale read/POST acknowledgment is not
  enough. A delayed `finally` cannot undo a confirmed state.
- A customer may manually select *Check saved reply* or *Retry same
  reply*. A retry uses the existing operation; there is no second
  operation generated while an unconfirmed one exists.
- The Contact Hub entry still passes `enabled={false}`, so this code
  is source-only and no JWT, D1 query, email, reply or notification
  occurs in the deployed extension.

New source test:
`scripts/test-myjill-contact-draft-navigation.mjs` exercises
cross-screen resume, exact receipt reuse, confirmed public readback,
stale callbacks, invalid ticket lists and foreign ticket denial.
The dedicated My JILL Preact source CI and the three-lane HQ integration
both run it.

**Residual release gate:** before enabling in real customer sessions,
verify account switching and **ticket ownership reassignment** with
signed Customer A/B identities. Ticket ID alone must not be treated
as proof of immutable customer identity; account identity binding or
explicit purging on owner changes must be accepted in real WORK QA.
A successful source-only test is not permission to publish or
activate the Contact reply endpoint.

### Strict operation receipt correlation (race guard)

The Contact V2 ledger now distinguishes **an acknowledged operation**
from merely seeing the same text at the expected sequence. A separate
tab could have submitted the same text while our POST timed out; public
thread text alone cannot prove which idempotency operation succeeded.

The draft therefore keeps an optional `acknowledgedSequence` ONLY
after `postOwnedContactReply` returns the exact matching operation ID
and sequence. The editor clears only when BOTH are true:

1. The current pending command has its own verified server receipt
   (the exact operation ID and expected sequence).
2. A **fresh signed account read** contains the exact customer
   author, source reply sequence and message text on that ticket.

If the POST receipt is missing, a matching public message cannot clear
the editor. The customer can safely **Retry same reply**, using the
original operation ID; successful idempotent replay returns the
missing receipt without a second message. This is a conservative
user-experience trade-off. A newly typed operation is never generated
for an unresolved pending reply. Confirmation still does not assert
email, push delivery or a human read receipt.

`scripts/test-myjill-contact-draft-navigation.mjs` includes an
adversarial same-text/wrong-operation acknowledgment test; the
My JILL Preact source workflow verifies it. This protection is not
a substitute for real signed account A/B browser acceptance and
the still-unapproved release gates.

## My JILL mobile Custom Orders + Rewards clarity pass

The canonical Custom Orders screen now presents the **current verified
status first** and leaves the complete tracking timeline and request
details behind a labeled, reversible expand action. Customers can use
the **Conversation** shortcut immediately without opening a very long
history on a narrow phone screen. Expanded details retain every
existing timeline event, requested item/quantity, event date,
fulfillment, full reference and the current `RequestConversation`
component; no history, merchant status or ownership logic was removed.

From the same signed Customer Account order list, the pure
`myjill-order-activity.mjs` projection derives:
- total, active, and finished (completed/cancelled) counts;
- exact counts for `awaiting_approval` and `ready_pickup`;
- deterministic newest-update-first ID ordering;
- All / Active / Completed & cancelled customer filters.

These are **confirmed statuses only**: awaiting approval is not an
enabled quote acceptance action, ready for pickup is not a promise
of shipping, and they never imply a delivery ETA or unread count.
The projection rejects duplicate IDs, unknown states, impossible
revisions and invalid update dates; it emits IDs/counts, never
customer personal details, costs, customer GIDs or private notes.

The Home **Track details** shortcut now passes a *selection hint*
to Custom Orders, which expands that card **only after a fresh signed
list contains the exact request ID**. If unverified or belonging to
another account, no request detail opens. The original Messages
handoff and in-memory reply ledger remain unchanged; its existing
source assertion stays intact.

Rewards gained a simple customer-first introduction and "How your
rewards work" guide, with navigation to verified Coupons and
Custom Orders. This is **presentation only**. The exact
`RewardsCard` component, points calculation, wallet verification,
confirmation modal, redemption request/nonce, duplicate protection,
coupon expiry and Use Now integration are unchanged. The account
still fails closed if its wallet cannot be verified. Both Overview
cards and the needed-date/fulfillment fields use a single column
to avoid cramped two-column content on small screens.

`scripts/test-myjill-mobile-orders-rewards.mjs` checks all eight
canonical order statuses, counts, sorting, negative malformed source,
zero personal detail leakage, exact fresh signed selection, unchanged
message handoff and Rewards transaction ownership. The dedicated
My JILL source + Preact bundle workflow and ephemeral HQ / My JILL
integration preview passed after these changes. The full three-lane
CI also includes this test.

**Not published**. Real Shopify desktop/mobile visual acceptance,
actual Customer A/B/guest session tests, reward redemption/expiry
safety and a separately approved WORK-only Customer Account extension
preview remain mandatory. Nothing enabled in LIVE, KEEP or WORK.
