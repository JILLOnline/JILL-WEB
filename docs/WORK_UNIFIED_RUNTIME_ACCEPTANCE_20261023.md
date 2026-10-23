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
