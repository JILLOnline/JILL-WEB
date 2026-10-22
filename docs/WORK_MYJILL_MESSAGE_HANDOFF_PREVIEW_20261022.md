# JILL My JILL — Custom Orders → Messages handoff (source-only)

October 22, 2026. Independent account-component preview branch
`jill/myjill-message-handoff-preview-20261022`, rooted at verified
`jill/rewards-work` baseline `b53b9f7f1146a0bad4b734a8e7f48c3ee66309f8`.

## What this builds
- A customer can use **View in Messages** from an authenticated Custom Order.
- The navigation carries a **local-only request selection hint**. It never
  adds an email, customer GID, request ID or JWT to a URL or backend lookup.
- The destination loads a **fresh signed Shopify session account list**, then
  selects the hinted request **only** if that owned request ID is returned.
- Resuming an in-flight draft after switching screens now **requires a receipt
  check** with the same operation ID. A stale busy flag cannot leave the reply
  composer locked, and a malformed/mismatched command cannot be retried.
- Custom Orders and Messages share **one in-memory reply draft/operation ledger**,
  preventing loss of the original idempotent operation ID after an uncertain
  send when navigating between tabs. The backend receipt-checking contract
  remains unchanged. Each fresh account read prunes drafts to authorized IDs.
- Failed customer account reads clear the in-memory ledger. No draft is stored
  in localStorage, sessionStorage, a database, or a second message service.
- My JILL Messages now distinguishes **verified requests/status-only history**
  from actual verified v2 conversation threads. No unread/delivery claims.

## Release boundary
- This branch **does not modify or disable** M1/M2 source locks, seven protected
  historical files, or previous WORK deployment records.
- This account-side source change is **NOT** an authorized Shopify extension
  deployment, Google gateway activation, Cloudflare upload, LIVE/KEEP change,
  or customer-message write.
- A separate extension build, signed Customer A/B tests, active Google WORK
  published-source proof, and release acceptance remain required.
- Current WORK HQ stays at `f80335de-98ea-4831-b00e-87cd1a397596` /
  `44ad4a81-55ad-4f49-9965-61260cc2294d` @ 100% unless independently
  verified otherwise. Messaging provider flag remains OFF.

## Offline test
`node scripts/test-work-customer-message-navigation.mjs`
`node scripts/test-work-message-inboxes.mjs`
`node scripts/test-work-conversation.mjs`

Do not replay spent Cloudflare upload or activation receipts or use LIVE customer
accounts for exploratory writes.

## Customer-account source release gate
- `node scripts/audit-work-myjill-message-extension-source.mjs` validates the
  Shopify extension target, `api_access=true`, `network_access=true`,
  exact WORK Cloudflare host, same-host reply endpoint, signed customer
  account reads, and the default OFF conversation writer.
- Negative tests reject LIVE host references, changed extension capability,
  foreign reply endpoints, unconditional writer activation, and unsigned
  request selection. No network calls or provider mutations occur.
- A passing source contract is **not** evidence the declared permissions
  have been published or approved in the currently running Shopify extension.
