# JILL — Unified WORK runtime acceptance gate (October 23, 2026)

**Decision: HOLD for real customer traffic.** This is a read-only commissioning
runbook, NOT approval to deploy, merge protected source, migrate a database,
send email, issue an invoice, create Shopify Orders, use paid infrastructure,
or enable a customer-facing write.

## Grounded proof received

| Scope | What was actually proved | What was not proved |
| --- | --- | --- |
| Shopify WORK store | Read-only connected Shopify Admin reports shop `jill-work.myshopify.com`, USD, "JILL WORK" | Storefront app-proxy child routing and deployed extension code |
| JILL HQ — WORK app | Shopify Admin GraphQL `appByKey` for WORK client ID returns **installed, embedded**, with granted scopes for products, inventory, customers, orders, draft orders, discounts and app-proxy reads/writes | Actual current app version, owner online session, REST/webhook agreement or customer reply |
| HQ source | PR #157 source preview and isolated app build pass | Deployed HQ source version/active D1 schema |
| My JILL source | PR #156 preview and paired Customer A/B module tests pass | Real WORK Shopify Customer Account extension release |
| Source merge | GitHub merge rehearsal `40002171644` merged PR #156 into PR #157 *temporarily*, ran selected tests, TypeScript and build successfully; did NOT commit or push a merge | Protected historical release certificate, real customer authorization |
| WORK HQ D1 | Verified *source* configuration `services/jill-order-desk/app-home/wrangler.canary.jsonc` binds `JILL_ORDER_DESK_WORK_DB` to the named WORK database and migrations directory | Today's authenticated Cloudflare account bindings or remote 0004 schema |
| Custom Order gateway | `services/custom-order-cloudflare/wrangler.toml` contains NO Contact D1 binding | Any approved, authenticated handoff between the public gateway and HQ D1 |
| Contact Us | Source-only intake, ticket, claim, status, audited messaging, and customer read contracts are present and tested with simulated accounts | Native form forwarding, spam-equivalent abuse checks, real customer message readback |
| LIVE and KEEP | No changes made in this task | No statement about independent older systems' current health |

### Specific HOLD conditions

1. **Cloudflare authority missing:** This session cannot inspect the current authenticated Cloudflare Workers and D1 metadata. The public Worker health URL was not accessible from the browsing path. Historical runtime evidence is not current-version proof.
2. **Contact schema absent from an attested runtime:** Migration `0004_work_contact_tickets_source_only.sql` exists in a draft only. Must inspect the remote WORK D1 schema *before* any migration; a partial migration is a hard stop.
3. **Cross-Worker permission route unresolved:** The public Custom Order gateway is intentionally not bound to HQ's privileged D1. Do not casually add the database binding to a public Worker just to clear a source test. Review a least-privilege server-side handoff and abuse limits first.
4. **Shopify app-proxy destination unverified:** WORK app's granted `read_app_proxy` and `write_app_proxy` scopes do not establish the active proxy target, signature, path-prefix forwarding, or live form delivery.
5. **Two release baselines remain distinct:** My JILL protected Rewards WORK source certificate is branch-locked and still fails on the draft for its intended locks. Passing preview CI is not a waiver.
6. **Customer A/B/guest acceptance missing:** Signed Shopify Customer Account user A (owner of claim), B (unrelated), and guest must be tested on real WORK with no email-based claim and no private data leak.
7. **Commerce not commissioned:** Quote/discount/tax/shipping agreement, approval, Shopify draft order/invoice/payment and fulfillment tracking are later independent checkpoints.

## One-command safe inventories (only from a locally checked-out WORK draft with authenticated owner Wrangler)

- Offline, no network: `node scripts/inspect-work-contact-d1-readonly.mjs`
- Opt-in **fixed metadata SELECT only**: `node scripts/inspect-work-contact-d1-readonly.mjs --owner-readonly`

The second command reads only six known table/trigger names from
`sqlite_master` in the **existing HQ WORK D1** using the pinned WORK
canary Wrangler config. It does **not** query customer rows, run a DDL
statement, print secrets, stage keys or require PowerShell. It fails closed
if Wrangler is absent, auth unavailable, a different account/DB binding is
present, or partial/unknown metadata is seen. The result remains HOLD
even if the names exist; full schema and running Worker provenance still
need separate independently authorized verification.

Do not run a migration or switch `JILL_WORK_CONTACT_*_ENABLED` flags
until the above prerequisites are reviewed. The existing Shopify
`{% form 'contact' %}` must continue to work normally until a
separately reviewed WORK-only switch-over. Never dual-send.

