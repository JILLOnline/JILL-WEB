# Custom Orders — secure workflow core (v1, SOURCE ONLY)

**Branch**: `jill/rewards-work`. **Status**: implemented and regression-tested in
source; not deployed to the production Custom Order Apps Script or customer
account extension. No production Sheets, Shopify orders, customer balances,
or webhook settings were changed.

## The existing intake remains canonical

- Form: `theme/assets/jill-custom-order.js`
- Submission schema: `contracts/custom-order-api.schema.json` (`custom_order.submit`)
- Delivery adapter: `backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs`
- Primary intake table: canonical Google `Submissions` Sheet
- Rewards v13: independent accounting and discount authority, unchanged

The new workflow is **embedded in that existing Apps Script backend**, not a
second backend/duplicate submission handler. A valid persisted submission now
initializes an idempotent `received` event **while the existing intake POST
lock is held**. Its original technical status field continues to track
Shopify sync and customer/merchant email acceptance only.

The isolated `jill-work.myshopify.com` Rewards backend continues to refuse
all Custom Order writes. Do not put the production Custom Order Sheet ID into
the WORK Rewards app; do not use the WORK Rewards backend for order testing.

## Persisted workflow history

New protected Sheet: `CustomOrderEvents` (created on first accepted receipt
or authorized merchant read/update). The event rows are **append-only by
application design**, with fields:

`event_id, submission_id, revision, customer_status, internal_status,
public_note, internal_note, evidence_ref, actor, occurred_at, source`.

The current workflow status is derived from the latest validated event in
the history, not copied into an independently writable `status` cell.
Every event has a strictly increasing positive revision. A malformed header
or nonconsecutive revision **blocks mutation**.

Use Google Sheets **Protect sheet** on `CustomOrderEvents` for the backend
owner/deployer and keep a backed-up version history. Application-level
append-only rules alone do not cryptographically prevent a Sheet owner from
tampering with rows. A cryptographic audit-chain is a possible future hardening
step if the operations require it.

### Customer-facing statuses

`received` → `reviewing` → `awaiting_approval` (can return to
`reviewing`) OR `in_production` → `ready_pickup` → `completed`.

`on_hold` and `cancelled` are governed by allowed transitions. Completion
requires a documented merchant handoff reference stored in the event history.

**Deliberately unavailable** at this stage: an `approved` transition
without authenticated customer proof acceptance, and a `shipped` transition
without verified Shopify fulfillment/tracking. We will add these only after
authoritative approval and shipment adapters exist. A customer must not see
false paid/shipped or design-approved claims.

### Internal merchant stages

`new`, `needs_quote`, `waiting_customer`, `materials_ordered`,
`proof_revision`, `printing`, `assembly`, `quality_check`, `ready`,
`none`. These, `internal_note`, operator identity and evidence references
**must not** appear in the customer-facing projection.

`jillCustomOrderCustomerProjection_` strictly emits only submission ID,
revision, public status, public notes and timestamps. It has **no HTTP route**
and grants **no authentication/ownership rights** on its own.

## Merchant controls — no public command endpoint

Functions run ONLY from the authorized Google Apps Script project:

- `jillCustomOrderMerchantSetupDesk()`: creates `CustomOrderDesk` with
  status dropdowns; no orders are updated.
- `jillCustomOrderMerchantRead(submissionId)`: returns current revision,
  status and internal event history for a known request.
- `jillCustomOrderMerchantProcessDesk(limit)`: applies up to 25 pending
  command rows from the desk, explicitly invoked by an authorized operator;
  it is **not** a trigger/cron/onEdit listener.
- `jillCustomOrderMerchantBackfill(offset,limit)`: safely adds a
  `received` event to historic requests that lack any workflow record,
  in batches of up to 100; returns a `next_offset` cursor.

### Mandatory operator setup before any LIVE deploy

1. Have the canonical LIVE Custom Order Apps Script project identified and
   its existing deployment/Sheet access independently verified.
2. In **that project's** Script Properties, set
   `JILL_CUSTOM_ORDER_ADMINS` to a comma-separated list of trusted, verified
   Google operator emails. **Never commit operator emails or credentials.**
   Empty property or unavailable Google active-user identity denies all
   merchant commands.
