# WORK HQ Requests: whole-row order disclosure and direct action buttons

Status: **GitHub WORK SOURCE ONLY, NOT DEPLOYED.** No local PowerShell, Cloudflare upload, Shopify extension release, theme deployment, D1/Google source or LIVE change.

## User-approved Requests layout

The existing seven-column Requests list stays intact. The six information columns (Customer, Request ID, Status, Stage, Needed by, Submitted) are grouped into a **single native `button`** spanning the row, with `aria-expanded`, `aria-controls`, a meaningful screen-reader label and an adjacent rotating request chevron. The whole information area, not just a tiny ORDER DETAILS button, now opens/closes **verified Order Details** in the normal document flow under its row. Keyboard Enter/Space triggers the native button. The expanded panel preserves the Owner-only exact-ID detail read and contains an `Open full request →` link so the full request workspace remains available. It does not navigate merely on row click.

The Actions column is **separate from the opener**, so clicking its buttons cannot accidentally expand the details. The centered `QUICK ACTIONS` menu is no longer used on the Requests list. Two direct buttons instead open the existing canonical editors: **Message customer** and **Update status**. The underlying source-revision, Owner permission, operation ID, My JILL message/outbox and Google acknowledgment logic is not modified. Other HQ consumers of `WorkRequestQuickActions` still have their previous menu/standard presentation.

CSS uses CSS grid subgrid for exact header/row alignment in Chrome Shopify Admin, with the existing 1160px and 760px breakpoints and independent mobile layout. An active status/message editor occupies a full-width second grid row. The expanded detail area occupies normal page height, `hidden` when collapsed. No fixed overlay, iframe scroll override, body lock, nested vertical scroll or new data store.

## Review gates

- `npm.cmd run test:work-hq-row-disclosure`: no nested interactive element inside the row button, accessible aria state, six-cell layout, independent actions, unchanged command endpoint, 1160px/760px layout, normal document scrolling, and no forbidden commerce/browser workarounds.
- `npm.cmd run work:hq:row-disclosure:check`: new immutable source-only edition covering **37 distinct reviewed files**. Four UI files have new fingerprints; all previous reviewed backend, archive, Catalog, Messaging, Quote and P1/P2 files are unchanged. Previous deployment receipts and frozen historic manifests are not repinned.
- `npm.cmd run test:work-hq-inbox-ui` and `npm.cmd run test:work-hq-customer-name`: current UI tests updated to the new native clickable row without weakening Owner-only customer-name reads or archive/search.
- GitHub CI must also pass the actual WORK React Router app build, isolated workerd/runtime tests, Owner permission checks and Cloudflare dry-run before considering a new release. Do not run the already-spent compact-row or Archive/Search release-once commands.

Authenticated WORK visual QA is required later (not yet done): test row toggling with mouse/keyboard and multiple orders, action editor independence, active/archive/all folders, long customer names, narrow Shopify Admin width, full request link, natural scroll expansion, read-only mode, and customer-message approval/acknowledgment. No deployment until the user explicitly requests a push.
