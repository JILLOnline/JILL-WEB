# WORK HQ connected catalog/access candidate

## Current evidence and scope

Owner read-only inventory captured `2026-10-19T13:36:11.906Z` on clean
`5c82f340a94f16e9da45151c8778e714e4c054cd` confirms HQ deployment
`d10596df-fb98-4e6d-8b3d-a3bd0e4deaf0`: existing
`4973b74d-d479-41da-897c-e36129303279` at 100% and quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0%. Quote drafts are enabled only
on the 0% version. Gateway allocation and corrected diagnostic remain unchanged.
The collector's unverified app fields are defaults, not a reversal of the
separately verified WORK installation consent receipt.

The Shopify app release and consent are complete. They do not deploy the
Cloudflare HQ application. This NEW candidate packages the current HQ home,
catalog and Owner-only online access evidence. It adds the catalog read flag,
explicitly disables conversation and quote drafts, and adds runtime version
metadata. Existing D1, four inherited secrets, five security flags, runtime and
asset routing must pass independent metadata comparison. No new resources,
secret files, schema migrations, app/proxy/extension changes or paid services.

The canonical authorization owner remains `admin-home.mjs` with the existing
Shopify SDK online session and D1 merchant authority. `/app/access` returns only
the Owner's verified online identity, effective online scopes and action scope
intersections; no tokens or customer data. App-installation scopes and client
claims cannot substitute for online staff scope proof. Draft/invoice policy
features stay disabled. The Owner link is absent for other roles.

## New inactive upload only

`npm.cmd run work:hq:connected:stage-once` is a NEW one-use inactive upload.
It requires a clean, synced WORK branch on the Owner Windows host with the
existing local Wrangler credentials. It rechecks the exact baseline and
bindings, runs source/permission/staging tests, typechecks, builds, tests the
actual compiled Worker locally and dry-runs the package before reserving a
NEW private receipt. Then it requests exactly one `versions upload` and checks
the resulting version, binding/runtime parity and unchanged traffic allocation.

The private receipt is `work-hq-connected-read-v1-upload-once-20261019.json`
in the existing Owner private receipt directory. It is never reset or reused.
The version message contains `JILL HQ WORK connected catalog/access v1 INACTIVE source `
followed by the exact clean runner commit. A failed/ambiguous upload is held.
Use only `npm.cmd run work:hq:connected:inspect` for read-back; it performs no
upload, deployment or signed POST. Do not rerun the stage command or any
historical gateway/HQ upload/recovery command.

**This runner does not activate the candidate or change ordinary traffic.**
It preserves the existing quote canary at 0%. No visible HQ change is expected
from staging. A concrete version receipt must be reviewed before preparing its
separate WORK activation and exact runtime health read-back. No new browser
login attempt was made after the earlier declined login.

## Verification and remaining acceptance

Source guards, permission/failure tests, HQ typecheck and canary build pass.
Wrangler's actual candidate `versions upload --dry-run --keep-vars` passes.
The local compiled Worker test covers version attribution against spoofed
request data, anonymous access/catalog denial, wrong-host denial and disabled
quote/media routes using emulated D1 and synthetic keys. Local harness UUIDs
are not evidence of a deployed version. Tests are included in WORK CI.

Inactive provider upload/read-back, activation, authentic Owner catalog reads,
online staff scope intersection and screenshots remain OPEN. After activation,
open the existing WORK app and use Owner access diagnostics and catalog pages;
independently read the same Shopify resources and preserve exact evidence.
An older online session may require fresh SDK authentication after consent.

The original uncertain intake still needs its exact original submission ID and
payload from private request history. No replay is authorized. Existing quote
Save → leave → Reload canary/testing limits remain unchanged. Google numeric
revision, conversation activation and authentic A/B round trip, commerce,
Rewards, guest ownership, staff revocation, media and authenticated performance
acceptance remain pending. **WORK operational acceptance: NOT PASSED. LIVE
promotion: separate reviewed release.**
