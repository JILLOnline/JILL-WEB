# WORK continuation: verified reads, source changes and exact remaining gates

## Fresh runtime baseline and NEW inactive HQ source candidate

Owner inventory at `2026-10-19T13:36:11.906Z` confirms unchanged gateway and
HQ allocation: `4973b74d-d479-41da-897c-e36129303279` 100%,
`dbc6341f-de7f-41de-8e97-6bf971201eeb` 0%, quote drafts on 0% only.
The Shopify scope release/consent is complete; a separate HQ Worker
update is needed for the newer interface/catalog. The new, tested inactive
candidate and one-use Owner runner are described in
`WORK_HQ_CONNECTED_READ_RELEASE_2026-10-19.md`. No upload or deployment has
been performed for this candidate. Owner Cloudflare credentials are absent
in the executor. Do not reuse any historical upload/release receipt.

New Owner-only online access evidence fails closed without current SDK/D1
Owner authority. It does not certify actual staff permissions until an
authenticated deployed read succeeds. Full WORK remains NOT PASSED; the
inventory's empty blockers array is not acceptance.


## Permission update verified — 2026-10-19 13:34 UTC

The Owner stopped the existing WORK dev preview and restored the active app
version. An independent connector read then showed all five added scopes in
the requested set. After the Owner approved the update, a second independent
read verified `read_products`, `read_inventory`, `read_locations`,
`read_draft_orders` and `write_draft_orders` in the **granted** set of the same
WORK installation `738058829959`. Requested/granted sets now match.
The installation scope gap is closed; effective online staff permissions,
HQ Worker/catalog activation and full acceptance remain unverified.
No new app release, dev preview, customer request or diagnostic is needed
for this completed gate. The previous pending-consent paragraphs below are
historical. Structured proof is appended to
`evidence/work-app-scope-release-2026-10-19.json`.


## WORK app release receipt — 2026-10-19 13:26 UTC

Owner CLI read-back confirms `jill-hq-work-scopes-9dd96ba` /
`gid://shopify/Version/1172776681473` is active in the existing WORK app.
`jill-hq-work-7` / `1167552610305` is inactive and remains the prior release.
All three existing extension bundles were included. The stored staging message
says “unreleased”; the active status and release receipt supersede that message.
**Do not repeat staging or release.**

A fresh authenticated WORK connector read of installation `738058829959`
still reports the prior scope set: none of the five added scopes is granted
yet. Owner Shopify update consent and fresh online staff permission proof
remain required. No HQ Worker or Google conversation activation follows from
this Shopify app release. Full WORK acceptance remains NOT PASSED.
Structured receipt: `evidence/work-app-scope-release-2026-10-19.json`.


Target: `JILLOnline/JILL-WEB`, `jill/rewards-work`, `jill-work.myshopify.com`.
Started from a clean checkout and independently verified remote branch at
`432f2bc4923bc6f794c2a8b65351574d60a76ecc`. No newer work was overwritten.
**Full WORK acceptance: NOT PASSED. Customer-facing LIVE: separate release.**

## Diagnostic: complete, never rerun

The successful Owner receipt is preserved in
`evidence/work-gateway-zero-byte-owner-success-2026-10-19.json`.
Deployment `4fad4b6f-3596-4797-83a3-05edb7f89097`: ordinary
`9322193f-5e87-4479-88c9-39229dddb5f2` 100%, corrected diagnostic
`b6237ad9-3343-4c8b-8b65-7a0194ddc50e` 0%. Exact signed response identified
that diagnostic and verified Google. Isolated QA audit/key preflight passed;
its numeric Google revision is absent from the final receipt. Retrieve it
through the existing read-only QA audit only when required for activation.
No signed challenge, upload, deployment, receipt reset or key rotation was
performed in this continuation. Historical release instructions are spent.

## Fresh authenticated read-back

Public summary: `evidence/work-connected-readback-2026-10-19.json`.

- Shopify connector identity is WORK / Basic App Development / USD. Existing
  app `433779736577`, installation `738058829959`, client
  `f8e1ebdbae84490dc8ea5b133637e6c0` verified. Its actual granted scopes still
  lack product, inventory, location and draft-order access. No scope consent
  or app release occurred. Connector scopes do not certify app/staff access.
- All four catalog queries executed read-only successfully. Products: 15;
  collections: 7; locations: 2; inventory variants: 60 through three complete
  pages. All 60 variants are untracked; stock/capacity remains unknown.
  This is connector query proof, not HQ UI or effective online staff proof.
- Authenticated reads of the exact isolated QA spreadsheet succeeded. Three
  canonical intake rows, two owner rows and three initial received events
  were observed. Each owned row's SHA-256 matches the stored raw payload;
  per-request event revisions are contiguous. Full identifiers, payloads and
  customer GIDs remain in private evidence, never Git.
- Those positive row/event/owner checks do **not** identify the original
  failed operation. Its exact failed submission ID and original outbound
  payload were not available in the recovered private history. The latest
  existing row and a familiar UI short reference cannot be substituted.
  No replay, new submission or inference of absence was made.
- The browser reached Shopify sign-in without an authenticated Owner session.
  Cloudflare and clasp credentials are absent in this executor. Google Sheet
  read access cannot change or certify Apps Script deployments/properties.

## Source changes completed

