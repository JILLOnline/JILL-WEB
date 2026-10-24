# WORK Contact — preview-locked local artifact evidence (source-only)

**Decision: HOLD.** This document records an owner-provided local dry-run
and a new independent **offline** evidence review. It does not approve a
Cloudflare version upload, deploy, release, app-proxy switch, D1 write,
Shopify action, customer messaging, use of paid services, or LIVE/KEEP action.

## Owner-observed facts (October 23, 2026, Jacksonville local time)

The owner ran the existing local-only preparer and Wrangler 4.152.0
`deploy --dry-run` against
`dist/server/wrangler.contact-owner-preview-disabled.json` in a detached
QA checkout of the WORK preflight branch. The results were:

- HQ active 100%-traffic Worker version:
  `44ad4a81-55ad-4f49-9965-61260cc2294d`.
- Gateway active 100%-traffic Worker version:
  `9322193f-5e87-4479-88c9-39229dddb5f2`.
- Previously independently checked preview settings:
  `version_urls_enabled:false` for both HQ and gateway;
  ordinary `workers.dev` routing stayed enabled.
- New **local** combined 50-file bundle SHA-256:
  `c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996`.
- New **local** manifest SHA-256:
  `890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671`.
- The only local manifest mutation from the previously attested candidate
  was `preview_urls:false`.
- Wrangler dry-run compiled 44 client assets and 2 attached JS modules;
  reported 1331.11 KiB upload size (294.82 KiB gzip); exited at dry-run.
- The candidate retained WORK-only D1, OAuth ON, bootstrap OFF, the five
  observed business flags, and contact rollout flags OFF.
- **No worker version was uploaded or deployed; no traffic changed.**

The original hash `ed1379e8723a10fe3a73cb662249c7e327b534187b25c929286ca7a3ebdd490f`
covers a DIFFERENT manifest and must not be substituted for the new hash.

## Additional offline evidence guard

`scripts/review-work-contact-inactive-upload-offline.mjs` checks the
exact new manifest/fingerprint against the owner-provided pin. Its
default invocation does no file or provider inspection and returns HOLD.
`--owner-local-readonly` reads only local compiled assets / manifest,
recomputes the digest and rejects changed bytes, unexpected Worker/D1,
missing or renamed required secret *names*, broken OAuth/business flags,
enabled Contact toggles, changed worker routing, or a re-enabled Version
URL setting. It does NOT re-read Cloudflare or inspect secret *values*.

`scripts/test-work-contact-inactive-upload-offline.mjs` uses synthetic
data to prove matching evidence and refusal cases. The offline source
test and no-argument HOLD check run in the existing preflight workflow.
A CI pass establishes source contract behavior, **not** current remote
state or an approved release.

## Mandatory blockers before ANY separately approved inactive upload

1. Fresh authenticated readback of both currently active 100% Worker
   versions, binding inventory, secret-name contracts and routing
   allocations; fail closed on drift.
2. Fresh authenticated GET-only confirmation that both Version URL
   settings remain disabled; do not infer it from the local manifest.
3. Independent source provenance and uploaded-version secret continuity
   plan; metadata secret names do not prove credential validity.
4. Current free-tier accounting and realistic budget for total request,
   CPU, D1, Durable Object, asset and service-binding usage; no paid
   plan or feature may be enabled without specific owner consent.
5. Exact reviewed command and target manifest, immutable approval record,
   rollback version IDs and verifiable post-upload checks.
6. **Separate explicit owner authorization** naming the WORK Worker(s)
   and 0%-traffic **inactive version upload only**. A generic "go"
   is NOT authority for this production-adjacent Cloudflare write.

After any authorized upload, do not infer runtime readiness from an
unpromoted version. A second, separate commissioning gate is required
for protected Owner/customer A/B/guest testing, Shopify app proxy, native
Contact Us fallback and a reversible WORK-only traffic promotion.

## Provider references

- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/platform/limits/

**Strict near-zero-cost requirement remains in force. LIVE and KEEP untouched.**

## Combined authenticated GET-only evidence review (next milestone)

New source: `scripts/review-work-contact-combined-evidence-readonly.mjs`.
It is not a deployment script. There is **no** automatic remote
invocation in CI and no automatic upload upon a passing verdict.

