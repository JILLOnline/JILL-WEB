# JILL HQ WORK — Quote Save + Reload release candidate (SOURCE ONLY)

## Owner certification preceding this candidate

2026-10-17 Owner Windows output shows a 143-case offline preflight
PASS, verified exact WORK database ID and deployed v34, private D1
backup at 5,859 bytes with SHA-256 fingerprint, successful one-shot
installation of exactly TWO EMPTY quote draft tables, and successful
separate read-only verification. The existing five core JILL tables
remained intact. Owner confirmed their Cloudflare Free tier/usage
checkpoint before the migration.

No app release occurred and no quote data was inserted.

## This candidate batch

- Adds `work-quote-release-readiness.mjs` with a unique WORK-only
  capability gate: explicit `JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED=true`,
  canary host stage, Shopify OAuth and Owner bootstrap state,
  verified Google WORK QA detail flag, existing merchant writes
  flag plus distinct secrets and WORK D1 binding.
- The Worker denies the quote path before OAuth/Google/customer data
  access unless the gate is met AND exactly the two quote D1 tables
  are present. Source manifests do not include the new flag.
- The quote GET and POST route each re-evaluates this capability
  and independently checks Shopify online Owner and WORK D1 grant
  through the existing handlers.
- Only after signed exact Google QA request detail and an Owner grant
  does the parent request loader expose `quoteDraftEnabled`.
- The request worksheet now honors the authenticated loader flag,
  rather than always passing false. It automatically reads one
  matching saved draft when authorized and verified. If the Owner
  types during that read, their unsaved values are preserved.
  Clicking Reload saved draft explicitly may replace local entries.
- Saving remains integer-cent and revision-safe, and any uncertain
  save stops with an explicit no-retry message. No source status
  mutation, customer response, My JILL approval, invoice or payment.
- Remove misleading `saved_in_real_work:false` from a verified D1
  projection, without treating draft-read as payment evidence.

## Current deployment — still OFF

The active WORK Worker is still v34, which blocks the quote endpoint.
NO new Worker version is uploaded, NO traffic switch is performed,
and NO `JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED` configuration is added
to current source manifests. CI uses synthetic data, local workerd
D1 and dry-run bundling only.

Do not casually set the new flag on a shared manifest, change LIVE
or KEEP, send customer emails, call Shopify Draft Orders, create
R2 storage, or authorize paid infrastructure.

## Next independently approved rollout

1. Source/CI security review and one-use version provenance audit
   with the *actual deployed* Worker bindings, v34 rollback and
   exact WORK D1 schema read-only checks.
2. Separate Owner authorization for *WORK only* Worker version
   upload; inspect new version resources and flags before traffic.
3. Separate Owner authorization for a controlled WORK traffic
   switch with the new explicit flag and rollback ready.
4. In a private signed-in WORK merchant session, test first with
   a designated synthetic/noncustomer request only: Save, exit,
   auto-reload, edit versioned draft, and reject stale source.
   Never mutate the two existing real customer requests just to QA.
5. Only after separate security approval, add proof/quote delivery
   to My JILL and Shopify Draft Order payment handoff.

## Local verification

`npm run test:work-hq-quote-release-candidate`

`npm run test:work-hq-quote-ui-wiring`

`npm run test:workerd-quote-save-owner-local --prefix services/jill-order-desk/app-home`

`npm run test:workerd-quote-read-restore-local --prefix services/jill-order-desk/app-home`

All runs are synthetic / local, and CI compiles the Worker without
deploying it. Passing tests does not establish live customer flow.