## Exact first end-to-end acceptance sequence

1. Read-only Cloudflare metadata + source version inventory, including
   authenticated active Worker and D1 binding identity; compare with the
   expected isolated WORK scope. No change to traffic.
2. Review remote D1 migration history and schema; design a documented,
   reversible and quota-bounded WORK-only migration; require explicit
   commissioning approval before any remote write.
3. Verify WORK Shopify active app-proxy forwarding and staff Owner
   authorization independently. **Do not activate CONTACT intake yet.**
4. Run a QA-only synthetic Contact Us submission, then verify exact
   HQ ticket ID and single canonical D1 record with idempotent retry.
5. With signed Shopify accounts A and B, verify proof-of-possession claim,
   HQ saved public message, A's My JILL readback, B and guest denial, and
   status revision equality. Check no email/push/read receipt is falsely shown.
6. Regress the original **Custom Order** form, authorized HQ inbox/status,
   Customer A/B/guest reads, signed Google QA owner proof and Shopify
   product variant association.
7. Then complete and separately certify customer replies, immutable quote
   acceptance, Shopify tax/shipping/draft orders/invoices/orders, rewards
   discount reconciliation, fulfillment and tracking.
8. Only after independent preview and protected release certificates,
   explicit owner review, and free-tier usage check may a WORK release
   be proposed. LIVE/KEEP promotion is a different authorization.

**No endpoint flags, migrations, releases or customer messages are
activated by this document, its read-only inspector, or the source CI.**

## Owner-confirmed WORK migration 0004 — completed October 23, 2026

This section supersedes the earlier **pending 0004 schema** statements above,
but does not change the overall **HOLD for runtime activation** decision.

The owner executed Wrangler `4.152.0` from the isolated, reviewed HEAD
`9e2d64df9d88ef863111b31b9e8965cb9c621255`, using the existing
`services/jill-order-desk/app-home/wrangler.canary.jsonc` configuration.
A guarded preflight confirmed:

- remote database `jill-order-desk-work`, database ID
  `3f17c186-c794-4e00-8f20-017191373a19`
- existing `d1_migrations` records for **0001**, **0002**, **0003**
- only pending migration `0004_work_contact_tickets_source_only.sql`
- pre-execution contact schema `unapplied`
- an available pre-execution D1 Time Travel bookmark, preserved locally
  by the owner (the bookmark is deliberately **not** committed)

**Actual remote write:** Wrangler
`d1 migrations apply jill-order-desk-work --remote --config
./wrangler.canary.jsonc` returned one successful `0004` migration
(`10 commands` executed; no error). The immediately subsequent
authenticated read-only `inspect-work-contact-d1-readonly.mjs` result
was `remote_schema.state = "present_unverified"`, with **all six expected
tables/triggers found** and no names missing:

- `jill_work_contact_tickets`
- `jill_work_contact_status_events`
- `jill_work_contact_messages`
- `jill_contact_initial_event`
- `jill_contact_status_revision_guard`
- `jill_contact_status_event`

The post-inspection returned `status:"HOLD"`. The original inspector
also emitted `migration_performed:false` and
`customer_messages_enabled:false` as **hard-coded inspector-only
placeholders**; those did *not* mean that Wrangler had not applied the
migration or that current deployed runtime flags were verified.
A subsequent source-only fix renames them to unambiguous
inspection-specific fields and marks runtime message flags unverified.

**Next read-only postflight:** independently confirm the remote
`d1_migrations` entry for `0004`, the three named indexes and the
existing merchant/quote/session tables. No further migration commands
are required for this checkpoint. In particular, **do not reapply 0004
or restore the database automatically**.

Still NOT verified: actual active HQ / gateway Worker versions and D1
bindings, active Shopify proxy child path, real Customer A/B/guest JWT,
Staff Owner online authorization, public form routing, feature flags,
real message persistence, rollback execution, quota/cost limits for new
traffic, or protected-account release certificate.

**No Shopify/Cloudflare Worker deployed, no My JILL extension published,
no LIVE/KEEP changes, and no paid infrastructure enabled** as part of
the authorized D1 schema migration.

## Post-0004 WORK current deployment inspection — source-only addition

After the owner-confirmed remote `0004` migration, the next task is
**active Worker inventory**, not another schema migration. The reviewed,
hard-OFF inspector is
`scripts/inspect-work-contact-runtime-readonly.mjs`.

