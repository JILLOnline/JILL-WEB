# My JILL — protected WORK preview and release-certification gate
Date: October 25, 2026
Status: **SOURCE READY FOR REVIEW; NOT PREVIEWED IN SHOPIFY; NO RELEASE APPROVAL**

## What was independently checked

- My JILL customer-home and contact-draft unit/Preact build workflow previously
  passed on PR #156, including signed Custom Order read models, Rewards
  presentation ownership, account-bound navigation, negative Contact identity
  tests and offline source bundling.
- The HQ + My JILL + visual merge rehearsal in draft PR #159 passed as an
  ephemeral source/build integration. This does **not** mean that the
  Customer Account extension was published or rendered in WORK.
- The broader `My JILL WORK account certification` workflow is **red** on the
  PR merge ref (run 40113991937). Leave that result red until the underlying
  legacy release-source issues are independently reconciled.

### Why the broad certification is red

These are the *actual failing jobs* from the October 24 PR certification run.

| Job | Failure | Safe disposition |
| --- | --- | --- |
| Verify single Rewards owner and WORK account contracts | `STOP wrong source branch` in `work-hq-master-v4-edition.mjs` | This historical WORK HQ source pin rejects the detached PR merge/branch. Do not change the release SHA, pretend this is a customer-account acceptance, or disable the test. Validate legacy source on its explicitly pinned release branch, then review the new My JILL delta separately. |
| Build WORK embedded Shopify Admin App Home | Same `STOP wrong source branch` from the same historical guard | Preserve the historic guard; continue testing the source combination in the existing read-only three-lane ephemeral merge, not by manufacturing a different branch identity. |
| Package WORK Cloudflare Worker (dry run only) | `work_gateway_diagnostic_release_source_unreviewed` from `prepare-work-gateway-diagnostic.mjs` | Historic gateway release-package hash/source ancestry requires separate review. Never loosen it to make the customer extension look green. The diagnostic is not a reason to republish the gateway. |
| Historical Requests snapshot and Windows Node 24 postinstall | Passed | Preserve these results without treating them as customer-account browser certification. |

The nearby error strings about an unknown/non-WORK Shopify app or LIVE URL
occurred inside intentional negative configuration tests that subsequently
reported PASS. They are **not** evidence that an actual LIVE config was used.

## New read-only readiness inspector

`node scripts/inspect-myjill-work-preview-readiness.mjs`

This command prints a **sanitized JSON report** and performs no network call,
writes, Shopify CLI action, or deployment. It checks that:

- The canonical My JILL source modules and WORK-only canary builder exist.
- Contact V2 still has `enabled={false}` in the customer Hub.
- The local canary refuses unrecognized directories and preserves its own
  isolated `.work-account-canary` path.
- The canonical `rewards:work:hub:preview` command still targets only
  `jill-work.myshopify.com`.
- The *locally ignored* `shopify.app.work.toml`, if present, independently
  passes the actual WORK-only client ID, name, scopes and LIVE-domain denial.

Results explicitly distinguish `source_verified` from
`local_preview_prerequisites_met`, and ALWAYS report:

- `real_shopify_browser_render_verified: false`
- `customer_A_B_guest_verified: false`
- `rewards_redemption_runtime_verified: false`
- `legacy_account_certification_cleared: false`
- `extension_published: false`
- `cloudflare_deployment_performed: false`

A GitHub Actions runner does **not** have the ignored linked app file.
Thus a normal green CI source check will report
`local_work_app_link_missing` and **not** a false readiness success.

For an actual linked local WORK checkout only:
`node scripts/inspect-myjill-work-preview-readiness.mjs --require-local-work`
fails closed with exit code 2 if the linked WORK app isn't independently
verified. It NEVER creates a config, reads/prints secrets, or links a Shopify
account automatically.

## Before opening an actual Shopify WORK customer browser

Owner must independently review the WORK store/client identity, current
published extension UIDs, current runtime and rollback pins, and any locally
linked WORK config; do **not** copy LIVE secrets or apps. Require a fully
clean reviewed source, known current WORK baseline, and distinct Owner
approval to start an isolated Shopify CLI dev session. No automatic
`shopify app dev`, `shopify app deploy`, or Cloudflare command is run by
this readiness check.

