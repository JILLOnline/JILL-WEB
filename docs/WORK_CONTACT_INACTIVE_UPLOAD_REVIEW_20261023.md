# JILL WORK Contact Us — inactive-version upload review (HOLD)

**Scope:** WORK HQ canary `jill-order-desk-canary-work` and WORK
Custom Orders gateway `jill-work-custom-orders-qa`. No other Workers,
Shopify store, source branch, databases, domains or paid services.
**This document is NOT approval to upload, deploy, promote, enable flags,
send real customer messages or perform any destructive rollback.**

## Owner-verified, unchanged pre-upload evidence (Oct 23, 2026)

From the user's local, authenticated read-only attestation:
- Source checkout `7c3e95a323adfa078f343ffcd0d7c138fd494837`
  (later source-only documentation/test commits do NOT make a new build).
- Existing active HQ version:
  `44ad4a81-55ad-4f49-9965-61260cc2294d`.
- Existing active gateway version:
  `9322193f-5e87-4479-88c9-39229dddb5f2`.
- Original Owner-generated local HQ candidate, pre-upload:
  - combined local build fingerprint SHA-256:
    `ed1379e8723a10fe3a73cb662249c7e327b534187b25c929286ca7a3ebdd490f`
  - local manifest SHA-256:
    `c0ae54ac0b29aedf12b9090b6575d04e913ce80329005333bc1439a7bed4fe07`
  - 50 bundled files; private `JillContactPrivate` entrypoint present
  - five existing HQ business flags reconciled to **actual active** values:
    `CATALOG=true`, `CONVERSATION=false`, `HQ_DETAIL=true`,
    `HQ_QUOTE_DRAFTS=false`, `MERCHANT_WRITES=true`
  - `JILL_WORK_OAUTH_ENABLED=true`,
    `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=false`, canary host
  - four existing HQ required secret binding **names** accounted for,
    no secret VALUE read; gateway's three existing secret names matched.
- `wrangler 4.152.0 deploy --dry-run` completed successfully and
  explicitly exited before upload. Zero D1 writes, zero traffic changed.
- Independent `attest-work-contact-local-artifact-readonly.mjs
  --owner-readonly` returned
  `local_manifest_matches_active_reconciled_candidate:true`,
  `private_worker_entry_found:true`,
  `published_source_provenance_verified:false`,
  `uploaded_worker_secret_continuity_verified:false`,
  `release_authorized:false`.

**Evidence is bound to exact local bytes and observed version IDs.**
After any new build, changed manifest or changed active Cloudflare
deployment, recompute and review — do not substitute a hash from
another checkout or assume those fingerprints still apply.

## Provider behavior to account for

Cloudflare's documentation separates **version uploads** from
**deployments**: `wrangler deploy` normally uploads and immediately
deploys 100%; `wrangler versions upload` creates a version without
switching normal traffic, while `wrangler versions deploy` is a
separate traffic-changing action. Worker versions contain bindings and
assets but NOT snapshots of D1 or other connected storage.

**CRITICAL:** If Workers Version URLs are enabled, uploading a version
may create a **publicly accessible Version URL even when the version
receives 0% of normal traffic**. Version URLs use the uploaded
version's existing bindings/resources. Confirm the WORK worker's
Version URL setting and/or access protection *before* approving any
upload, and never send customer credentials to an unprotected preview.
A Cloudflare Worker service binding ordinarily targets the deployed
callee; an unpromoted HQ named entrypoint cannot be assumed reachable
from the gateway's normal active version for full acceptance.

Cloudflare's `secrets.required` configuration can make a version
upload fail if required secret names are absent; that is a **name
contract**, not a test that credentials still work. Cloudflare's
documented preservation semantics do not replace post-upload
binding readback or protected login testing.

Official documentation:
- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/
- https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
- https://developers.cloudflare.com/workers/configuration/secrets/

## Independent pre-upload acceptance gates

1. **Explicit new owner authorization.** The previously approved
   `0004` D1 migration and read-only inspections did NOT authorize
   uploading either Worker. Do not assume consent from a generic
   "continue" instruction. Approval must name **WORK-only**, the
   intended Worker(s), and **inactive version upload only**.
2. **No new provider charges.** Reconfirm Workers Free, D1 Free,
   Durable Object/free-allowance constraints and expected resource
   usage. Never select a paid upgrade or plan without approval.
3. **Artifact scope:** local-only candidate matches the exact recorded
   fingerprint, correct target Worker, compiled named RPC, OAuth ON,
   five original business vars, zero Contact flags ON, correct WORK
   D1, and the four existing required HQ secret **names**.
   Gateway candidate preserves the three gateway secret names,
   existing limiter, the external QA backend binding, and has
   **no private D1 binding**.