- `node scripts/inspect-work-contact-runtime-readonly.mjs` — OFFLINE
  source-only check. No Cloudflare connection.
- `node scripts/inspect-work-contact-runtime-readonly.mjs --owner-readonly`
  — owner-authenticated **fixed Wrangler metadata reads only**. Requires
  Wrangler installed in the isolated HQ WORK checkout. Reads
  `deployments list --json`, `versions view <active-id> --json`, then
  `deployments list --json` again for **both** named WORK Workers.
  It refuses split or changing traffic allocations and views only the
  currently deployed **100%** version, never "newest uploaded."
  The script contains no `deploy`, migration, secret write or provider
  POST command.

A passing readback must establish:

1. Active HQ Worker `jill-order-desk-canary-work` has the existing
   exact WORK D1 ID, correct canary host stage, and Shopify OAuth
   enabled for the already-operational Owner application.
2. Active public WORK Custom Order gateway
   `jill-work-custom-orders-qa` has the expected rate limiter and
   required **secret names**, and has **no private D1 binding**.
3. Contact Us inbox/status/message flags in HQ and
   intake/claim/list/thread flags in the gateway are absent or
   explicitly `false`. Any `true` or ambiguous flag is a STOP, not
   permission to turn it off automatically.
4. The before/after active deployment allocations are identical.

The report omits secret values, private ticket rows, raw JWTs and
Customer IDs. It always reports `HOLD`, because binding inventory does
**not** prove published source commit, authenticated Customer A/B
behavior, app-proxy route acceptance, or approval to activate.

**Security regression:** HQ Contact Us status and public-message
commands now require an explicit same-origin browser `Origin` before
Shopify Owner authorization. The top-level Worker denies cross-origin
POSTs for all `/app/contacts/` descendants, including URL-encoded
ticket IDs. Exact Owner/staff D1 authorization, idempotency and
per-ticket ownership checks remain required. No Contact flags were
enabled by this source change.

## Owner-attested active Cloudflare WORK versions (October 23, 2026)

Using the isolated HQ draft at Git commit
`16d9ebbc25a5e74c31c1e4656177c622fbde76b1`, the owner ran
`node scripts/inspect-work-contact-runtime-readonly.mjs --owner-readonly`.
The script completed successfully and returned the following **active
100%-traffic** metadata (not the newest uploaded version):

| WORK target | Active version | Deployment |
| --- | --- | --- |
| HQ `jill-order-desk-canary-work` | `44ad4a81-55ad-4f49-9965-61260cc2294d` | `f80335de-98ea-4831-b00e-87cd1a397596` |
| Gateway `jill-work-custom-orders-qa` | `9322193f-5e87-4479-88c9-39229dddb5f2` | `4fad4b6f-3596-4797-83a3-05edb7f89097` |

For both Workers, `correct_work_bindings_observed:true`,
`contact_flags_present:[]`, `contact_flags_enabled:false`.
HQ retained the exact WORK D1 binding; the gateway continued **without**
private D1. Both deployment allocations remained stable across reads.
`secret_values_read:false`; no secret or customer data was accessed.

The runtime inventory **did not establish source commit provenance**,
Shopify proxy destination, the running customer's JWT, or that draft
source changes were deployed. `status:"HOLD"` remains correct.

### Post-migration D1 independent verification

`scripts/verify-work-contact-d1-postflight.mjs` (new source-only tool)
checks the remote WORK `d1_migrations` row for 0004, all **3 tables,
3 named indexes, 3 audit triggers**, and all **7 original HQ merchant,
session, quote and request-index tables**. It uses only bounded
`SELECT` queries against `sqlite_master` and `d1_migrations`.
Without `--owner-readonly`, it is offline and reports unverified.
Its standalone tests run in GitHub CI. Remote postflight remains
unverified until the owner explicitly runs the read-only mode.

### Critical routing decision before any activation

The draft Cloudflare gateway Contact handlers currently expect an
`env.JILL_ORDER_DESK_WORK_DB` binding. The **running gateway is correctly
not bound to private HQ D1**. Simply flipping
`JILL_WORK_CONTACT_INTAKE_ENABLED` or adding this D1 binding to the
public gateway is **not an acceptable release**.

The next source design must provide a narrowly scoped,
authenticated **server-to-server WORK-only handoff** (prefer reviewing
a Cloudflare Worker service binding to the existing HQ Worker, with a
private endpoint, explicit same-store authentication, bounded body,
replay resistance, quotas and no customer ownership by email).
The HQ side alone should own privileged D1 access; incoming Shopify
app-proxy requests authenticate the WORK store, while Customer Account
JWT + possession claim authenticates an individual customer. All
customer-/merchant-facing flags remain absent/OFF until that separation
is implemented and certified.

