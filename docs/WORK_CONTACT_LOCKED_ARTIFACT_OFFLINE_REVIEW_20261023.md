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
