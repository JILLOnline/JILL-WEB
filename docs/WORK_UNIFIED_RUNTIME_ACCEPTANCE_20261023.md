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