No Worker service binding, secret, route, migration, activation or paid
service was provisioned by this source-only decision. The Shopify
native Contact Us form remains authoritative; do not dual-submit.

## Private gateway → HQ Contact Us RPC bridge (source-only)

**New scope after authenticated D1 0004 postflight:** The owner verified
`applied_history_verified`, all **3 tables / 3 indexes / 3 triggers**, and
all seven preserved HQ merchant/quote/session tables. No further schema
migration is needed for Contact Us v1.

Source candidate now includes:

- `services/jill-order-desk/work-contact-private-bridge.mjs`: the
  **HQ-only** internal dispatcher, requiring
  `JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED=true` **and** the
  operation-specific HQ flag. Every call still validates the original
  Shopify app-proxy signature or Customer Account JWT/claim token in
  the existing WORK handlers before touching or returning private data.
- `services/jill-order-desk/app-home/workers/app.ts`: exports the
  named `JillContactPrivate` Cloudflare `WorkerEntrypoint` with
  `fetch(request)` for a Service Binding. This is **not mounted as a
  public HTTP route**; the original HQ default HTTP fetch stays intact.
- `services/custom-order-cloudflare/handler.mjs`: Contact intake,
  ticket claim, account listing and private thread reads use
  `env.JILL_WORK_HQ_CONTACT_PRIVATE.fetch()` instead of an HQ D1
  binding. If the private binding is missing, disabled or fails,
  Contact Us responds unavailable. The gateway enforces WORK
  Durable Object global/client quota **before** calling the private
  entrypoint and forwards only the relevant authentication,
  content-type and Origin headers plus a bounded request body.
- `services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml`
  is a **separate, unshipped** WORK gateway manifest selecting the
  `JillContactPrivate` named entrypoint on
  `jill-order-desk-canary-work`. The currently published/default
  `wrangler.toml` intentionally has **no** service or private D1
  binding, and this draft does not switch the deployment configuration.

**Commissioning blockers:** Keep `JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED`
absent/OFF at HQ, all operation-specific Contact Us flags OFF in both
Workers, storefront mode OFF, and My JILL Contact feature OFF.
Do not upload or deploy the candidate manifest before a full paired
review of authentic Worker RPC bindings and registered entrypoint,
deployed Worker build/version provenance, quota and anti-abuse safety,
Shopify app-proxy forwarding, Customer A/B/guest proof, real Owner
authorization, native form fallback, and free-tier impact.

The existing Cloudflare service binding is **not yet provisioned**.
Passing synthetic tests proves behavior only; it is not evidence that
`JillContactPrivate` is currently published, that Shopify and HQ
secrets correspond, or that actual customer requests pass.

No customer information was read, no D1 change was performed, no
Worker uploaded/deployed, no live merchant/Shopify/Google traffic was
sent and no paid resource was enabled by these source edits.

## Paired RPC bundle and full-path synthetic certification (2026-10-23)

The draft private Contact bridge now passes **real compiler checks** in
the JILL HQ quote+catalog preview workflow:

1. `JILL_BUILD_TARGET=canary npm run build --prefix
   services/jill-order-desk/app-home` emits both the existing default
   HQ Worker fetch and its named `JillContactPrivate` entrypoint, as
   independently checked in `scripts/check-work-contact-hq-bundle.mjs`.
2. `wrangler deploy --dry-run --config
   wrangler.contact-bridge.candidate.toml --outdir ...` compiles the
   distinct, **unshipped** gateway candidate. Wrangler 4.152.0
   reports `JILL_WORK_HQ_CONTACT_PRIVATE` bound to
   `jill-order-desk-canary-work#JillContactPrivate` and exits at
   `--dry-run` without uploading or deploying.
3. `scripts/test-work-contact-private-e2e.mjs` exercises the REAL
   gateway forwarding code and REAL HQ private controller with a
   synthetic in-memory D1 and synthetic Shopify signature/JWTs:
   storefront signed intake → private HQ D1 record → Customer A
   proof-of-possession claim → authenticated merchant public message
   → Customer A's My JILL thread; Customer B and guests denied;
   idempotent retry, no private PII response and quota-before-RPC.
   All customer data, tokens and account IDs in this test are synthetic.
