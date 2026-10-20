## Source-only preparation: candidate as ordinary WORK traffic (NOT AUTHORIZED)

The separate reviewed acceptance promotion is prepared in the WORK
branch **but has not been executed**:

- \`scripts/work-custom-order-candidate-promotion-policy.mjs\`
- \`scripts/promote-work-custom-order-candidate-owner.mjs\`
- \`scripts/test-work-custom-order-candidate-promotion.mjs\`

This proposed new Cloudflare deployment would change the WORK gateway
from original@100%/candidate@0% to
**candidate@100%/original@0%**. Unlike the previous inactive upload and
0% deployment, this would route ALL ordinary traffic for the isolated
WORK gateway to the new candidate. This is a separate potentially
customer-facing change: Owner must explicitly approve this specific
allocation after reviewing the offline guards and the WORK store's
current testing activity. Original version remains in the deployment at
0% as recovery material; automatic rollback is NOT included.

The one-use script checks exact reviewed Git checkout and unchanged
Worker code, prior unique 100/0 deployment, candidate version and
metadata binding, and dry-run before reserving a private one-time
receipt. Only then could it perform ONE exact Cloudflare deployment.
If the deployment succeeds, ONE anonymous **unpinned** GET with a
random UUID must return the actual candidate runtime ID. A missing or
mismatched header is HOLD; no retry or automatic rollback. It does not
submit orders or establish authenticated Shopify/Google/HQ/My JILL
acceptance. All such writes need a further separate Owner authorization.

---

## Status update — runtime version proved, acceptance route pending

The Owner's **single authorized** anonymous pinned GET returned HTTP 200,
\`application/json\`, exact WORK JSON, and the Cloudflare runtime
\`x-jill-work-gateway-version:
9322193f-5e87-4479-88c9-39229dddb5f2\`.
This conclusively proves the **new 0%-candidate executed for that health
request**, but not that it was visited by a signed Shopify app-proxy POST.

The latest audited Worker deployment is
\`4962f2cc-a27b-41db-ae3c-ae3fdcadf7d3\` with
original \`408bdf7c-eb20-4b6e-97dd-3d3b293c6120\` at 100%
normal traffic and new candidate at 0%. The one-time upload, one-time
deployment and one-time anonymous health-probe permissions are SPENT.
Do not rerun any of those three operations.

### Routing and business-write boundary

A shopper's WORK browser POST goes through
\`https://jill-work.myshopify.com/apps/jill-custom-order\`,
Shopify's server-side signed app-proxy forward, then
\`/jill-custom-order-proxy\` at the Cloudflare WORK Worker. The
customer browser does **not** directly control the Shopify-to-Cloudflare
request headers. Therefore the browser's version-override capability,
or an unrelated anonymous pinned health request, cannot establish
that the **signed** Shopify submission reaches the 0% new candidate.

The strict source-only test is
\`node scripts/test-work-custom-order-acceptance-route.mjs\`.
It certifies that, at the currently recorded deployment, normal
storefront traffic uses the **original**, and no synthetic candidate
acceptance write is authorized. CI runs it. The original's Google HMAC
must not be assumed repaired just because the separate candidate key
passed the isolated Google QA credential audit.

Before ONE actual signed WORK synthetic submission, separately establish:
1. A verifiable signed Shopify server-to-gateway route to the new
   candidate, OR a separately reviewed **WORK-only traffic promotion**
   to the new candidate followed by a successful unpinned version
   attribution. A 100% candidate promotion changes all normal WORK
   traffic and is a NEW Cloudflare deployment permission; it is NOT
   authorized by the spent 0% deployment or anonymous probe approvals.
2. The ACTUAL published WORK theme's required
   \`verified_submission_endpoint\` setting is
   \`/apps/jill-custom-order\`, and installed WORK Shopify app proxy
   routes to the exact reviewed WORK Cloudflare Worker; checked-in theme
   JS/Liquid alone cannot prove a deployed theme setting or installed app.
3. The isolated Google QA published /exec revision and project identity
   remain certified. The source-only Shopify and Google tests do not
   independently verify the production Worker secret VALUE; the
   synthetic submission is the first binding-by-binding acceptance test.
4. The disposable WORK test customer is **really signed into Shopify**.
   Record its verified Shopify customer identity through Shopify, never
   by typing an email into a form. Guest email matches cannot assign
   account ownership.
5. Authenticate the real WORK JILL HQ Owner and the real WORK
   customer's My JILL extension separately; only those principals
   may inspect their authorized respective order projections.
6. Obtain one clearly scoped Owner approval for **one synthetic WORK
   submission**, choosing a fresh ID and checking existing records before
   sending, and **never resubmit an ambiguous outcome**. Read the same
   ID from Google QA receipt, JILL HQ, and My JILL. Status revisions,
   receipt signing, and owner indexing must refer to that ID.

No WORK promotion or customer write was performed by this source-only
routing gate. No LIVE/KEEP, R2, Cloudinary, customer email, billing or
paid Cloudflare resource was changed.

---

## Status update — 2026-10-17 (Owner upload succeeded)

The Owner ran the one-time Windows-only inactive upload successfully,
with all 63 offline safety checks passing beforehand. Cloudflare returned
NEW **inactive** version
\`9322193f-5e87-4479-88c9-39229dddb5f2\` and the guarded
readback confirmed that deployment
\`f6809b0e-c8b7-47b6-9cc9-13d071d1ecbb\`
remained exactly original
\`408bdf7c-eb20-4b6e-97dd-3d3b293c6120\` **100%** /
previous repair
\`225cdbb4-46f5-492e-801d-6726bea2703e\` **0%**.
The inactive-upload approval is SPENT. Never rerun
\`scripts/upload-work-gateway-version-metadata-inactive-owner.mjs\`.

The NEXT separate **unapproved** stage is one version allocation update
to original@100% + newly uploaded metadata candidate@0%.
The prior 0% repair will then leave the deployment allocation, but remain
in Cloudflare version history. This is NOT a normal traffic promotion.
It requires new explicit Owner approval. Source-only preparation:

- \`scripts/work-gateway-version-metadata-zero-policy.mjs\`
- \`scripts/deploy-work-gateway-version-metadata-zero-owner.mjs\`
- \`scripts/test-work-gateway-version-metadata-zero.mjs\`

The new script enforces an exact old 100/0 deployment, immutable uploaded
candidate ID and marker, runtime binding/name preservation, branch and
source pin, single-use LOCALAPPDATA receipt before its sole possible
Cloudflare deployment write, and exact new original@100% / candidate@0%
readback. After the deployment, it sends only ONE anonymous pinned
GET \`/healthz?jill_work_version_probe=<random UUID>\`, and requires the
response header \`x-jill-work-gateway-version\` to equal the exact new
candidate ID. Its one optional anonymous baseline GET cannot prove
candidate identity and is treated only as a preflight.

On any post-write HOLD or timeout: never retry, never auto-rollback, and
inspect deployment read-only. The original must remain 100%. Nothing
in this approval authorizes signed Shopify POSTs, Google QA writes,
customer-account testing, LIVE/KEEP changes, or paid infrastructure.

---

# JILL WORK — deterministic repaired gateway version proof (SOURCE-ONLY)

## Problem this replaces

The first WORK Custom Order gateway 0% candidate (version
\`225cdbb4-46f5-492e-801d-6726bea2703e\`) uses byte-identical
application code to the 100% original
\`408bdf7c-eb20-4b6e-97dd-3d3b293c6120\`.
Anonymous health and denied account requests therefore cannot attribute a
version. The attempted Wrangler \`tail --version-id\` proof ended
\`work_gateway_tail_ended_unclassified_nonzero\`, even after 92 offline
checks. **Do not run the Tail script again or report execution proven.**

## Implementation prepared in WORK Git (NOT DEPLOYED)

- \`services/custom-order-cloudflare/wrangler.toml\` now includes the
  Cloudflare-standard \`[version_metadata]\` binding named
  \`CF_VERSION_METADATA\`.
- \`services/custom-order-cloudflare/handler.mjs\` handles one optional
  GET-only \`/healthz?jill_work_version_probe=<random UUID>\`. It
  validates WORK configuration and the existing SQLite-backed Durable
  Object health before reading \`env.CF_VERSION_METADATA.id\`.
- A valid probe preserves the existing JSON
  \`{"ok":true,"environment":"WORK_CUSTOM_ORDERS_QA"}\`
  and adds response header \`x-jill-work-gateway-version: <runtime UUID>\`.
  A missing/malformed metadata binding or probe produces the existing
  fail-closed \`503 {"ok":false}\`. Ordinary health GETs are unchanged,
  with no version header.
- The header value comes exclusively from the Cloudflare **runtime**
  metadata binding, NEVER from the inbound override header, a supplied
  query string or a compiled-in static marker.
- No new endpoint, storage, paid feature, developer logging, customer
  data, Shopify entitlement or Google code is added.
- Offline test: \`node scripts/test-work-custom-order-version-metadata-offline.mjs\`.

## Important: not the already-deployed 0% version

Cloudflare Worker versions are immutable. The currently uploaded repaired
version **does not** contain this binding or header. Forcing the probe
against that version cannot work. Existing versions and deployment must
remain unchanged until a separate Owner authorization.

The earlier one-time \`deploy-repair-zero\` permission was spent, and
its pinned preflight code must not be weakened or rerun. The new source
cannot be uploaded using prior one-shot deployment scripts.

## Future separate permissions (NOT granted here)

1. **Upload stage (requires exact scoped Owner permission):** independently
   audit the new bundle and immutable secret binding names, preserve
   original WORK Shopify app-proxy HMAC, Durable Object class/migration,
   and staged verified WORK Google QA HMAC secret and endpoint. Upload
   **one inactive version only**, without deploying or changing traffic.
   Verify new version metadata and refuse unknown config/secret drift.
2. **0% test deployment (requires another explicit approval):**
   replace the old 0% reference with the newly uploaded candidate at 0%,
   keeping \`408bdf7c-eb20-4b6e-97dd-3d3b293c6120\` at 100%.
   Verify exact deployment ID and version percentages before and after.
   Cloudflare supports only two versions in a deployment.
3. **One anonymous pinned probe:** send
   \`Cloudflare-Workers-Version-Overrides:
   jill-work-custom-orders-qa="<new-candidate-version-id>"\`
   to the known WORK workers.dev host, with a random UUID version
   probe. Require strict 200 WORK JSON **and the exact runtime version
   ID matching the new candidate**. Missing/wrong header is HOLD.
   A 200 alone is not proof: the override could fall back silently.
4. **Then** seek explicit permission for a single authentic synthetic
   Shopify WORK proxy submission and corresponding real Google QA
   signed receipt. Independently confirm JILL HQ Owner inbox under
   real Owner authorization and the same WORK test customer's My JILL
   authenticated session. Never fabricate a Shopify account session,
   treat an email as proof of ownership, send real emails, or retry
   an ambiguous prior submission.

Do not promote the repaired version, submit customer data, rotate
secrets, enable Tail/log retention/Logpush, create paid infrastructure,
or change LIVE/KEEP/R2. The existing original Worker remains serving
100% normal traffic.

Official Cloudflare documentation:
https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/
https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/
https://developers.cloudflare.com/workers/versions-and-deployments/
