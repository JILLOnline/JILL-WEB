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

## Phase 2: verified intake gateway and durable receipt — source only

Implementation exists on jill/rewards-work. It is not hosted, not enabled,
not integrated with a real app proxy or a separate Custom Order WORK Sheet.
Existing WORK Rewards and LIVE must not be deployed from these sources.

Ownership:
- backend/custom-order-gateway.mjs: portable Node Shopify App Proxy handler;
  the host MUST supply a verified Shopify app-proxy authentication adapter,
  durable rateLimit adapter, origin allowlist, expectedShop, Apps Script URL
  and a 32+-character secret. This is not a self-hosting HTTP route.
- theme/assets/jill-custom-order.js: first attempted request stays immutable
  across retries (ID, timestamp, raw payload). A verified response must
  contain ok=true, verified=true, matching ID and received status.
- theme/sections/main-custom-order.liquid: verified_submission_endpoint
  remains BLANK by default. It may later be set to /apps/jill-custom-order
  only after a real signed proxy and backend are running.
- backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs:
  gateway HMAC-SHA256 validation uses Script Property
  JILL_CUSTOM_ORDER_GATEWAY_SECRET. An optional separate
  JILL_CUSTOM_ORDER_REQUIRE_GATEWAY=1 switch can block direct legacy POSTs
  only AFTER the merchant has certified the hosted proxy end to end.

Protocol:
1. Existing URL-encoded Custom Order request is sent to same-origin app proxy.
2. Host verifies Shopify proxy signature using supported Shopify auth SDK;
   a claimed shop/email/customer ID is not sufficient. Guest intake is
   allowed but does not grant authenticated My JILL account ownership.
3. Host checks origin, shop, request body, unique form fields and shared
   per-store/per-IP rate limiter. Limiter failure rejects submissions.
4. Gateway signs submit + newline + ID + newline + millisecond timestamp
   + newline + canonical raw_payload using HMAC-SHA256. Secret stays
   server-side and in Google Script Properties; timestamp max 2 minutes.
5. Existing Apps Script doPost persists intake and revision-1 received
   event, or returns a failure. An existing ID with a different raw_payload
   returns submission_conflict (not a misleading duplicate success).
6. Gateway obtains separate signed receipt evidence via Apps Script doPost,
   verifying BOTH the persisted Submissions row and first history event.
7. Only when both backend actions return matching ID and true receipt may
   the gateway send browser response verified=true and received status.
8. Network failures return unconfirmed and the browser can retry the
   IDENTICAL first-attempt payload. Opaque no-cors fetches are not proof.

WORK activation gates (NOT completed):
- Provision independent WORK Custom Order Google project and test spreadsheet;
  never point WORK Rewards at the production Custom Order sheet.
- Provision an HTTPS Shopify App Proxy host for WORK, verified authenticator,
  durable rate limiter, isolated HMAC secret and allowed storefront origin.
- Verify forged signature, rate-limited requests, changed ID payload,
  backend timeout and replay tests against actual isolated Google Sheets.
- Enable the verified theme setting on WORK only after backend proof.
- Flip gateway-only enforcement in WORK ONLY after browser verified receipt.
- Audit production separately, then obtain explicit LIVE deployment approval.

Receipt != account ownership: logged-in customer linkage requires a distinct
Customer Account session-token signature, expiry, audience and sub check.
Do not claim a guest request by email match. No customer status/approval
endpoint, paid invoice or shipment transition is enabled in this phase.

## Dedicated WORK Custom Orders QA backend — provisioned data store

A NEW EMPTY Google WORK QA spreadsheet has been created independently of
the production Submissions sheet. It has canonical Submissions (22 columns),
CustomOrderEvents (11 columns) and CustomOrderDesk (10 columns) headers,
with frozen header rows and validated merchant status dropdowns. No LIVE
requests or customer records were copied. The QA spreadsheet ID belongs in
your local environment/config, not in this public GitHub repository.

Build/runtime files:
- scripts/build-custom-order-work-backend.mjs: derived from the existing
  source-safe WORK Rewards compiler but writes .work-custom-orders (ignored).
  It requires JILL_CUSTOM_ORDER_WORK_SHEET_ID and refuses the LIVE Sheet ID.
- scripts/bootstrap-custom-order-work-backend.mjs: creates a NEW standalone
  Google Apps Script project, records its .clasp identity outside Git and
  uploads only the single canonical GS source. It does NOT create a web
  app deployment, secret, triggers, rewards ledger or Shopify discount.
  A subsequent upload first audits Google remote files and refuses unknown
  scripts. It may require Google clasp OAuth authorization in a browser.
