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