The existing `work-catalog-read.mjs` now owns bounded product, collection,
location and inventory projections. The existing catalog screen renders them
with native WORK Admin links, fresh source/currency verification, independent
online scope gates and no-store responses. Missing/expired/revoked authority
stops before Shopify reads. Overflow is explicit. Untracked quantity is null,
never a fabricated zero. No catalog/customer database, inventory setting or
production-capacity owner was added. `JILL_WORK_CATALOG_ENABLED` remains OFF
by default; no deployed HQ activation is claimed.

The existing local WORK config preparer has an explicit minimum-scope mode:

```powershell
npm.cmd run work:app:minimum-scopes:prepare
```

It requires the already linked, ignored `shopify.app.work.toml`, adds only
`read_products`, `read_inventory`, `read_locations`, `read_draft_orders`,
`write_draft_orders`, and preserves all existing scopes and non-scope bytes
(for the already renamed app). It performs no release, app-dev, consent or
URL change. Existing branding preparation behavior remains unchanged.
There is no linked config in this executor, so this preparation was tested
with isolated fixtures, not applied to an invented app config.

The API validator lists alternative Location access scopes as a union;
`read_markets_home` is not added. The JILL inventory action deliberately
requires the reviewed product/inventory/location intersection. `write_draft_orders`
may imply read permission at Shopify; confirm actual granted scopes after
consent, never assume the requested strings prove grants.

The existing agreement orchestrator now permits read-back of a draft create
claimed before quote expiry even when recovery occurs after expiry. Expiry
still prevents any fresh create. A failed draft search returns a held
reconciliation state and never authorizes another create. Same one-create
claim, canonical-event prerequisite and customer-mismatch quarantine remain.
Public quote routes/UI, actual commerce adapters and invoice flow are still
unfinished; this is not an operational commerce activation.

## Verification

- Root `npm run postinstall`: PASS.
- `npm run test:work-connected-source`: PASS (local canonical Google writer,
  catalog permission/outage/pagination, existing universal Rewards planner).
- `node scripts/test-work-hq-branding.mjs`: PASS, including minimum-scope
  byte preservation, idempotency, unknown/LIVE config rejection.
- Actual local workerd/D1 agreement test: PASS, including atomic rollback,
  stale/expired/foreign acceptance denial, read outage, no repeated create,
  recovery after expiry, and quarantine.
- HQ typecheck, normal build, canary build: PASS.
- All four generated queries validated against pinned Admin API `2026-07`
  and executed through the WORK connector. This does not validate Shopify
  embedded components in a real authenticated browser.
- Bundle verifier requires a clean commit and is run after source commit.
  It cannot certify parity with a historical released Worker.
- No authentic A/B customer UI, Owner quote Save/leave/Reload, online staff
  revocation, checkout, media expiry, native Rewards or 20-run authenticated
  performance certification was performed. No screenshot is represented as
  an operational proof. Health RTT is not navigation performance.

## Smallest concrete continuation gates

1. Recover the **existing failed operation's** exact ID and original payload
   from Owner private browser/request evidence, without clicking Submit.
   Compare that exact payload hash with its canonical Submissions row,
   immutable owner row and received event via the authenticated QA connector.
   Positive matches for other IDs cannot close this gate. Do not post the
   payload, customer record, key or signed request in Git.
2. Authenticate an Owner WORK Shopify browser session. Re-read HQ allocation;
   the last Owner baseline remains `4973b74d-d479-41da-897c-e36129303279` 100%
   and `dbc6341f-de7f-41de-8e97-6bf971201eeb` 0%, quote flag on 0% only.
   Use the already reviewed canary pin workflow for Save → leave → Reload
   with its existing fixture/testing limits. Do not run generic app-dev.
3. Installation scope release/consent is COMPLETE (receipt above). Do not
   repeat preparation, upload, release or dev preview. Stage the NEW inactive
   HQ catalog/access candidate through its dedicated runner, inspect the
   exact receipt, then prepare its separate WORK activation. Fresh online
   staff authentication and actual scope intersection remain required.
4. Cloudflare/clasp Owner credentials are necessary for the reviewed
   Google/gateway/HQ/extension activation. Start from fresh runtime reads;
   do not replay historical one-use commands. No secret values are needed
   in chat. Keep conversation flags independently OFF until the exact
   reviewed Google revision and Worker versions are verified. Complete
   HQ → A → HQ, B denial, internal-note exclusion and lost-ack recovery.
5. Continue the unfinished exact quote/customer UI, real calculation/create/
   read adapters, canonical accepted-event integration, invoice review and
   reconciliation. Keep ambiguous creation held. Never mark paid or charge
   real funds. Then prove one Shopify test checkout/order independently.
6. Integrate universal Rewards in the existing v13 owner with snapshots/CAS,
   reservation/discount/refund/expiry read-back and actual native checkout
   cases. Existing coupon terms remain unchanged. Guest claim, staff
   revocation, media budget/expiry, accessibility/performance and reviewed
   playground margins/SKUs remain acceptance requirements.

## Recovery

Only source was changed in this continuation. Revert the scoped source commit
if necessary; no remote data/schema, customer wallet, code, request, invoice,
app release, secret, paid service or LIVE/KEEP resource needs reverting.
Future runtime rollback must preserve agreement/operation/wallet records;
code rollback does not undo a Shopify resource. No ambiguous create is retried.
