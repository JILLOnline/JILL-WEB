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

## Customer reply availability: independent authenticated WORK capability

- Timeline-v2 status alone never authorizes a send. A signed customer-account
  response must now include Worker-derived `reply_enabled: true` before
  the My JILL composer enables a **new** message. Missing/legacy flags default
  to **OFF** so the already deployed gateway still reads requests normally.
- The WORK Worker calculates `reply_enabled` from its own
  `JILL_WORK_CONVERSATION_ENABLED==='true'` flag only **after** Shopify JWT
  authorization and Google public projection checks. The Google backend
  cannot grant this capability by inserting fields into its reply.
- The existing `loadWorkCustomerCustomOrders` array interface remains
  compatible; a new signed `loadWorkCustomerConversationState` returns
  `{orders,replyEnabled}` for My JILL messaging screens.
- Receipt verification of an already-submitted stable operation remains
  available even if new sends are currently disabled, to avoid abandoning
  an unconfirmed message.
- Independent releases are still REQUIRED: merging/publishing a customer
  extension does not automatically change the running WORK Cloudflare
  Worker, Google QA source, or any flags. This source change authorizes
  none of those mutations.

- In the account UI, a verified v2 timeline with a disabled reply capability now displays a **read-only history** banner rather than offering Send. Explicit verified replies become available only with the signed WORK enablement flag.\n
## Shared reply ledger concurrency gate — stale callback protection

- Every customer-draft update now carries the `expectedOperationId` observed
  by the composing screen. A null expectation may start a new reply only when
  there is no active command; a non-null expectation must exactly match the
  current immutable operation ID.
- The mounted My JILL hub applies updates ONLY to request IDs still in its
  freshly authenticated account-owned ledger. A late response after logout
  or customer-account change cannot recreate a removed request.
- Late success/error/finally callbacks from a prior screen can no longer
  overwrite a different or already-resolved reply command. Every actual
  completion clears `busy` atomically with that same command's outcome;
  unmounted screens are safe to ignore.
- Existing lost-ack delivery checks and retries continue using the original
  operation ID. No duplicate send, new provider or persisted browser storage.
- Synthetic tests simulate concurrent sends, a pending operation surviving
  a navigation, a later acknowledgement after return, and stale callbacks
  after confirmed delivery, logout, or creation of a newer operation.

**This is source-only.** CI acceptance does not authorize customer messaging
or any LIVE/KEEP, Google, Cloudflare or Shopify release.

## Honest offline composer

- If the signed WORK Worker has replies OFF and an eligible user has typed
  but not sent a message, My JILL shows a read-only copy of the draft marked
  **not delivered** in English or Spanish. It is held in mounted session
  memory only, not persisted and not sent.
- The ledger forbids `sent`, `unconfirmed`, `missing` or `busy` state
  claims without the matching immutable operation. Pending operation text
  cannot be changed while the receipt is outstanding.

## Customer-account read cancellation (source-only)

- **Custom Orders** and **Messages** now each use an `AbortController`
  per signed WORK account read. On navigation away or a new request attempt,
  cleanup invalidates the screen and aborts its in-flight fetch.
- The canonical customer reader combines the cancellation signal with the
  existing 20-second timeout. It rejects cancellation before token retrieval,
  after a delayed session-token read, and after parsing a delayed response.
- Both screens already check an active render generation before writing
  display state. Aborting additionally terminates the old network read,
  rather than letting it race into the next screen. Every successful data
  response still requires the Shopify-authenticated account list and
  server-derived reply capability.
- This does **not** prove that a customer sign-out/sign-in within a still
  mounted Shopify page is independently detected. The actual browser/account
  lifecycle remains an explicit WORK Customer A/B acceptance gate.
- Offline regression: `node scripts/test-work-customer-read-cancellation.mjs`.
  No remote endpoint, fake customer record, storage or release mutation.
