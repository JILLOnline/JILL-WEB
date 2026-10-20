# WORK HQ Custom Orders — compact table rows (source-only review)

Status: **Committed to jill/rewards-work, NOT DEPLOYED**. No LIVE, gateway, Google QA, D1, R2, paid infrastructure, Shopify theme, quote, invoice or customer mutation.

## User-requested change

The desktop Requests listing is a **single full-width row per request**, replacing large multi-column cards. One shared header labels seven columns: **Customer | Request | Status | Stage | Needed by | Submitted | Actions**.

- Each row keeps verified exact-ID customer name, compact colored status pill, stage chip, date, clickable request ID, muted/archived status, **ORDER DETAILS** disclosure and **QUICK ACTIONS** dropdown. Full timestamp remains in the `title` tooltip; the row displays a shorter date.
- Customer name stays color-coded according to status and is truncated to one line with a native tooltip; the canonical nine-field list remains unmodified. Names still come only from Owner-authorized exact request detail reads.
- Thin neutral row separators, alternate surface shading and a 4px status-color leading bar distinguish orders without wasting height.
- Order Details now uses an accessible, keyboard-operated `button` with `aria-expanded` and `aria-controls`, expanding a full-width section **under** its row in normal document flow. The content remains the verified `WorkOrderDetailsContent` and is loaded on demand.
- Quick Actions stays compact in the Actions column, reusing the existing safe native dropdown. If status/message editor or feedback opens, CSS gives the editor a full-width second row rather than constraining inputs to the narrow Actions cell.
- Below 1160px, the lower-priority date columns hide; below 760px, the interface becomes a responsive two-column stacked row with all columns' essential content visible, including labelled dates and 44px touch controls.
- Do not introduce a nested vertical scrollbar, `position:fixed`, whole-body overflow lock, access to Shopify Admin parent frame or an independent UI data source.

## Release and tests

The last successful WORK Archive/Search deployment was version `ecf3bfd8-091a-4ef4-ae84-ad58c61ee92a` at 100% under deployment `5eaa3555-b7b5-4011-a180-fa430b247427`; 0% quote canary `dbc6341f-de7f-41de-8e97-6bf971201eeb`. This is historical evidence, **not a pinned new release baseline**.

The prior reviewed 21-file Archive/Search source is immutable and was successfully released. The new overlay `scripts/work-hq-table-rows-package.mjs` is a 21-file manifest differing in exactly the Requests route and its CSS. `scripts/work-hq-table-rows-build.mjs` creates an isolated 20-file runtime over certified source baseline `576d6b0bcde43c43fda939f42513eefcb5adefb7`; the proposed manual archive SQL remains excluded. The new **unique one-use WORK-only activation/restore profile** is `scripts/release-work-hq-table-rows-owner.mjs`, pinned to the last authenticated Owner readback (deployment `5eaa3555-b7b5-4011-a180-fa430b247427`, base version `ecf3bfd8-091a-4ef4-ae84-ad58c61ee92a`, base source `1adbdeb6e469cfd74f4d47a2aef29a5fbfe36b87`). Its receipt stem `work-hq-compact-rows-v1` does not reuse the spent Archive/Search release. A fresh read-only Cloudflare check is still mandatory before activating.

Offline checks:
- `npm.cmd run work:hq:table-rows:check`
- `npm.cmd run work:hq:table-rows:runtime:check`
- `npm.cmd run test:work-hq-table-rows`
- `npm.cmd run test:work-hq-inbox-ui`
- `npm.cmd run test:work-hq-customer-name`
- `npm.cmd run test:work-hq-archive-search`

WAIT until GitHub CI passes the actual App Home build. Prior to releasing, Owner must collect fresh read-only WORK runtime inventory, verify active version, annotation, exact 14 binding identities, health, no spent receipt reuse and 0% quote canary. Then prepare a **new, single-use WORK-only** release profile; old release commands MUST NOT be retried.

Authenticated Shopify Admin visual acceptance: verify real row alignment on wide desktop, columns in 1160px/760px breakpoints, long names, archive and all view results, quick menu/editors and detail expansion, keyboard/scroll. The release is not accepted until this browser review succeeds.

Offline new release certification: `npm.cmd run test:work-hq-table-rows-release`. Owner modes: `npm.cmd run work:hq:table-rows:inspect` (read-only), `npm.cmd run work:hq:table-rows:release-once` (single guarded WORK activation) and `npm.cmd run work:hq:table-rows:restore-once` (owned recovery only). Do not retry a failed or unverified release; inspect existing receipts first.