- Default execution (no arguments) performs **zero Cloudflare reads**
  and returns HOLD.
- Owner `--owner-readonly` first independently rehashes the existing
  preview-locked local build, confirming both owner-pinned SHA-256 values,
  the 50-file count, WORK OAuth/business flags, D1 identity, existing
  secret *names* and Contact flags OFF. A missing or changed local
  artifact exits before provider authentication.
- Only when the local gate passes, the script reads the active,
  pinned HQ and gateway WORK deployments/bindings with Wrangler
  **read-only** commands; it refuses changes in version or allocation,
  unsupported bindings, secret-name drift or active flag drift.
- The provider's exact WORK HQ and gateway subdomain settings are
  each obtained **twice by authenticated HTTPS GET**. Both
  `previews_enabled` flags must be `false`, both ordinary
  `workers.dev` settings must remain `true`, and any change between
  the reads aborts the review.
- It rechecks active traffic/deployment identity around those reads,
  then recomputes the local bytes again before its last deployment
  identity read. All errors fail closed. Its report returns only
  bounded non-secret identifiers, hashes and booleans, not provider
  tokens, secret values, customer records or raw metadata.
- Even a successful authenticated owner review always reports
  `status:HOLD`, `inactive_upload_authorized:false`,
  `free_tier_budget_verified:false`,
  `remote_secret_value_continuity_verified:false` and
  `readiness_certificate_issued:false`.

`scripts/test-work-contact-combined-evidence-readonly.mjs` uses
synthetic provider data to cover successful read-only behavior and
failure on missing/wrong local bytes, public previews, preview-setting
drift, changed deployment allocations, changed local files, removed
secrets and OAuth/Contact flag violations. It runs without network or
Cloudflare credentials in the existing source-only preview CI.

**A passing GitHub test is NOT an owner-authenticated remote read.**
The real `--owner-readonly` mode has not been executed for this new
reviewer unless the owner separately provides its output. It also
does not replace the separate owner approval required for any
0%-traffic WORK version upload.

## October 24: owner-confirmed inactive HQ upload and postflight

The owner explicitly confirmed Workers Free and separately authorized
**one inactive WORK HQ-only upload**. Wrangler 4.152.0
`versions upload` completed, producing:

- new, independently addressable uploaded version
  `8fd0153b-3071-47df-8836-81973dab6cb4`;
- original HQ still **100% serving**
  `44ad4a81-55ad-4f49-9965-61260cc2294d`
  via deployment `f80335de-98ea-4831-b00e-87cd1a397596`;
- gateway remained serving
  `9322193f-5e87-4479-88c9-39229dddb5f2`;
- 7 changed static assets successfully uploaded, 35 reused;
- candidate local digest stayed
  `c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996`;
- post-upload combined authenticated GET-only review passed with
  both Version URL routes disabled and WORK ordinary routing unchanged.

**Important distinction:** The combined reviewer reports
`worker_uploaded:false` because it makes no upload itself.
The authoritative Wrangler upload result proves one version was uploaded.
No `versions deploy` happened, no normal traffic was promoted, no
gateway upload or Shopify/customer/D1 write was performed by that command.

### New exact uploaded version inspector

`scripts/inspect-work-hq-uploaded-inactive-readonly.mjs` has an
offline HOLD default. The `--owner-readonly` mode:

1. Re-verifies exact local candidate bytes and both Workers' current
   100%-traffic metadata/Version URL settings with authenticated GETs;
2. reads `versions view` for the **specific new uploaded version**
   and the known active HQ version, rather than trusting a paginated
   version list;
3. compares OAuth, all existing plain-text business flags, disabled
   Contact feature state, exact WORK D1 binding and **names** of all
   four required HQ secret bindings. A new `ASSETS` binding is allowed
   only as the explicit static asset type;
4. rechecks active HQ and gateway deployments, rejecting a changed
   allocation or even a new 0%-deployment reference to the uploaded
   version (this checkpoint requires truly *un-deployed*);
5. returns `HOLD` despite successful inspection. Secret **values**,
   browser Owner login, source-to-published provenance, actual free
   allowance consumption, private entrypoint execution, and
   operational readiness still require independent proof.