4. **Current metadata:** recapture both 100%-traffic version IDs,
   deployment IDs, resource-binding name/type inventory, and
   unchanged active allocations. STOP on any drift. Keep credentials
   and customer data out of logs.
5. **Preview access:** explicitly check whether Version URLs are
   enabled/public. With any protected-preview requirement unresolved,
   HOLD; do not upload. Confirm any preview would still fail closed
   for unauthenticated requests.
6. **Readiness certificate:** a reviewed, non-secret review record
   must pin exact source and artifact hashes, expected Cloudflare
   command semantics, target names, rollback IDs, post-upload
   verification steps, and Owner approval. A CI pass alone is not
   such a certificate.

## Conditional steps only AFTER separate approval

- Prefer an upload-only Cloudflare operation (provider-documented
  `wrangler versions upload`, NOT plain `wrangler deploy`),
  with a reviewed local manifest and exact target.
- **Immediately verify** that the normal active deployment/traffic
  allocations and pinned versions are unchanged; STOP if they moved.
- Collect the new uploaded version ID, deployed/not-deployed state,
  name/type of all bindings, explicit secret-name contract and
  effective Contact flags OFF. Record the new version separately from
  the old 100%-traffic version. Do not claim to have proven secret
  values from metadata alone.
- Validate public Version URL access/authorization. Treat any
  unexpected public response or privileged-route exposure as a
  blocker requiring containment and separate approval.
- Do NOT automatically deploy the newly uploaded version, change
  routing percentages, enable HQ/Gateway/Storefront/My JILL flags,
  change Shopify installation, send customer notifications, alter D1,
  or perform Cloudflare Time Travel restoration.
- The paired Gateway/HQ link cannot be declared operational merely
  because each Worker has an uploaded but **un-deployed** candidate.
  Plan a separate OWNER-reviewed, reversible canary promotion and
  real Owner, Customer A/B/guest and Shopify app-proxy acceptance
  with the native form left intact.

## Decision

**HOLD** — Local source and artifact verified. Inactive upload,
preview security, runtime credential continuity and customer experience
have not been approved or proven. LIVE and KEEP untouched.

## Version URL access: independent authenticated read-only gate

The September 22, 2026 Cloudflare Version URLs guide clarifies that
`preview_urls` is the Wrangler setting controlling Version URL routing.
When it is **omitted**, Wrangler does not override a previously saved
setting. If no setting was previously saved, Version URLs initially
follow `workers_dev`. **Our WORK configurations have
`workers_dev=true` and omit `preview_urls`, so source configuration
alone cannot certify that inactive versions are private.**

Official API: `GET /accounts/{account_id}/workers/scripts/{script_name}/subdomain`
returns **two booleans**, `enabled` for ordinary workers.dev routing,
and `previews_enabled` for Version URLs. No POST is required for
read-only inspection. Sources:
- https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/get/
- https://developers.cloudflare.com/workers/wrangler/commands/general/

New `scripts/inspect-work-contact-preview-exposure-readonly.mjs`:

- Without arguments it reports `HOLD`, unknown preview settings,
  **zero Cloudflare calls**.
- With the explicit `--owner-readonly` flag it first invokes the
  existing pinned HQ/gateway active Worker baseline inspector; uses
  `wrangler whoami --json` to establish authenticated Cloudflare
  account membership; requires either **exactly one** available
  account or `JILL_WORK_CLOUDFLARE_ACCOUNT_ID` explicitly set to a
  listed account. It does **not** choose the first of multiple accounts.
- Retrieves Wrangler's current OAuth/API token into process memory
  using `wrangler auth token --json`, never prints/stores the token,
  and issues only two exact HTTPS GET requests (WORK HQ and WORK gateway)
  to Cloudflare's script/subdomain setting API.
- Prints only `workers_dev_enabled`, `version_urls_enabled` and the
  exposure-only policy verdict for each Worker. Discards all other API
  fields. Rechecks unchanged HQ/gateway 100%-traffic deployment
  identity after both GETs.
- Returns `status:HOLD`, `upload_authorized:false` regardless of
  the observed booleans. If **either** `previews_enabled=true`, the
  `preview_url_exposure_gate_cleared` field must be false and the
  release stays blocked without an independently reviewed Cloudflare
  Access restriction or safe configuration change. If both are false,
  the **Version URL exposure gate only** is satisfied; uploads remain
  unauthorized until all other gates pass.
- Missing/malformed API response, ambiguous account, auth failure,
  worker version drift, deleted secret binding, or network failure
  must fail closed. Tokens and script settings cannot be inferred
  from deployment metadata.
