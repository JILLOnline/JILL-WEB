# WORK HQ Order details release — 2026-10-20

Prepared source and local verification; NOT uploaded or activated by Codex.
The Owner inventory supersedes the prior handoff's missing-current-inventory
block. It reports deployment `a67cfa4f-cea0-4590-b0b7-10f6f17acebc`, ordinary
`f9830ddf-4ff7-4e24-896e-3618ee5686d7` at 100%, and quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0%. Historical compact receipts are
spent; do not rerun or widen that profile. No final compact command receipt or
package digest was supplied, so those are not certified retroactively.

## Exact release scope

Inbox and workspace use one original-request Order details renderer: customer
and event information, fulfillment, planning attributes and instructions. Email
address and canonical order_type are omitted from presentation, never deleted
from persistence. Item/variation/per-unit details remain in their own section.
Inbox reads the existing authenticated exact-ID detail route only on opening;
reopening an idle card rechecks it. Loading/errors/wrong-ID models expose no old
customer values. No bulk preload or new backend endpoint is introduced.

This is explicitly `visual_only: false`: the reviewed scope includes the
on-open query as well as presentation. No loader/action, authentication, cache,
command, ownership or business policy change is included.

`scripts/work-hq-order-details-package.mjs` composes runtime source
`576d6b0bcde43c43fda939f42513eefcb5adefb7` plus exactly ten reviewed UI files
from `5fa3b1fb6e7d859d9840fb6329150f7fa44a1aae`. The manifest records their
hashes. It reuses the existing source composer and release executor; it does
not create another data or release state owner. Unreleased quote calculation,
agreement and authority changes on the branch remain excluded. No credentials,
sessions, environment files or Git metadata enter the exported build.

The old compact manifest/guard/profile remain frozen. New profile:
`scripts/release-work-hq-order-details-owner.mjs`. New receipt stem:
`work-hq-order-details-v1`; upload, activation and restoration are each one-use.

## Provider checks and restoration

Fresh Owner preflight requires the exact deployment/allocation above and the
ordinary version's expected source annotation
`a3b0c82e26030c7df6ae5ec9bf7af0c96e5da48d`. The inventory itself did not
include that annotation; it is verified before any upload. Existing D1, all
four secret bindings, runtime/asset settings and 14 ordinary bindings must
match. Catalog/detail/writes/OAuth remain ON; quote drafts, conversation and
Owner bootstrap remain OFF. The 0% quote canary must remain exact.

The collector's null HQ version was a read-only reporting defect: it selected
the gateway version header for HQ. It now selects `X-JILL-WORK-HQ-Version`.
The existing strict HQ verifier independently returned HTTP 200, database ready,
and exact ordinary version f9830ddf... via unsigned GET. The historical null
observation remains in evidence. No secret diagnosis or runtime repair follows.

After an inactive upload, metadata/allocation are read again before activation.
Receipts are reserved before each mutation; uncertain outcomes are held for
`work:hq:order-details:inspect`, which uploads/deploys nothing and sends no signed
POST. Never repeat a release after uncertainty or reset receipts. Restoration
is separately one-use and permitted only for this attempt's exact owned
allocation/message, with no intervening deployment; it returns to f9830ddf...
at 100% and preserves the quote canary at 0%. Provider deployment has no atomic
compare-and-swap; repeated reads cannot eliminate all concurrent-change races.
No app/proxy/extension, gateway/Google, schema/data, secret or billing changes.

## Verification and Owner action

Local isolated source comparison, typecheck/build, compiled connected-read and
navigation contracts, and Wrangler upload DRY RUN pass. Source checks do not
certify authenticated platform acceptance. Earlier synthetic component/browser
review covers 16 cases at 1600/1024/390/320: exact values, omitted email/order
type, no duplicated overview, on-open-only reads, reopen refresh, outage without
stale values, wrong-ID denial and responsive forms. Phone targets remain 44px
and phone fields 16px. Evidence files retain their original local-only scope.

Cloudflare credentials exist only on the Owner PC. On the clean WORK branch,
fast-forward pull, then run the NEW `npm.cmd run work:hq:order-details:release-once`
once. Preserve the complete result. Any failure/uncertainty means inspect, never
repeat. Do not invoke compact/visual/studio/navigation historical releases or
Shopify app dev.

After activation, use the existing authenticated WORK app. Open a known existing
request's Inbox Order details and compare it with the workspace and original
customer request; confirm no email/order type, no duplicated overview and no
new-tab navigation regression. Close/reopen to confirm normal fresh reads;
record actual authenticated evidence. Local simulated outage/wrong-ID checks
are not independent platform ownership proof. No new submission, quote save,
message, invoice or payment is needed for this UI check.

Original uncertain intake reconciliation and the approved quote canary testing
limits remain held. Full WORK operational acceptance is NOT PASSED; customer
LIVE remains a separate reviewed release.
