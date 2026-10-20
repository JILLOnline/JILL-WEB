# WORK HQ request card colors and scrolling — review hold

**Status:** Source-only change on `jill/rewards-work`; **not deployed**. This follows the un-deployed customer-name card source update and must not use any previously spent release receipts. No LIVE, Shopify theme, customer mutation, Google Apps Script, D1, R2 or paid infrastructure changes.

## Approved visuals

The Requests listing distinguishes cards by the **existing customer request status**, not private customer traits:
- Received: blue accent, pale blue name highlight.
- In review: amber accent, pale amber name highlight.
- Awaiting customer / on hold: warm copper accent.
- In production: purple accent.
- Ready/completed: green accent.
- Cancelled and unknown statuses: restrained slate accent.

Each card receives a **2px colored border + 4px leading accent**, a subtle shadow and 12px corners. Each verified customer name between CUSTOM ORDER and Request ID uses dark accent text and a soft tinted background. Long names are clamped to two lines and wrap safely. Status pills and the canonical customer status logic are unchanged.

## In-flow dropdown behavior

The original three-column grid uses `align-items:start`, which made opening one tall card leave an empty region beside it and feel disconnected from the page scroll. Expanded **ORDER DETAILS** now changes that card to `grid-column:1/-1`, keeping full content in the normal document flow and pushing subsequent cards down. The open Quick Actions disclosure and status/message editor follow the same full-row treatment via scoped `:has()` selectors. There are no fixed heights, nested vertical scrolling regions, global overflow locks, parent-frame manipulation or absolute overlays.

On opening Order Details, the card scrolls into view after React's layout update, using reduced-motion-friendly native `scrollIntoView` and `scroll-margin-block-start`. This may improve navigation within the Shopify embedded page, but only authenticated browser acceptance can establish whether Shopify Admin's **outer** scroll container cooperates. If the outer host scrollbar still stays stationary, inspect browser overflow/iframe boundaries rather than overriding Shopify Admin styles.

## Scope and next release

The visual files modified from the preceding frozen customer-name overlay are exactly:
- `services/jill-order-desk/app-home/app/routes/app.requests.tsx`
- `services/jill-order-desk/app-home/app/styles/inbox.css`

`scripts/work-hq-request-card-flow-package.mjs` freezes the final 13-file *presentation-only* overlay atop existing certified `DENSITY_RUNTIME_BASE`. No customer name is added to the nine-field canonical list; names still come from an Owner-authorized exact-ID signed detail call for visible cards.

Offline tests: `npm.cmd run work:hq:request-card-flow:check`, `npm.cmd run test:work-hq-request-card-flow`, `npm.cmd run test:work-hq-customer-name`, `npm.cmd run test:work-hq-inbox-ui`, `npm.cmd run test:work-hq-request-detail`. CI also builds App Home / isolated WORK canary without deploying.

Before any Cloudflare WORK activation: synchronize the clean WORK branch; verify CI and source checks; retrieve a **fresh read-only Owner inventory** for the current active HQ deployment, source annotation, health and 0% quote canary; create a new one-use release profile and clean receipts. Never reuse the earlier workspace layout release profile or run scripts tied to previous source blobs. Do not claim full browser scroll acceptance from static tests.