4. The full-path test found and fixed an actual gateway boundary bug:
   `/jill-contact-account` is a signed Customer Account **empty-body
   POST**. The previous private forwarder returned 400 when
   `request.body` was absent. The source-only fix forwards this
   route's empty request correctly; intake, claim and thread POSTs
   still require a bounded body.

Tests passing in GitHub are **not** proof of deployed Worker revision,
same-secret binding across actual HQ/gateway, Shopify app-proxy child
routing, real Customer A/B session behavior or live messaging delivery.
The installed original `wrangler.toml` and the active Workers remain
unchanged; no private Service Binding is provisioned, no customer
features enabled, no release certificate bypass, no paid resources.
For a later WORK commissioning phase, verify the actual deployed
JillContactPrivate export and exact private binding before any
feature flag activation. Preserve the Shopify-native Contact Us form
as the only live intake until its switch-over is independently approved.

## Paired Contact release: checked-in canary manifest is not a safe deploy input

The owner-confirmed active HQ WORK Worker (version
`44ad4a81-55ad-4f49-9965-61260cc2294d`) has Shopify OAuth **ON**.
The checked-in `services/jill-order-desk/app-home/wrangler.canary.jsonc`
still intentionally declares
`JILL_WORK_OAUTH_ENABLED="false"` for disconnected source builds.
**Do NOT run `wrangler deploy` against this raw canary manifest.**
That would risk disabling the already-functioning WORK Shopify HQ login
and may fail to preserve the exact active runtime bindings/secrets.

New **offline fail-closed acceptance tools**:

- `scripts/audit-work-contact-paired-release.mjs` verifies WORK
  tenant/D1 scope, existing public gateway isolation, the exact
  *unshipped* named service-binding candidate, feature flags still OFF,
  the native Shopify Contact Us form as fallback, and the absence of
  public gateway D1 access. It **always returns HOLD**. It explicitly
  marks direct deployment of the checked-in HQ canary manifest unsafe.
- `scripts/test-work-contact-paired-release.mjs` provides adversarial
  tests for a wrong Shopify Worker, wrong D1, enabled Contact flags,
  gateway D1 binding, changed service entrypoint, wrong HQ worker,
  removed native Contact form, and OAuth configuration drift.
- `scripts/check-work-contact-hq-bundle.mjs` checks both the compiled
  named entrypoint and the generated `dist/server/wrangler.json`
  configuration for WORK D1 identity, OAuth-OFF source-only guard,
  canary target, no unexpected service binding and no Contact flags ON.
  This proves a build artifact's source scope, **not** deployment
  readiness.

### Separate authorization needed before the first inactive paired upload

Even a **0%-traffic** WORK upload requires a deliberate approval and a
reviewed configuration that preserves the deployed HQ Shopify OAuth ON,
the current merchant/session secrets, D1, OAuth host, existing flags,
assets and merchant routes. The gateway candidate must separately
preserve its known WORK secrets, Durable Object limiter, existing Custom
Order route, and only add the named `JillContactPrivate` service binding
with all Contact flags OFF. Read back exact uploaded version IDs,
bindings, and allocations. Do not promote traffic automatically.
Real Owner login, Shopify app-proxy child route, synthetic WORK
Customer A/B/guest, staff message readback and native form
single-delivery regression must pass before any Contact activation.

The `0004` schema migration is already independently verified and
requires no repeat. No paid upgrade, LIVE/KEEP action, or Shopify
production change is authorized by these read-only source checks.

## Latest release blocker: exact active-binding parity before any upload

A successful local build is not enough for Cloudflare's **running WORK**
services. The original canary manifest in Git deliberately keeps OAuth
OFF while the active Shopify Admin HQ runtime has OAuth ON. Active
HQ/gateway Workers can also contain plaintext variables, secrets,
Durable Object bindings and flags that are absent from the checked-in
manifest. Dropping any of those would risk breaking current features.

The new `scripts/plan-work-contact-binding-parity.mjs` provides
a **pure/offline** comparison of active Worker version metadata versus
reviewed Contact bridge candidate sources:

- HQ: preserves Shopify OAuth ON, canary host, Owner bootstrap OFF, the
  exact WORK D1 identity and the existence of critical Shopify/session
  secret bindings. Compares **every active plaintext variable** with
  the OAuth-preserving candidate. If any active value is missing or
  different or an unsupported binding appears, the candidate is **NO**
  for staging. No secret value is extracted or considered attested.