3. Protect `CustomOrderEvents` from ordinary sheet editors; share the
   `CustomOrderDesk` control area with staff who should enter requests.
   Only authorized operators with approved Google identity may run the
   processor. Anyone with Apps Script source-editor rights is already highly
   privileged: restrict project editor membership.
4. Deploy only after source CI, isolated WORK Sheets tests, app/runtime
   authorization and approval gates. Do **not** deploy this branch's
   combined Rewards file to the production Apps Script as a shortcut.

### Operating the desk

Fill one row in `CustomOrderDesk` with:

| Field | Input |
| --- | --- |
| operation_id | A NEW globally unique idempotency key (e.g. `jill:desk-000001`) |
| submission_id | Exact `submission_id` from the intake `Submissions` row |
| expected_revision | Latest verified revision from `jillCustomOrderMerchantRead` |
| customer_status | Allowed next status or existing status with a meaningful update |
| internal_status | Optional stage from the dropdown |
| public_note | Optional text visible to customer, max 500 chars |
| internal_note | Optional private production note, max 2,000 chars |
| handoff_reference | Required for `completed`, e.g. signed pickup receipt reference |
| result / processed_at | **OUTPUTS ONLY**; do not populate |

The authorized operator runs `jillCustomOrderMerchantProcessDesk(10)` in the
Apps Script editor. Each command gets an `APPLIED revision N` or a specific
`REJECTED` result. Do not delete the row; add a new row with a **new**
operation ID and current revision for a corrected command. If a success
acknowledgement fails after its event commit, rerunning the SAME operation
ID returns idempotent success and does not append another event.

**Concurrency**: status edits are serialized under the Apps Script lock.
Only updates matching the current revision may commit. Staff must reload
the latest state after any conflict; never overwrite another operator's edit.

**Historic orders**: `jillCustomOrderMerchantBackfill(0,20)` returns a
`next_offset` for the next batch. A backfilled record is only marked
`received`: it does not assert a historic approval, delivery or payment.

## Security and reliability boundaries still open

1. **Public form receipt is not verified.** The current browser submits a
   `no-cors` POST and can show success without reading an authoritative
   backend acknowledgement. Before LIVE cutover, introduce a verified
   submission/receipt mechanism with retry and idempotency. Do not use public
   email lookup or guess ownership from supplied email.
2. **Customer association is not verified.** The current form may be
   submitted without Shopify authentication. A matching email or the existing
   email-based `customerSet` is NOT ownership proof. Customer Account API
   reads must bind verified session-token `sub` to an explicitly claimed
   submission; verify signature/expiry/audience server side. Guest claims
   require secure verification.
3. **No payment/draft-order association.** Quotes, invoices, payment/refund,
   shipment and tracking must come from Shopify's authoritative objects.
4. **No design-approval mutation.** The `approved` status is intentionally
   absent until an authenticated approval command can record proof/version.
5. **No notification outbox.** Status changes persist to history, but do NOT
   send emails or promise delivery. Add an outbox with deduplication later;
   never send directly before commit.
6. **No live Google control deployment completed here.** WORK Rewards is a
   distinct backend, and the production Apps Script deployment requires
   the separately authorized exact-SHA release and credentials.
7. **No customer-facing visual changes** were made. The My JILL Custom
   Orders placeholder remains honest until owner-bound backend queries exist.

## Tested regressions

`npm run test:custom-order-workflow` executes the **actual canonical
Apps Script workflow** inside a Node VM with in-memory Google Sheet mocks:
receipt idempotency, 1-based revisions, merchant allowlist, WORK denial,
missing orders, invalid transitions, stale revision, operation-id replay,
internal/public projection isolation, completion evidence, historic backfill
and authorized desk command processing. The `postinstall` suite covers it
on both Linux and Windows Node 24 CI.

## Release prerequisites

- [ ] Canonical production Custom Order project/sheet ownership certified
- [ ] Distinct isolated WORK Custom Order sheet/project provisioned for runtime QA
- [ ] Active-user operator allowlist and Sheet protection validated
- [ ] A real intake receipt plus duplicate network retry tested
- [ ] Two account identities tested for foreign-order denial
- [ ] Quote/draft-order and customer proof approval bound to Shopify auth
- [ ] Real merchant status updates recorded and customer timeline reconciled
- [ ] Audit and manual rollback/recovery tested
- [ ] Explicit production release authorization

No step here authorizes a production deployment.
