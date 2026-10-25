# My JILL — customer visual polish source pass
Date: October 25, 2026
Scope: Draft PR #156; ephemeral HQ/My JILL integration PR #159
Release state: **SOURCE ONLY — NOT A SHOPIFY BROWSER SCREENSHOT**

## Design direction

**Warm, light and celebration-forward, without over-designing a secure
Shopify Customer Account page.** Use Shopify-native s-page, s-section,
s-box, s-stack, s-select, s-button, s-text, s-heading and status badges
instead of unsupported CSS or a second theme. Native controls should
inherit approved Shopify store design characteristics; this source
pass does not hardcode new brand colors.

### 1. Welcome first, verified activity second

The main customer Overview now reads top-to-bottom:

```text
MY JILL  · Your celebration corner
Welcome back, [signed-account name] ✨
Your ideas, custom creations and happy little details…
[My Custom Orders] [Open Messages]

PICK UP WHERE YOU LEFT OFF
  Signed recent request #1 · actual status badge
  Last verified update · brief status detail
  [Track details] [Conversation]

A LITTLE EXTRA FOR YOU
  Your verified Rewards balance, or Not available
  [See my Rewards]
  Coupons & offers
  [Explore Coupons]

MORE WAYS TO CELEBRATE
  Contact Requests · Not connected yet
  Celebrations & favorites · Coming later

Your everyday JILL orders
[Shopify Orders] [Profile & addresses]
```

The state of a customer request is never inferred from the hero or
from cached Rewards values. Recent activity continues through the
canonical signed customer-request reader; the status detail comes from
`customOrderStatus`. Missing/failed account data remains unavailable,
not a fake zero.

### 2. Compact account section selector

Removed the prominent always-visible nine-button toolbar in favor of
a single labeled Shopify-native section selector populated from the
**same nine `HUB_ROUTES`**, plus direct Home, Custom Orders and Messages
buttons. The active category is shown as a small badge. There are no
route ID, destination, browser history, or account ownership changes.
The Contact Requests route remains disabled by default.

### 3. More readable conversation cards

The existing verified conversation events now have clearer author
badges (JILL / You), timestamps and subtle native box treatment.
They still come from exactly the same server-authorized projection;
the original RequestConversation/receipt-backed sender is untouched.
No new messaging counts, inferred delivery/read receipts or local
account storage were introduced.

### 4. Visual and accessibility boundaries

- Native label on the section selector, explicit action labels, and
  badges with **text**, not color as the only status signal.
- Single-column Rewards, activity and conversation layouts remain
  narrow-screen friendly. Visual phone/tablet/desktop QA is still
  required; static CI does not prove actual line wrapping or contrast.
- Missing features are visibly marked *Not connected yet* or
  *Coming later*, never presented as working integrations.
- No external images, remote fonts, CSS injection, scripts, browser
  localStorage, Shopify Admin API or network additions.
- The signed account GID and customer JWT are never displayed in
  navigation. The separate Shopify principal fence still hides
  customer screens until authentication is verified.

## Source test and release gate

`scripts/test-myjill-visual-polish-source.mjs` verifies the
canonical nine-route picker, original security flags, top-to-bottom
Overview hierarchy, verified status projection, account-owned message
sender invariants, and the absence of unsafe source additions.
It is included in dedicated My JILL Preact/home CI and the
ephemeral three-branch HQ + My JILL + visual rehearsal.

The last targeted My JILL source run passed, but this document is
**not** evidence of a real authenticated browser render or a
pixel-perfect mobile screenshot. The isolated Shopify WORK
`myjill:work:preview:signed` path is prepared, not launched. The
historical broad account release certification remains blocked.

**No extension publish, live Shopify traffic, Cloudflare/D1 migration,
customer write, enabled Contact V2, paid resource, LIVE/KEEP or
existing deployed WORK modification is authorized by this pass.**

Next actual visual acceptance requires explicit authorized WORK CLI
dev preview, account A/B/guest switching, and review at 375–390 px,
768 px and 1280–1440 px with synthetic customer accounts. Check menu
focus/selection, long product titles, points unavailable/loading,
message badge wrapping and the active RequestConversation actions.

## Customer journey clarity — October 25 source increment

The customer-facing experience now does more than list statuses:
a presentation-only `customOrderNextStep` map explains the **next
safe customer action** for every supported signed Custom Order status.

- **Received / Reviewing:** where to check for the next confirmed
  update; no fabricated response deadline.
- **Awaiting approval:** review the latest conversation and tracking,
  with an explicit note that **quote approval and payment are not
  available on this screen**.
- **In production:** visible creation progress without promising a
  delivery or completion date.
- **Ready for pickup:** check conversation and confirm collection
  arrangements before traveling; no inferred pickup time.
- **On hold:** review the current history and message context.
- **Cancelled:** preserve the request record without implying a
  refund or payment outcome.
- **Completed:** thank the customer and keep history accessible.

The same verified status guidance appears on **Home → Recent Requests**,
**Custom Orders** and **Messages**, using the existing signed account
readers, `customOrderStatus`, safe message selection and original
reply composer. No new API, status writer, payment route or owner
identification has been added.

The empty and unavailable states are more approachable: customers
see understandable copy about where their next Custom Order will
appear, that guest submissions remain separated for privacy, and
when replies are unavailable. Internal WORK-development wording
was removed from customer-visible messaging. If Shopify identity
cannot be verified, My JILL clearly explains why private request
history is hidden until the account is refreshed.

`scripts/test-myjill-customer-next-step-journey.mjs` guards all eight
status-specific next steps, rejects fabricated approval/payment,
delivery and refund claims, and verifies the same customer journey
copy is sourced from protected account views. Dedicated My JILL
source/Preact and ephemeral HQ integration CI run the test.

**Release condition unchanged:** source-only drafts, no real Shopify
authenticated browser acceptance yet, no customer extension publish,
WORK Cloudflare/D1 write, LIVE/KEEP change or paid service. Actual
signed-account mobile/desktop acceptance is still required.