- Gateway: rejects active public D1, enforces existing Shopify/Gateway
  secret **names** and Durable Object limiter, requires the private
  candidate target `jill-order-desk-canary-work#JillContactPrivate`,
  and reports other existing binding names that a future release must
  explicitly preserve. No unsafe assumption is made about Wrangler
  secret inheritance.
- Both: Contact flags must be OFF; every result remains `HOLD` and
  `upload_or_deployment_authorized:false`.

`scripts/inspect-work-contact-paired-baseline-readonly.mjs` exposes
a second, optional `--owner-readonly` mode. It can check the
**currently active 100%-traffic** HQ and gateway version metadata
with Wrangler, pin the previously owner-attested version IDs and verify
unchanged deployment allocations before running the parity planner.
By default it runs **offline with zero remote calls**. It never
deploys, migrates, submits forms, changes traffic or logs secret
values. It cannot prove *secret-value* continuity or an uploaded
candidate's actual runtime handlers; those need a separate signed
staging and post-upload acceptance procedure.

Exact baseline IDs most recently reported by the owner:
HQ `44ad4a81-55ad-4f49-9965-61260cc2294d`,
gateway `9322193f-5e87-4479-88c9-39229dddb5f2`.
Changes from either baseline produce a new review, not an automatic
promotion. **No staging or activation authority is implied.**

## Owner-confirmed active WORK parity blockers and protected candidate reconciliation

The owner ran `inspect-work-contact-paired-baseline-readonly.mjs
--owner-readonly` against the **same** pinned 100%-traffic active WORK
versions (HQ `44ad4a81-55ad-4f49-9965-61260cc2294d`, gateway
`9322193f-5e87-4479-88c9-39229dddb5f2`). Both identities and
allocations verified. The source-only HQ OAuth-ON candidate was **NOT**
ready to upload because its runtime parity lacked five *existing* HQ
boolean variables:

- `JILL_WORK_CATALOG_ENABLED`
- `JILL_WORK_CONVERSATION_ENABLED`
- `JILL_WORK_HQ_DETAIL_ENABLED`
- `JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED`
- `JILL_WORK_MERCHANT_WRITES_ENABLED`

The owner-provided inspection exposed variable **names, not values**.
Do not guess their states or disable existing features. The gateway
also has `JILL_CUSTOM_ORDER_QA_BACKEND_URL` as an existing
**secret binding name** alongside its two other secret names. Do not
turn that URL into a plaintext variable or overwrite its value.

New protection: `reconcileActiveHqContactManifest()` reads those
five exact boolean values **in memory from authenticated,
version-pinned Cloudflare metadata** and copies only those known,
already-existing controls into an OAuth-ON local candidate; it refuses
any unrelated added/missing plaintext variable, malformed value,
unsupported binding, enabled Contact flag or incorrect WORK D1.
Its output must not be treated as deployment approval. The source-only
test covers both true and false existing states with synthetic data.

The gateway's separate *unshipped* Contact binding candidate now
declares `[secrets].required` with the three exact WORK secret
binding **names**: `SHOPIFY_WORK_APP_SECRET`,
`JILL_CUSTOM_ORDER_GATEWAY_SECRET` and
`JILL_CUSTOM_ORDER_QA_BACKEND_URL`. The planner independently
rejects any mismatch with the **active** secret names.
Wrangler has an explicit required-secret validation mechanism but
the candidate's secret values have **not** been independently verified
on a newly staged version. The public gateway still has no D1 binding.

`inspect-work-contact-paired-baseline-readonly.mjs` now reports a
separate `hq_reconciliation` summary with the restored setting
**names**, the preserved existing secret **names**, and
`candidate_plaintext_parity_after_reconcile`; it **never prints
actual business-variable values, secrets or a candidate manifest**.
The command remains read-only and always returns `status:"HOLD"`.
The extra synthetic CI dry-run compiles the same reconciler using
dummy true/false values and a temporary build output. No authentic
Worker version, Shopify setup, D1, or customer data is modified.

The next owner read-only baseline observation is required to verify
the reconciliation against actual Cloudflare metadata. An upload
requires separate explicit WORK-only approval and a reviewed plan to
verify ALL active bindings, version provenance, secret inheritance,
Shopify login and native form behavior. Do not merge/release merely
because source tests are green.

## Owner-verified WORK reconciliation and private local preview (October 23, 2026)

The owner successfully reran the authenticated
`node scripts/inspect-work-contact-paired-baseline-readonly.mjs
--owner-readonly` from the isolated temporary HQ QA checkout at
source commit `315134b24079d38e6e737f4960d63b8887cdcb00`.
The inspector confirmed the same stable, currently deployed 100%-traffic
version IDs:

- HQ `44ad4a81-55ad-4f49-9965-61260cc2294d`
- gateway `9322193f-5e87-4479-88c9-39229dddb5f2`

The original HQ source candidate **still fails**
`candidate_plaintext_parity:false` due to the five named existing
merchant/catalog/conversation/quote/request-write variables.
The independently verified **in-memory** HQ reconciliation returned
`candidate_plaintext_parity_after_reconcile:true` and all five
variable **names** preserved, without exposing or assuming their
actual values. It also listed the existing four HQ secret binding
names: `JILL_HQ_MERCHANT_READ_SECRET`,
`JILL_HQ_MERCHANT_WRITE_SECRET`,
`JILL_WORK_SESSION_KEY_B64`, and `SHOPIFY_API_SECRET`.
The gateway returned `gateway_secret_name_contract_matches_active:true`
covering its three existing Shopify/Custom Order/backend URL secrets.
The public gateway still has **no private HQ D1 binding**. No
version was uploaded, traffic changed or secret value read.

New guarded source utility
`scripts/prepare-work-contact-owner-local-candidate.mjs` offers a
**separately invoked** `--owner-local-only` mode. It requires a
fresh, compiled, canary-target WORK HQ build at
`services/jill-order-desk/app-home/dist/server/wrangler.json`.
It performs only pinned deployment and version **metadata reads**
for both WORK Workers, and creates a new, local-only, gitignored,
owner-session-derived HQ candidate
`dist/server/wrangler.contact-owner-local-only.json`.
The file preserves OAuth ON, actual active boolean states of those
five original controls, WORK D1 and exact required secret **names**.
It contains **no secret values**. The file is created once with
exclusive-create and private file permissions where supported;
a repeated run refuses overwrite. It can later be compiled with a
separate Wrangler `deploy --dry-run`, which is **not** an upload.

Unit tests use mock Cloudflare metadata and deny a changed active
Worker, a new/unrecognized variable, an absent gateway secret name,
a Contact flag set to true, embedded plaintext secrets, wrong D1,
or an existing output file. CI runs these tests with no Cloudflare
credentials. **The real owner-local candidate has not yet been
generated**, and no real candidate has been staged in Cloudflare.

Release **HOLD** remains in effect. Further steps require checking
exact active Worker source provenance and authenticated Shopify
customer A/B/guest experience, and a separately approved WORK-only
inactive upload with full existing secret/binding continuity
verification. LIVE/KEEP and all customer-facing switches remain
untouched.

## Owner-completed REAL local reconciled WORK HQ build and Wrangler dry-run (2026-10-23/24)

The owner executed the guarded command from their isolated
`%TEMP%/JILL_CONTACT_D1_QA_20261023` checkout at **source commit
`7c3e95a323adfa078f343ffcd0d7c138fd494837`**. This section
**supersedes the previous "real owner-local candidate not generated"
statement**. The owner-reported terminal output confirms:

- `npm.cmd run typecheck --prefix <isolated HQ app>` — **pass**.
- `JILL_BUILD_TARGET=canary npm.cmd run build` — **pass**;
  generated `dist/server/wrangler.json`, compiled default HQ app and
  named private `JillContactPrivate` entrypoint.
- `check-work-contact-hq-bundle.mjs` — **pass**; source canary
  manifest intentionally OAuth OFF.
- `prepare-work-contact-owner-local-candidate.mjs --owner-local-only`
  — **pass** against the same pinned active 100%-traffic HQ and gateway
  versions, with `hq_existing_flags_preserved` containing all five
  existing business controls, four existing HQ secret binding NAMES,
  gateway three-secret contract matching active, and
  `artifact_written_locally:true`.
- `wrangler 4.152.0 deploy --dry-run --config
  dist/server/wrangler.contact-owner-local-only.json` — **pass**,
  explicitly reported `--dry-run: exiting now` and
  `PASS: WORK local candidate compiled. No Worker uploaded.`

The actual **owner-observed** local candidate's WORK HQ variable
values (no secret values present) were:

| Existing runtime variable | Local candidate |
| --- | --- |
| `JILL_WORK_HOST_STAGE` | `canary` |
| `JILL_WORK_OWNER_BOOTSTRAP_ENABLED` | `false` |
| `JILL_WORK_OAUTH_ENABLED` | `true` |
| `JILL_WORK_CATALOG_ENABLED` | `true` |
| `JILL_WORK_CONVERSATION_ENABLED` | `false` |
| `JILL_WORK_HQ_DETAIL_ENABLED` | `true` |
| `JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED` | `false` |
| `JILL_WORK_MERCHANT_WRITES_ENABLED` | `true` |

