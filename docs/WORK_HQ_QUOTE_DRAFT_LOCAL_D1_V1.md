# JILL HQ WORK — Durable quote drafts, local D1 proof

## Business purpose

Today the verified request-detail Quote Worksheet recalculates in the
browser but does not persist. This implementation lays down the
**durable draft quote data model and atomic write plan** without
exposing a Save button, enabling a route, or migrating a real database.

Future merchant flow: verified Owner opens one request → item price,
materials, labor, delivery, discount, tax entered → Save Draft →
subsequent edits require the latest draft revision → later Customer
Review and Shopify Draft Order/Invoice are distinct authorization steps.

## Implemented source

- `services/jill-order-desk/work-quote-draft-plan.mjs` verifies the
  WORK shop, exact request ID, signed-detail projection shape,
  current canonical request revision, noncancelled status and every
  item ID and submitted quantity. It reuses the current integer-cent
  worksheet evaluator; a price cannot be inferred from Shopify or
  from unverified customer inputs.
- It emits prepared-parameter **SQL plans** only. The canonical
  stored quote JSON includes item IDs, quantities, cent-denominated
  unit prices, optional charge/discount/tax cents and total. It
  **excludes customer name, email, address, artwork URL, raw payload,
  OAuth token or Shopify payment data**.
- `quote-proposals/0008_work_quote_drafts.sql` is an **inert proposal**
  OUTSIDE active `migrations/`; two tables hold the latest draft and
  unique operation receipts. This file is never auto-deployed.
- The two-statement transaction must be sent via one D1 `batch`:
  insert/update draft (CAS on expected draft revision and exact
  independently verified source fingerprint), then append a unique
  idempotency operation receipt only when `changes()=1`.
- A stale save does not modify the draft. Reuse of an earlier
  operation with current revision makes the UNIQUE receipt insert
  fail, rolling back the first statement. An ambiguous response
  must be independently reconciled using a read-only receipt
  lookup; it is **not permission to retry with another ID**.
- Quotes remain `draft` and USD only. No quote acceptance
  state, customer visibility, payment status or Shopify Draft Order.

## Actual local transaction testing

`npm run test:workerd-quote-draft-local` from the isolated App Home
runs the proposed SQL in Cloudflare's **real local workerd D1**.
It tests initial quote revision 1, saved edit revision 2, duplicate
replay, stale expected revision, changed source revision, operation
ID conflict with full batch rollback, and absence of customer PII.

The harness pins `workerd-phase19/wrangler.jsonc` to a fake local D1
ID and `remote:false`; it does **not** contact Cloudflare remote D1.
Any accompanying local R2 binding remains unused and `remote:false`.
CI runs this test after dependency installation; no credentials.

## Release separation

1. **NOW — source only:** merge checked domain/SQL proposal and
   pass WORK CI + Owner Windows LOCAL D1 test.
2. **Later — separately approved migration:** audit WORK D1 ID,
   per-request storage caps, backup/recovery, SQLite foreign-key
   behavior, retention and multi-worker transaction races. The
   Owner must explicitly approve any remote migration and any
   possible billable usage before applying it.
3. **Later — separate WORK Worker version:** implement Shopify
   online Owner + D1 grants, verified Google QA @9 request detail,
   body limits, Origin/CSRF and signed receipt inspection. Add
   an explicitly guarded Save Draft UI and reload. Stage/release
   only with separate version/traffic authorizations.
4. **Later — customer quote approval/payment:** grant scoped
   My JILL quote visibility, proof consent and use Shopify
   Draft Orders/invoices; never accept a browser-side paid flag.

**Not claimed:** a real saved quote, a deployed Save button, a
customer-approved quote, a fulfilled order or a paid transaction.
Keep LIVE, KEEP, Google QA events, R2 uploads, real D1 and
Cloudflare billing unchanged until separately authorized.

## Owner Windows local-D1 certification — PASS

The Owner synced `jill/rewards-work` to `d747665` and ran
`npm.cmd run test:workerd-quote-draft-local --prefix services/jill-order-desk/app-home`.
Windows output: **PASS 69 LOCAL D1 fixtures**, quote draft revision
1→2, idempotent replay, stale/source-drift denial, UNIQUE operation
rollback and customer PII exclusion. Exit status was zero before
the guarded PowerShell PASS was printed.

**Certified scope:** only genuine local workerd D1 with synthetic
objects. No WORK remote database table, verified customer quote,
deployed Save Draft button or payment has been created.

## Next source-only Owner Save Draft integration

`work-quote-save-boundary.mjs` now provides a standalone adapter
for a future WORK-only Save Draft POST, requiring:

- Already verified Shopify online session and WORK D1 Owner authority
  with `requests.write`, before body parsing or canonical source reads.
- Exact same-Origin POST, strict bounded JSON with only six allowed
  top-level fields, canonical verified original items and fresh Google
  QA list + detail revision agreement (never the client's status).
- Source-aware CAS and unique operation receipts from the existing
  local quote draft planner, followed by independent D1 readback.
- Deterministic response for stale drafts; unknown-commit outcomes
  fail closed without automatic retry or new operation IDs.
- No exposure of customer details, file URLs, session fields or
  secret values in successful/failure HTTP responses.

The route `/app/requests/quote-draft` is **hard OFF twice**:
the WORK Worker denies it before Shopify/D1, and the React Router
action invokes the adapter with `enabled:false`. No supported
manifest flag or request value can enable it. The request workspace
does not submit a Save Draft form in this source revision.

GitHub CI executes a real **LOCAL D1** adapter suite with synthetic
Shopify session/Google result data and the compiled Worker media-off
test also checks the quote endpoint is disabled at ingress.

**HOLD:** The quote schema remains in `quote-proposals/0008...`
outside active migrations. The next real feature step requires
separate Owner permission for remote WORK D1 schema installation,
the complete authenticated Save Draft route + view/load contract
(and a safe durable browser UI), release risk review and distinct
authorization for any Worker version upload or traffic switch.
Nothing here approves paid resources, Shopify Draft Orders/invoices,
customer approval, LIVE/KEEP or remote D1/R2 operations.