- The generated runtime has JILL_REWARDS_RUNTIME=WORK AND
  JILL_CUSTOM_ORDER_SANDBOX=true. This is a distinctly isolated Custom Order
  QA project, NOT the existing WORK Rewards backend.

In the Custom Order QA runtime:
- Rewards webhooks, setup, sweep tasks and Google OAuth callbacks are blocked.
- Shopify customer synchronization and all outbound emails are bypassed.
- Custom Order intake/receipt/history are allowed ONLY with valid gateway
  HMAC signatures; anonymous direct POSTs are always denied, regardless of
  the JILL_CUSTOM_ORDER_REQUIRE_GATEWAY property.
- The canonical WORK Rewards deployment retains SANDBOX=false, so it
  continues refusing all Custom Order POSTs. No changes to its URL or data.

After pulling the certified jill/rewards-work commit in Windows PowerShell,
set JILL_CUSTOM_ORDER_WORK_SHEET_ID locally to the NEW isolated QA spreadsheet
ID (found in the QA spreadsheet URL) and run:

  npm.cmd run custom-orders:work:backend:bundle
  npm.cmd run custom-orders:work:backend:bootstrap

These steps require Google clasp authorization and do not deploy a web app.
Before web deployment, provision a separate Script Property
JILL_CUSTOM_ORDER_GATEWAY_SECRET (32+ random characters, same key held only
by hosted WORK app-proxy server). Do not paste or commit it. Verify the
new Google project and QA spreadsheet IDs, then explicitly deploy the
QA web app from its own project after work-scope approval.

Only after the corresponding WORK Shopify app proxy is hosted with real
Shopify signature verification and rate limiting can we perform a real
shopper submission. The browser theme setting stays blank until that point.


## QA predeployment verification and first deployment

Once the new QA project has `JILL_CUSTOM_ORDER_GATEWAY_SECRET` and
`JILL_CUSTOM_ORDER_ADMINS` saved securely in its **own** Script Properties,
re-pull the latest certified WORK branch and rerun
`npm.cmd run custom-orders:work:backend:bootstrap` with the existing
`JILL_CUSTOM_ORDER_WORK_SHEET_ID`. This updates the *same* Google QA project.
Its Script Properties are managed separately from clasp source uploads.

The QA `appsscript.json` manifest explicitly limits Google OAuth permissions
to `spreadsheets` and `userinfo.email`. Shared source references to email,
OAuth callbacks or Shopify operations must NOT expand the QA project's scopes.
In Google Apps Script > Overview, check the displayed OAuth scopes and stop
if Google unexpectedly requests Mail/Gmail, Drive-wide administration or
other privileged access.

Before deploying, open the QA project code editor, choose the read-only
`jillCustomOrderQaPreflight` function and click Run. Review the execution
log: it must return `ok:true`, `scope:WORK_CUSTOM_ORDERS_QA`,
`gateway_secret_configured:true`, `merchant_operator_authorized:true`,
and `qa_sheet_headers_verified:true`. It neither logs the secret nor changes
customer orders; any failure **blocks deployment**.

If all checks pass, select **Deploy > New deployment > Web app**:
- Description: `JILL WORK Custom Orders QA — signed intake`
- Execute as: `Me` (the QA project deploying operator)
- Who has access: `Anyone` (the eventual Shopify server must be able
  to call it without a Google interactive login)
- Deploy, review requested permissions, and save the newly created `/exec`
  URL. The QA doGet must return only `JILL WORK Custom Orders QA online.`
  This GET check establishes only web-app reachability, **not** a verified
  signed POST or a working Shopify gateway.

Do not configure the production Custom Order theme, production Scripts,
WORK Rewards endpoint, or run `setupJillRewards`. Do not set the
`verified_submission_endpoint` theme setting until an actual Shopify app
proxy with verified shop auth and rate limiting has passed a real synthetic
order submission plus separate receipt verification.


## Clasp round-trip recovery on Windows (2026-10-12)

Google clasp may upload the canonical source as
`JILL_Custom_Order_Automation_REWARDS.gs`, but download the same Apps
Script source as `JILL_Custom_Order_Automation_REWARDS.js`.
The initial second-run bootstrap incorrectly rejected the `.js` suffix as
an unknown remote script. **It failed before push; it did not replace the QA
project or its saved Script Properties.**