- No Version URL visit, customer session test, release upload, secret
  mutation, traffic allocation, preview-setting change, paid service
  enablement, or D1 write is done by this script.

This **does not** equate disabling Version URLs with disabling the
normal workers.dev route, nor does it imply any preview Access
policy is installed. The gateway implements a Durable Object, and
Cloudflare documentation limits Version URL generation for such
Workers; still read and record the actual gateway flag, rather than
assuming its exposure status.

**Status: HOLD** until the owner runs and shares the non-sensitive
read-only result. Never request the Cloudflare API token to be pasted
into chat.

## Owner-confirmed active preview URLs: BOTH enabled — upload BLOCKED

The owner ran `inspect-work-contact-preview-exposure-readonly.mjs
--owner-readonly` against the pinned WORK HQ/gateway versions:
HQ `44ad4a81-55ad-4f49-9965-61260cc2294d`; gateway
`9322193f-5e87-4479-88c9-39229dddb5f2`. Both read-only
Cloudflare subdomain GETs returned **`workers_dev_enabled:true`**
AND **`version_urls_enabled:true`**. The final report confirmed
`preview_url_exposure_gate_cleared:false`,
`version_uploaded:false`, `traffic_changed:false`,
`subdomain_settings_changed:false`, `upload_authorized:false`.

This is not evidence of a breach or public access to private customer
data; it is proof the **version-routing setting is currently ON** for
both workers. Cloudflare warns that newly uploaded versions have public
Version URLs when enabled. The gateway implements a Durable Object
and Cloudflare currently limits generated Version URLs for such Workers,
but it would be unsafe to rely on that exception for future features or
as a substitute for reading the actual setting.

### Minimal no-new-service remediation (proposal, NOT executed)

**Option A, recommended for current WORK:** With explicit owner
authorization, disable only **Version URLs** for **both** existing WORK
Workers using Cloudflare dashboard **Workers & Pages → worker →
Settings → Domains & Routes → Version URLs → Disable**. Leave the
normal `workers.dev` route **enabled** on both; changing that route
could interrupt current HQ and gateway operation. This setting change
will disable existing aliased/versioned preview routes for each worker,
so any current preview-only URLs would cease routing. Check whether
anyone relies on them before authorizing the change.

After an authorized change, rerun the **GET-only** preview inspector and
the pinned active-binding inspector. Both `version_urls_enabled`
results must be **false**, both `workers_dev_enabled` results must
remain **true**, active version IDs/allocations and every binding must
be unchanged. Even with both disabled, `upload_authorized` stays
**false** until the separate inactive-upload review passes.

**Option B:** Protect both Version URL surfaces through Cloudflare
Access (including preview paths), with independently verified Access
policy enforcement. This requires Zero Trust setup and may have plan
or management consequences; NO Access provisioning/paid enrollment is
approved. Do not infer that Shopify OAuth alone protects all URL paths
or that enabling Access is harmless to existing HQ login.

### Immutable source preparation performed only in the draft PR

- The **unshipped gateway** `wrangler.contact-bridge.candidate.toml`
  now explicitly declares `preview_urls = false` and retains
  `workers_dev = true`, existing limiter, gateway secrets and named
  HQ-only service binding. This is **not** the active gateway config
  `wrangler.toml`. Do not upload it now.
- The source-only `scripts/plan-work-contact-preview-lockdown.mjs`
  clones a separately reviewed owner-derived HQ candidate, adding
  **only** `preview_urls:false`. It independently refuses any change
  to the HQ WORK tenant, existing Shopify OAuth, customer flags,
  original D1 ID, original secret names or normal `workers_dev`
  routing. It does not change the existing artifact.
- A disposable **synthetic** HQ locked candidate is compiled using
  `wrangler deploy --dry-run` in CI; the original owner-attested
  fingerprint `ed1379e8723a10fe3a73cb662249c7e327b534187b25c929286ca7a3ebdd490f`
  continues to identify **only the owner's original local build**.
  Adding `preview_urls:false` to a future real manifest requires a
  new local hash and attestation. Do not claim the original fingerprint
  covers a changed manifest.

The settings on the active Cloudflare workers are currently **still
enabled**. Merely setting `preview_urls=false` in an unshipped
candidate cannot turn existing routing OFF. Cloudflare docs confirm
this field is applied when configuration is uploaded/deployed; we
do NOT rely on an upload as a safe, atomic way to disable an
already-enabled preview route.

**Release decision: HOLD.** No preview-setting mutation, version
upload, traffic deployment, paid service enrollment, Shopify form
switch, D1 write, LIVE or KEEP change has been approved or performed.

Provider references:
- https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/
