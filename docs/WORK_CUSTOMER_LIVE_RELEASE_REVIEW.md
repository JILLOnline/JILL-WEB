# Customer-facing LIVE promotion — separate blocked release review

WORK HQ catalog/access candidate is now active with exact provider/runtime
read-back (`e866e2f2-0746-44d0-8caa-b37a1c9bcf45` 100%, existing quote 0%).
This is WORK only. Authenticated UI and full operational acceptance remain
incomplete; customer-facing LIVE promotion is still blocked and separate.


The corrected WORK gateway diagnostic now has exact-version signed Google
verification in the Owner receipt recorded in
`evidence/work-gateway-zero-byte-owner-success-2026-10-19.json`. This closes
only that diagnostic; it establishes no intake, customer conversation, quote,
checkout, migration or LIVE acceptance. All diagnostic deployment receipts
are spent.

Prepared 2026-10-19 UTC. **NOT APPROVED, NOT READY, no production commands.**
WORK acceptance is recorded in `WORK_CONNECTED_ACCEPTANCE_2026-10-19.md` and
has not passed. This package defines the concrete diff/receipts needed for a
later review; it is not permission to merge or deploy the WORK branch to LIVE.

| Release surface | Exact review still required |
| --- | --- |
| Existing Shopify app | Preserve the production app identity and installed extension UIDs. Compare the complete app version: three bundles, network capability, App Home URL, OAuth callbacks, proxy, API version and every added scope. WORK client `f8e1…` is never a production credential. |
| Customer transport/session | `shared/customer-custom-orders.mjs` and `backend/customer-account-work-session.mjs` are explicitly WORK-pinned. They cannot be promoted unchanged. Review one environment-qualified transport/session contract with separate production identity, endpoints and keys; no fallback to WORK and no cross-shop acceptance. |
| Gateway | `services/custom-order-cloudflare/{worker,handler,wrangler.toml}` plus canonical backend modules require separate production resource identities, rate budgets, source marker, runtime health/denial proof and exact rollback allocation. Never reuse the WORK worker/bindings or diagnostic deployment receipt. |
| HQ | `services/jill-order-desk/app-home/` needs distinct production host, encrypted sessions, D1 database, Owner/staff grants, secrets and flags. No production grant copied from WORK; commissioning disabled after explicit Owner binding. |
| Google request authority | Preserve existing production submissions/history and verify current source/deployment before any update. WORK sandbox property and QA sheet do not become production. New conversation/acceptance events require non-destructive compatibility and privacy review. |
| Quote/link data | Review additive schema and backups, exact published terms, canonical public event ordering, acceptance/intent recovery, one Shopify draft and order link, explicit invoice recipient and read-back. Preserve all durable operation records through rollback. |
| Rewards | Snapshot production v13 wallets, operations and actual discount objects. Approve a versioned CAS migration and issued-coupon compatibility. Require website and HQ native checkout, mixed/cheap lines, no stacking, debt/refund/expiry and timeout receipts from WORK first. |
| Media/budget | Separate production storage/privacy/retention, actual free-tier usage and Owner billing condition. WORK tests and included usage are not a zero-dollar cap or billable activation approval. |
| Communications | Reviewed production recipient/outbox/provider policy; canonical thread stays independent from email and marketing consent. No real email is sent during release rehearsal. |
| Browser and recovery | Real HQ/My JILL screenshots, responsive/keyboard/EN/ES checks, 20-run p50/p95/cold timings, source age, quota observations, staff revocation, customer isolation, guest and media expiry receipts. |

Release decision requires a named exact commit, full configuration/scope diff,
fresh production inventory, completed WORK acceptance evidence, tested backups
and rollback versions, and the Owner's separate explicit LIVE release scope.
No blanket approval from an earlier WORK deployment carries over to LIVE.