The existing, isolated (but **not executed here**) preview command is
`npm run rewards:work:hub:preview`. It prepares the sentinel-marked
ignored canary directory and then starts `shopify app dev` against the
linked WORK app. Shopify CLI dev can change a development preview session;
use it only when its effect on the connected WORK app is understood and
authorized. Never use `npm run deploy` or any release task as a preview
shortcut.

## Browser acceptance matrix — required actual observations

| Test | Narrow phone 375–390 px | Tablet 768 px | Desktop 1280–1440 px |
| --- | --- | --- | --- |
| Overview signed recent requests, loading/unavailable/empty truthfulness | HOLD until real preview | HOLD | HOLD |
| Nine grouped routes, deep links, back navigation and focus targets | HOLD | HOLD | HOLD |
| Custom Orders active/finished filters, expandable request history, exact Home tracking link | HOLD | HOLD | HOLD |
| Original Shopify Orders and Profile navigation | HOLD | HOLD | HOLD |
| Rewards balance from signed account, redemption modal, wallet/expiry/coupons | HOLD (no points spend until separately approved) | HOLD | HOLD |
| Customer A vs B vs guest and account switch; no cross-account requests or drafts | HOLD | HOLD | HOLD |
| Contact V1 unavailable/claimed behavior, V2 composer intentionally OFF | HOLD | HOLD | HOLD |

During acceptance, do not enter real customer personal data into issue
comments, CI logs or screenshots. Mask order IDs, email, names, addresses,
phone, JWTs and discount codes. Signed fixtures/test accounts only.

## Release rule

Keep PR #156 and the three-lane PR #159 in **DRAFT**.
Passing isolated source CI means *ready for visual inspection*, not
*ready to publish*. Before any WORK-only publication, resolve or
independently disposition the broad historical certification failures,
verify a real Customer A/B/guest browser session, review exact extension
UIDs and OAuth permissions, and obtain explicit owner authorization.
Contact V2, HQ messaging, quote writes and migrations require separate
authorization. No paid Cloudflare resources or LIVE/KEEP changes.

## New: Shopify account-switch draft fence (source only)

My JILL's previous full-page hub held pending Custom Order and Contact
drafts across section navigation, and only each individual list reader
reauthorized its own records. This could leave **unmounted** draft state
in memory while the customer identity changed in another tab.

The updated source adds:
- `loadAccountHubScopedSummary` which reads Shopify's canonical
  `customer.id` with the existing authenticated Customer Account API
  summary query; it validates a nonzero Shopify Customer GID. This
  transient ID is never printed, included in a merchant request, used
  instead of JWT ownership, or persisted in storage. The public Rewards
  summary shape and transaction engine are unchanged.
- `reconcileMyJillAccountScope` fail-closed immutable transitions.
  While identity is being rechecked, the account-owned screens are
  withheld. A failed/guest/malformed Shopify response clears the scope.
- `ConnectedHub` revalidates on customer-account navigation events and
  when the page becomes visible after being in the background. Async
  generation checks suppress a late former-account response.
  The `AccountHub` instance is keyed to the freshly verified Shopify
  principal: Customer A→A retains legitimate pending drafts, A→B
  remounts the hub and discards A's in-memory drafts, and A→guest/error
  remounts with no owner data.
- `scripts/test-myjill-account-switch-fence.mjs` tests the signed
  identity projection, invalid IDs, state transitions, and source
  event/remount wiring. This remains an offline source check, **not**
  a real browser account-switch acceptance.

Important limits: observing actual account changes depends on Shopify
customer-account runtime events, document visibility and normal
remount behavior. It does not prove that silently changing credentials
without any navigation/visibility event is detectable. Every remote
request still requires its **own signed Customer Account JWT** and
exact owner check. Avoid falsely equating a React component key with
server authorization. The previous real Customer A/B/guest browser
acceptance gate remains open. No Shopify app publication or WORK
Cloudflare deployment was performed by these commits.