Its tests run offline with synthetic Cloudflare snapshots and no
provider mutation or credentials. The exact current version observed by
the owner remains the working WORK baseline for any future reversible
rollout; old receipts are never re-used.

**Next:** Owner performs new postflight read-only command from the
already prepared temporary checkout, after pinning the reviewed source
commit. If metadata drift or missing required secrets is found,
stop without promoting or trying to repair in place. Only after the
postflight plus a new, explicit WORK-only **traffic promotion**
authorization may a protected Owner UI browser review be scheduled.

**Status: UPLOADED, NOT DEPLOYED. WORK visual release remains HOLD.
LIVE and KEEP unchanged; no paid plan enabled.**

## Postflight binding mismatch — owner observed (October 24)

The first authenticated postflight against exact uploaded version
`8fd0153b-3071-47df-8836-81973dab6cb4` returned
`HOLD work_hq_inactive_postflight_existing_binding_removed_or_retyped`.
The final owner PowerShell `Write-Host PASS` printed because it was
executed as a separate later command; it does NOT override the failed
inspection. No promotion is authorized.

The postflight's error occurred **after** checking the pinned WORK D1,
OAuth and existing business flags, required four HQ secret *names*,
CONTACT OFF, and exact plaintext parity against the active version.
Therefore a non-core binding absent or with an altered type is likely,
but the actual name/type is not yet verified. Do **not** guess, ignore
a missing resource or automatically re-upload.

New `--diagnose-readonly` mode in
`scripts/inspect-work-hq-uploaded-inactive-readonly.mjs` uses the same
local bytes, authenticated baseline and preview GETs, exact two HQ
version views, pinned deployment IDs and before/after allocation checks.
It returns only a bounded metadata diff: `removed_bindings`,
`changed_binding_types`, `new_bindings`, each with names and
types only. No secret values or raw HTTP payloads; diagnostic result
remains `status:HOLD`,
`uploaded_version_is_safe_to_promote:false`. The original
`--owner-readonly` remains **strict** and is never overridden by this
diagnostic mode.

Cloudflare documents `CF_VERSION_METADATA` as an opt-in
`version_metadata` binding. Whether it is the observed difference
is UNKNOWN until the owner runs the diagnostic. If this or any other
binding is actually absent from the uploaded version, check whether
the running application depends on it and whether the source/manifest
must be corrected and re-uploaded under **new authorization**.
No automatic approval for ignoring metadata/bindings.

**Current decision: HOLD — the uploaded version has NOT passed
postflight. Do not run `wrangler versions deploy`.**

## Metadata binding difference conclusively identified (Oct 24)

The owner performed a new authenticated `--diagnose-readonly` run
against HQ uploaded version
`8fd0153b-3071-47df-8836-81973dab6cb4`. The precise results:

- active version `44ad4a81-55ad-4f49-9965-61260cc2294d`
  has **14** bindings;
- inactive version has **13** bindings;
- **one removed binding only**:
  `CF_VERSION_METADATA`, type `version_metadata`;
- `changed_binding_types:[]` and `new_bindings:[]`;
- active HQ/gateway deployment pins unchanged, public Version URLs
  still OFF; new version still outside serving traffic.

This is a **configuration parity defect**, not evidence that the
existing four required OAuth/merchant secret binding NAMES,
WORK D1 or existing business flags are absent. No secret VALUES or
actual Shopify Owner browser login were inspected. The strict
postflight correctly denied a promotion. Its conditions remain intact.

Cloudflare's version metadata documentation explicitly states the
Wrangler JSON key:
`"version_metadata":{"binding":"CF_VERSION_METADATA"}`.
Reference:
https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/

New source-only helper:
`scripts/prepare-work-hq-version-metadata-repair-local-only.mjs`.
Explicit `--owner-local-only` validates the existing *unchanged*
owner-pinned 50-file artifact/fingerprint and creates a separate
local manifest:
`dist/server/wrangler.contact-owner-version-metadata-restored.json`.
It adds **one top-level property** `version_metadata` with the
required binding; it preserves OAuth, all existing five business flags,
required secret names, D1 identity, preview_urls=false, worker routing,
source/compiled JS and client assets. Output is exclusive-create
(`wx`) with restricted mode and a newly computed manifest and
full-artifact digest; the original local manifest is untouched.