Cloudflare's CLI showed the correct **WORK-only D1 name**
`jill-order-desk-work`; no gateway D1 exposure. The compile
included **two server modules**, **44 client assets** and produced
only a temporary local dry-run output directory.

The candidate is a **local ignored build artifact**: do not commit
it or share its contents. This result proves local compilation,
source entrypoint presence and owner-session-derived binding parity
at inspection time. It does **NOT** prove deployed code provenance,
secret VALUE continuity on a *new* version, Shopify/customer real
auth, staff access after upload, or behavior of a newly uploaded
version. No Cloudflare version upload, traffic allocation or
activation, Shopify submission, D1 writes or paid infrastructure
were performed. WORK Contact Us remains OFF, and LIVE/KEEP remain
untouched.

**Next**: independently attest the local artifact against fresh
version-pinned Cloudflare binding metadata, record a non-sensitive
artifact fingerprint for later comparison, review a *separately
authorized* inactive WORK-only version upload protocol and require
post-upload Owner login, Customer A/B/guest and fallback QA before
any traffic promotion. HOLD remains.

## Independent review before any inactive WORK Contact upload

Added `scripts/attest-work-contact-local-artifact-readonly.mjs` as a
**second gate** after the successful real local candidate and Wrangler
`--dry-run`. It is invoked separately with `--owner-readonly`
and never performs a Cloudflare or Shopify write.

It rechecks current 100%-traffic HQ **and** gateway version/deployment
pins through read-only Wrangler metadata, runs the existing five-flag
reconciliation and exact gateway secret-name contract again, and
refuses if the saved owner-local candidate manifest differs in **any**
field from what the live pinned metadata requires. It fingerprints
the local compiled HQ Worker entrypoint and support assets, client
build assets, and reconciled manifest using SHA-256. The printed
evidence consists only of version IDs, counts and hashes — no
secret values, client information or manifest plaintext.

The independent unit tests verify that a changed HQ business toggle
or modified build file changes or fails the attestation. The fingerprint
is strictly **local build evidence**, not proof of uploaded code
identity, source attestation or secret VALUE continuity. It should be
captured as part of a future *separately approved* staging record.
The CLI requires the already generated
`dist/server/wrangler.contact-owner-local-only.json` and an intact
local canary build; it never overwrites a candidate or creates one.

An inactive Cloudflare version upload and post-upload secret/binding
verification remain **HOLD**, requiring explicit owner approval and
a rollback plan. Keep Shopify native Contact form, current HQ OAuth,
gateway backend secret and all customer flags unchanged.

## Owner-verified local artifact SHA-256 — release evidence frozen

The owner ran `attest-work-contact-local-artifact-readonly.mjs
--owner-readonly` from the isolated QA checkout after the successful
real HQ canary build. The result **passed**:
`local_manifest_matches_active_reconciled_candidate:true`,
`existing_hq_flag_count:5`, `required_hq_secret_name_count:4`,
`gateway_secret_names_match_active:true`,
`private_worker_entry_found:true`, `bundled_file_count:50`.
The report pinned the same running HQ and gateway WORK versions
`44ad4a81-55ad-4f49-9965-61260cc2294d` and
`9322193f-5e87-4479-88c9-39229dddb5f2`.

Original local build fingerprint SHA-256:
`ed1379e8723a10fe3a73cb662249c7e327b534187b25c929286ca7a3ebdd490f`

Original local manifest SHA-256:
`c0ae54ac0b29aedf12b9090b6575d04e913ce80329005333bc1439a7bed4fe07`

Both fingerprints identify **local ignored files**, not an uploaded
Cloudflare version. `published_source_provenance_verified:false`,
`uploaded_worker_secret_continuity_verified:false`, and
`release_authorized:false` are still correct. No user data, secret
values, uploads or traffic mutations were used.

Read [WORK_CONTACT_INACTIVE_UPLOAD_REVIEW_20261023.md](./WORK_CONTACT_INACTIVE_UPLOAD_REVIEW_20261023.md)
**before** considering an owner-authorized inactive WORK upload. The
review identifies a critical public-preview caveat: Cloudflare
Version URLs may be publicly reachable even with 0% normal
deployment traffic. Explicit access checks and owner approval are
mandatory; do not assume an inactive version is private.
