# JILL HQ — portable Shopify-connected operations platform

**Direction accepted 2026-10-15.** JILL HQ should become the control center
for the entire business, while Shopify remains the authoritative commerce
engine for checkout, orders, payments, catalog objects, inventory and tax
calculations that Shopify already handles reliably.

## Portability: install a platform, not copy a one-off store

JILL HQ must be installable on a second authorized Shopify store without
rewriting business modules. **Changing secrets alone is not sufficient**
for a real Shopify app installation. Each installation needs OAuth grant
and Admin API scopes, consent/re-authorization, webhook subscriptions,
verified shop identity, tenant-scoped storage, domain/app-proxy settings,
store policies, media storage, migration/seed data and platform-specific
extensions. Never reuse a JILL LIVE or WORK merchant session, payment
credential or customer record in another tenant.

A future install wizard should automate the non-secret steps and report
missing prerequisites. WORK, KEEP and LIVE remain separate tenancy/stages,
never one mutable backend with an environment switch as authority.

## Canonical source ownership

- **Shopify canonical:** products, variants, collections, inventory,
  locations, fulfillment services, customer accounts, actual orders,
  financial status, Checkout, Draft Orders, taxes/discount calculations,
  shipping configurations and refund/payment records.
- **JILL HQ canonical:** design personalization, intake requests, quote
  versions and approvals, production assignments, proofs, rental
  scheduling/capacity, safety inspections/waivers, activity enrollment,
  CRM consent, follow-up automation, analytics derivations and audit events.
- **Derived indexes only:** fast inbox search, dashboards, reporting
  projections and customer-facing summaries. Every record stores verified
  tenant/shop identity, originating source ID, revision, observed_at,
  freshness limit and sync status. Never silently overwrite Shopify with
  an unsynchronized local mutation.
- **Money:** Shopify checkout captures payments; any custom cost/fee quote
  must reconcile line items, shipping and taxes. Avoid a parallel JILL
  payment processor or invented tax engine.

## Pluggable modules

1. **Commerce:** product/variant/collection editor, images/media, bulk
   imports, inventory by location, price rules, stock alerts and catalog
   discovery. HQ changes Shopify through scoped Admin GraphQL writes,
   with audit, diff, confirmation and webhook reconciliation.
2. **Custom orders:** all original request items, variants, options,
   personalization per unit, image/PDF uploads, proof history, internal
   tasks, customer messages, versioned quotes, customer approval and
   idempotent Shopify Draft Order / official invoice checkout.
3. **Customer experience:** signed Shopify My JILL account, real order
   tracking, claimable guest requests only after identity verification,
   rewards/coupons, returns and customer support. Allow customers to
   approve a quote and upload permitted revision material.
4. **Activities, rentals and events:** ball pits, bounce houses/castles,
   obstacle courses, events and workshops. Capacity/age/location rules,
   date/time reservations, travel/setup/teardown buffers, deposits via
   Shopify-supported checkout, condition and cleaning checklists,
   maintenance logs, waiver consent, incident workflows and appropriate
   insurance/legal review. Safety must be a genuine operational gate,
   not a cosmetic checkbox.
5. **Operations:** production boards, pick/pack/ship, staff roles,
   route/schedule planning, stock consumption, vendor purchase orders,
   delivery/pickup evidence and automated customer notifications.
6. **Growth:** consent-based marketing segments and campaigns,
   referrals, rewards analytics, ads attribution and customer retention.
   Never assume permission to market to a customer from a purchase alone.
7. **Finance & reporting:** sales, shipping costs, COGS, returns,
   invoices/bills, refunds, payouts, memberships and multi-location
   profitability. Shopify is the transaction ledger; accounting/taxes
   need reconciled records and an appropriate accounting/tax integration,
   not a second inconsistent merchant cash register.

## Technical rules

- One **tenant resolver** derived from verified Shopify OAuth/install
  identity, never user-supplied `shop` or Host headers.
- Exactly one canonical owner for each operation; module domain
  boundaries and contracts, not duplicated handlers or patch CSS.
- Permission matrix for owner/administrator/order-manager/production/
  viewer plus separately verified customer identity and row-level
  customer ownership.
- Queue/background jobs for webhook processing, file previews and
  indexing; interactive list navigation never blocks on a 15-second
  Google read when a verified shared index can serve it.
- Durable idempotency and audit trails for all externally visible actions.
  Shopify GraphQL rate limits and webhook retries are normal conditions.
- Central media policy, file size/type checks, scans, private buckets,
  short-lived delivery tokens and strict per-tenant ACL.
- Feature flags, per-shop settings, migrations and documented rollback.
  No LIVE auto-promotion or blanket permission grants.
- Real SLOs: warm HQ route <1s target; cold source latency measured
  by auth, D1/index, external API and SSR/hydration separately.
  Record actionable render/JS errors without customer PII or secrets.

## Sequence

**P0**: Restore usable WORK Custom Orders inbox (currently 200 in the
network but blank/long wait in Shopify Admin); validate repeated nav.
**P1**: Determine cold latency from phase timings and activate
WORK-only shared index if Google dominates; owner authenticated always.
**P2**: Exact-ID full source detail + correct original media manifest.
**P3**: Private images/PDFs, two-way proofs and revisioned quote editor.
**P4**: My JILL acceptance + approved Draft Order, Shopify official
checkout, confirmed order reconciliation.
**P5**: Catalog/variant/inventory Editor and packaged Shopify
app installation/tenant automation.
**P6**: Activity bookings, rentals, memberships, operations, safety,
growth and finance, one reviewed business module at a time.

This is a product architecture decision, not a claim that these modules
or portability are already implemented.