The helper makes **zero Cloudflare calls**. A future owner
`wrangler deploy --dry-run` using only the new local config may confirm
Wrangler recognizes the version metadata binding without any upload.
It must be inspected and compared before any later, separately
authorized `versions upload` of an amended candidate. The earlier
one-upload approval is already **spent**; never reuse the old
`8fd0153b` candidate or silently auto-promote it.

**HOLD until:** corrected candidate is locally generated, fingerprinted,
dry-run compiled, separately authorized for a new inactive upload,
independently inspected via exact new version ID, and verified to retain
the active binding inventory. Traffic promotion is a second and
independent decision, contingent on account/preview security and
reversible Owner UX acceptance.

## October 24 — corrected second inactive HQ version accepted by metadata postflight

The owner provided Wrangler 4.152.0 output for the **separately
authorized second WORK HQ-only inactive upload**. Exact NEW version:

`d1f4e07f-8c9b-4b40-97a4-0c13d2c5149a`

The completed independent `--owner-readonly` postflight confirmed:
- uploaded binding scope equal to active **14** bindings;
- restored `CF_VERSION_METADATA` type `version_metadata`;
- exact WORK D1 and existing plaintext flags intact;
- all four required HQ secret binding *names* present;
- original 50-file corrected artifact matches fingerprint
  `3625479c615109b980153d40e009f147523e8fe95b53d7403c92afe9abebe9db`;
- both WORK Version URLs still OFF;
- HQ and Gateway ordinary traffic allocations unchanged, with the
  corrected version **outside** the active traffic allocation.

The original active HQ Worker is
`44ad4a81-55ad-4f49-9965-61260cc2294d`
(deployment `f80335de-98ea-4831-b00e-87cd1a397596`).
Original active gateway is
`9322193f-5e87-4479-88c9-39229dddb5f2`
(deployment `4fad4b6f-3596-4797-83a3-05edb7f89097`).
The earlier invalid inactive HQ version
`8fd0153b-3071-47df-8836-81973dab6cb4` must **never** be promoted.

The newly committed read-only
`scripts/inspect-work-hq-visual-activation-readonly.mjs`
will independently prove actual **100% routing of the new corrected HQ
version** only *after* a separate Owner-approved WORK-only deployment.
It compares the active and corrected binding inventories, rechecks
the original gateway and double-reads Version URL settings, and returns
`HOLD_OWNER_VISUAL_ACCEPTANCE` even on success. The source-only
synthetic suite proves it refuses unchanged HQ routing, split/drifted
allocations, exposed Version URLs, absent secrets, and metadata drift.

### Decision boundary before user-visible HQ activation

- **Current status:** corrected candidate UPLOADED + metadata verified;
  not serving traffic, Owner login **not tested**.
- An explicit, new, one-time **WORK HQ version promotion at 100%**
  authorization is required; neither prior inactive-upload approval
  covers this action.
- No change to gateway, D1 schemas, My JILL deployment, themes, Google,
  Contact feature flags, quote-publication/commerce, LIVE or KEEP.
- Owner must be able to roll back to the exact original HQ version
  `44ad4a81-55ad-4f49-9965-61260cc2294d`; confirm deployment
  readback before and after activation. No paid provisioning.
- A **successful post-activation metadata check does not prove** that
  Shopify OAuth/session credentials work, nor does it mean the new
  source-only My JILL PR #156 is live. After activation the owner
  should visit the existing WORK HQ app in Shopify Admin and visually
  test login, navigation, request inbox, single-row details, catalog
  and any enabled messaging/status action. Missing or unavailable
  features remain honest; some flags are still OFF.
- Cloudflare command reference for a later separately approved release:
  `wrangler versions deploy <version-id>@100% --name
  jill-order-desk-canary-work -y`; for rollback,
  `wrangler rollback <original-version-id> --name
  jill-order-desk-canary-work`. Never run on LIVE/KEEP.
- Under no circumstance treat source-only CI as proof that an actual
  Cloudflare traffic shift or owner UX acceptance occurred.

**Status now: UPLOADED + VERIFIED INACTIVE. VISUAL PROMOTION AWAITS
EXPLICIT OWNER AUTHORIZATION.**
