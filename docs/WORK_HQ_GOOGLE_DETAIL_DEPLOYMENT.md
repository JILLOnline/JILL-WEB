# JILL HQ WORK — separately certified complete-request QA endpoint

The WORK inbox now loads in approximately **three seconds** according to the
owner's browser observation and navigates reliably. We are continuing with
the **complete original request** rather than changing the inbox read path.

The source-only backend and UI are merged in PRs #95/#96. The current
canonical WORK Google QA `/exec` **does not yet serve** their new
`jill_order_merchant_detail=1` operation. The new operation is HMAC
protected, restricted to WORK QA, and only loads one immutable request
after the Shopify Owner and D1 access checks on the Worker.

## Safest Google change

Create an **additional** web-app deployment of the **existing isolated
Custom Orders QA Apps Script project**, producing a new immutable Google
version and new deployment ID. **Do not update the existing WORK QA v7
`/exec` or HQ v8 `/exec`.** Existing merchant status saves and inbox
reads stay pinned to their known source versions.

Google's current clasp CLI uses `create-deployment` to create a new
web-app deployment and `--deploymentId` when updating an existing
deployment. The guarded local helper deliberately **never passes**
`--deploymentId`. It requires one authenticated operator approval
and refuses duplicate detail-deployment staging. It does not read or
print Script Property HMAC keys.

### Local WORK QA commissioning: distinct stages

1. Pull only `jill/rewards-work` and run existing **read-only** audits:

   ```powershell
   cd C:\Users\itzen\JILL-WEB
   git switch jill/rewards-work
   git pull --ff-only origin jill/rewards-work
   npm.cmd run custom-orders:work:qa:read-audit
   npm.cmd run work:hq:qa:versions:audit
   ```

2. Run the **new read-only detail gate**:

   ```powershell
   npm.cmd run work:hq:qa:detail:inspect
   ```

   The gate expects the isolated QA project ID and sheet ID, clean
   synchronized Git branch, the current remote **editor HEAD certified
   exactly against current Git**, and **both unchanged** published
   deployments (legacy QA v7 and extra HQ v8). It tests for all the new
   exact-detail functions. It does **not** write anything.

3. An expected `uncertified_google_qa_head` means the local Git code
   hasn't been synced into the QA **editor HEAD** yet. This is not
   permission to change either published `/exec`. Review the isolated
   script/head audit and then deliberately run the **existing local
   WORK-only editor sync**:

   ```powershell
   npm.cmd run work:hq:qa:diagnostic:sync
   ```

   This updates only WORK QA editor HEAD. It must still verify the
   protected published `/exec` version is unchanged. Rerun
   `work:hq:qa:detail:inspect` afterwards.

4. Only after PASS and operator approval:

   ```powershell
   npm.cmd run work:hq:qa:detail:stage
   ```

   Type exactly `CREATE JILL HQ WORK DETAIL QA DEPLOYMENT` when
   prompted. The helper re-inspects all identities and old versions,
   creates a **new** `JILL_HQ_WORK_EXACT_DETAIL_V1` deployment, then
   verifies there is exactly one new ID and the previous deployment
   version numbers did not change.

   If it prints `STOPPED` or an ambiguous creation error, **do not
   rerun**. Inspect deployment listing instead to avoid duplicating
   a version after a partial network failure.

5. Send back only the new **deployment ID and version**, never the
   HMAC key, raw customer data, Google Script Property contents, or
   full signed POST body. We'll separately pin the exact new endpoint
   and run a nonmutating signed detail probe against a **disposable
   WORK QA request**. Only after confirmed QA HMAC/unknown ID tests
   should a guarded WORK Worker version include an OFF-by-default
   `JILL_WORK_HQ_DETAIL_ENABLED` flag.

6. Existing Shopify WORK status updates and inbox reads must remain
   on the original verified source endpoint. Do not enable production
   payment/quote/mail or LIVE.

## Deployment boundaries

A separate Google QA web app can use the current WORK QA project's
existing Script Properties, but the new detail HMAC always binds the
exact submission ID, timestamp and nonce; anonymous callers without
the private key cannot read customer payloads. File `reference_ids`
remain opaque until private media storage/ACL is commissioned.

The newly merged Worker reader currently pins the original list
endpoint, and its route's `JILL_WORK_HQ_DETAIL_ENABLED` feature is
**OFF**. We will change that reader to the verified new detail
deployment ID in a later reviewed PR; creating the Google endpoint
alone does not expose new detail data to Shopify Admin.

No LIVE, KEEP, Rewards, original QA published versions, Shopify scopes,
customer records, inbox statuses, shipping costs or email sending are
changed by this code merge.

## Ambiguous create-deployment result — DO NOT retry blindly

If `work:hq:qa:detail:stage` reports
`qa_detail_creation_unconfirmed_inspect_before_retry`, the Google
remote creation outcome is **unknown**. It does not establish failure
or success, and should never trigger a second create automatically.

On a clean local `jill/rewards-work` branch, run:

```powershell
npm.cmd run work:hq:qa:detail:reconcile
```

This is a **read-only list-deployments** operation scoped to the
certified isolated WORK Custom Orders QA script. It verifies original
deployment v7 and separate HQ deployment v8 **have not changed**,
then looks for a single extra deployment whose description is exactly
`JILL_HQ_WORK_EXACT_DETAIL_V1`.

- `FOUND ONE NEW QA detail deployment`: creation happened; retain the
  exact new ID/version, verify HMAC and request isolation next.
  **Never rerun the create command**.
- `NO detail deployment with expected marker found`: no matching
  deployment currently appears. Do not infer whether Google created an
  orphan immutable version; inspect the CLI error and versions before
  deciding on any future new deployment.
- `STOPPED`: there is a version drift, duplicate marker, wrong
  project, or unreadable Google state. Stop and reconcile manually.

Neither the original inbox nor status writes are modified by
reconciliation. Do not paste private Script Properties, query tokens
or customer raw payloads into troubleshooting messages.