The repaired bootstrap now performs `clasp pull` in a disposable audit
directory, not the canonical local bundle. It accepts exactly **one**
script with the canonical base filename and either `.js` or `.gs`,
reads the embedded certified Git source SHA, reconstructs that historical
WORK QA source at the exact isolated Sheet ID, and compares normalized
SHA-256 content before touching the upload directory. Any extra
`.js`/`.gs`/HTML file, wrong Sheet ID, incorrect sandbox flags,
or remote code drift **blocks the upload**. No remote changes are erased.

If the failed pull left the same canonical `.js` alongside local
`.gs`, bootstrap deletes that local `.js` **only after it matches**
the separately verified remote contents. Then it rebuilds one canonical
`.gs` plus the restricted `appsscript.json` manifest and pushes to
the existing `.qa-project.json` project ID. No new Google project is
created. This is regression-tested on Windows Node 24 and Linux.

From PowerShell after passing CI and `git pull --ff-only`, use the
existing, nonproduction `JILL_CUSTOM_ORDER_WORK_SHEET_ID` and rerun
`npm.cmd run custom-orders:work:backend:bootstrap`. Expect:
`QA Google remote matches historical certified source`, followed
by `WORK Custom Orders QA source pushed` and `NOT DEPLOYED`.
Then choose `jillCustomOrderQaPreflight` in the QA Google Apps Script
editor and run it manually before deploying the QA web app.

Never delete the entire `.work-custom-orders` directory or create a
replacement Apps Script project to work around this extension issue:
that directory contains the local, isolated project binding.


## Shopify WORK proxy connection — source prepared, host pending

The merchant verified that the QA Apps Script web app responds
JILL WORK Custom Orders QA online. This proves only GET reachability,
not signed POST or an authenticated customer submission.

Read-only Shopify WORK audit: JILL WORK Rewards is installed on
jill-work.myshopify.com without write_app_proxy. GitHub currently contains
account extensions and gateway logic, NOT a hosted HTTPS Shopify app proxy.

New canonical components:
- backend/shopify-work-app-proxy-auth.mjs: validates Shopify's app proxy
  query HMAC, the signed shop, exact proxy prefix, and five-minute timestamp.
  A verified SHOP is not proof of a customer's ownership of an order.
- backend/custom-order-work-proxy-route.mjs: composes signed Shopify WORK
  proxy verification with the existing two-stage Google receipt gateway.
  Hosting must supply a durable, distributed rate limiter. No optional
  anonymous authenticator or in-memory fallback is accepted.
- scripts/prepare-custom-order-work-proxy-config.mjs: on the correctly
  linked JILL WORK Rewards config only, prepares write_app_proxy and
  /apps/jill-custom-order once a real HTTPS destination is supplied.
  It refuses an existing different proxy and does not deploy Shopify.

Host requirements: a real HTTPS address with /jill-custom-order-proxy,
the Shopify WORK app's PRIVATE shared secret, the DIFFERENT Google WORK
Custom Order gateway secret from QA Script Properties, the QA Google
/exec URL, the exact shop, and durable per-shop/client rate limiting.
Keep both secrets in the host's encrypted environment; do not print,
commit, paste into chat, or expose to Liquid or JavaScript.

When an HTTPS host exists, set the local PowerShell environment variable
JILL_WORK_CUSTOM_ORDER_PROXY_URL to that public HTTPS address ending
/jill-custom-order-proxy, then run:

    npm.cmd run custom-orders:work:proxy:prepare

This only prepares the ignored shopify.app.work.toml. It does not
deploy the app, grant new scopes, or modify LIVE. The later WORK app
deployment/reauthorization is a separate deliberate release step.

Still required before a verified browser submission:
1. Host with Shopify proxy HMAC verification and distributed rate limits.
2. Verify wrong-shop, bad-signature, expired-time and outage rejection.
3. Deploy the WORK app proxy and grant write_app_proxy in WORK only.
4. Send a synthetic test via Shopify WORK storefront, reconcile request
   in Google Submissions and CustomOrderEvents, then verify duplicate
   and conflicting-ID attempts against the real Google QA database.
5. Only then enable the verified submission endpoint in WORK Theme Editor.
6. Production remains independently blocked pending release approval.

Shopify allows one app proxy route per app. Reference:
https://shopify.dev/docs/apps/build/online-store/app-proxies
https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
