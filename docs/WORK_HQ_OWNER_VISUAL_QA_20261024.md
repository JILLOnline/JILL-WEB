# JILL HQ WORK — Owner visual acceptance review
**Date:** October 24, 2026
**Basis:** Owner-supplied 11 screenshots from the activated Shopify Admin JILL HQ WORK app, corroborated against the WORK source at `jill/hq-quote-catalog-preflight-20261022`.
**Scope:** Visual observation and source inspection ONLY. This report performs no traffic change, deployment, D1 write, Shopify mutation, or customer message.
**Release status:** DEPLOYED WORK HQ 100%; PARTIALLY VISUALLY ACCEPTED; NOT full workflow acceptance; LIVE / KEEP unchanged.

## Observed deployment baseline
- HQ Worker `jill-order-desk-canary-work`, verified previously serving 100% version `d1f4e07f-8c9b-4b40-97a4-0c13d2c5149a` in deployment `5d996637-73b4-427e-92a0-a36a12581172`.
- Existing rollback target HQ version `44ad4a81-55ad-4f49-9965-61260cc2294d`.
- WORK gateway remains `9322193f-5e87-4479-88c9-39229dddb5f2`.
- Post-activation authenticated metadata review established HQ binding parity, 14 bindings, and disabled public Version URLs. Owner's screenshots show functioning embedded application routes and real WORK Shopify Catalog data.
- No evidence in screenshots of LIVE/KEEP deployment, paid provision, Contact/Quotes external sending, or backend activation.
- Source at `app/routes/app.tsx` confirms navigation Home / Requests / Messages / Contact Us / Catalog / Settings.

## Page-level visual observations

| Area | Owner-visible proof | Limitation / next gate |
| --- | --- | --- |
| Shopify Owner/Admin shell | Screens render in embedded Shopify Admin with JILL dark-purple / gold WORK navigation, protected request and catalog pages | This supports a working owner session for these reads, but is not proof of all OAuth refresh / denied-staff scenarios |
| Request detail | Verified request #6AB4D8B8 loaded; customer label `JILL WORK Rewards QA - NOT A CUSTOMER`, 1 Cake Topper Set, event Nov 3, local pickup, verified revision 1, source activity, quick actions | QA record is explicitly not a real customer; do not treat as verified live buyer. Actual Update Status and Message Customer write/readback not demonstrated |
| Request inbox | No owner screenshot of the **listing/accordion** itself | Source `app.requests.tsx` does implement whole clickable row trigger, expanded signed order details, and two direct buttons; needs actual browser/keyboard/mobile acceptance |
| Quote worksheet | Item unit price and six fee inputs visible; source review checklist present and clear `NOT SAVED - NOT SENT` | Save/Reload disabled, content explicitly lost on refresh. Do not imply persistent quote workflow, invoice/order or customer acceptance |
| Quote-to-Catalog review | Disabled `Check Shopify prices` button; status explains missing activation | Separate from working Catalog browsing: `JILL_WORK_CATALOG_ENABLED=true` does not imply quote-to-catalog flag enabled |
| Private media | Artwork panel says zero references on this QA request | Does not verify private R2 storage, review grants, attachment upload or another request's files |
| Messages | Three *verified custom order requests* visible, filter and selected-detail UI navigates | `JILL_WORK_CONVERSATION_ENABLED=false`; thread history is not connected; selected request says no history assumption. Not evidence of delivered/received messages |
| Contact Us | Contact inbox route renders truthful disconnected/not-authorized state | Native Shopify Contact Us still operates separately; no durable HQ contact ticket or My JILL contact thread verified |
| Catalog Products | First page shows 15 product records, titles, active status, USD prices, SKU, Shopify links, search UI | Browsing appears connected; not a full dataset count, CRUD, custom production capacity, or independently tested search result |
| Catalog Collections | 7 visible collection records incl. JILL, Party Favors, Piñatas, Apparel & Gifts, Kid Activities, Party Supplies, Shop the Party | Read-only; no edit in HQ |
| Catalog Inventory | 20 visible records, mostly `Inventory tracking is off. Stock is unknown` | Do not misinterpret Product view `0 total` as true zero stock for untracked custom-made goods; inconsistent terminology should be corrected |
| Catalog Locations | 2 visible active locations, My Custom Location / Shop location | Read-only; no stock transfer or shipping-rate testing |
| Settings | Owner session and permissions screen: catalog.read, locations.read, inventory.read HQ-enabled; draft.create and invoice.send HQ-disabled | Configuration describes capabilities but does not prove all write endpoints or payment behavior |

## P0 — operational risks to address before claiming HQ/My JILL unified
1. **Two-sided messaging:** complete canonical conversation read/write, ownership, exact signed customer account projection and Owner-acknowledged readback; do not promise delivery on the basis of an HQ button. The source quick action component contains a message editor, while the dedicated Messages inbox is OFF; reconcile these pathways before release.
2. **Durable quote draft Save/Reload:** current worksheet invites nonpersistent entry but explicitly warns entries are lost on refresh. Verify Owner/D1 auth, draft revision/hash and idempotent persistence, then enable only the specific WORK feature with separate approval. Do NOT enable sending, invoice, Shopify draft order, tax computation or customer quote acceptance by inference.
3. **Contact Us durable ticket:** preserve Shopify's native form until a verified signed/rate-limited WORK intake, D1 schema, HQ inbox and customer ownership policy are tested end-to-end. No autoclaim by email.
4. **Authenticated acceptance:** exercise Owner reload/logout/login and Customer A/B/guest isolation; a successful screenshot is not negative security testing.
5. **Write controls:** separately test `Update status` and `Message customer` with a safe designated QA request and exact server readback. Do not use the QA label as evidence of a real customer identity.

## P1 — interface upgrades; keep all permissions and server guards intact
1. **Requests dashboard:** retain one-row multi-column inbox with full-row accessible accordion, verified name / ID / status / stage / needed / submitted and direct `Message customer` / `Update status`; do not bring back an overloaded Quick Actions dropdown. Full detail stays accessible via `Open full request`.
2. **Request detail:** compress top summary + source activity + management into one concise header band; give Items & Personalization priority, reduce empty width, and show a compact one-line SKU/variant summary behind a disclosure. Keep raw IDs behind a technical details disclosure.
3. **Quote worksheet:** expose essential inputs, fees and total first; put 11-item readiness gate, P1/P2 review and private-media technical audit into collapsed `Advanced verification`. The checks themselves must remain enforceable. Label unsaved estimates clearly; do not make a disabled Save look functional.
4. **Messages:** render clear empty/unconnected state with no implied unread counts. Once signed message read is released, two-pane inbox/selected conversation plus simple reply composer.
5. **Contact Us:** present `Not connected` as a connection status, not as an empty inbox suggesting customer tickets don't exist.
6. **Catalog:** keep Shopify authoritative; harmonize stock wording. Untracked inventory should consistently be `Not tracked / quantity unknown`, not `0 total` unless the context explicitly describes Shopify's numeric field. Allow search and product review without implying HQ CRUD.
7. **Typography/layout:** screenshots show quite small text and spacious/stacked tall panels. Improve desktop readability (approximately 14–16px body), spacing, contrast, responsive tables and keyboard interaction; preserve JILL dark-purple/gold/nav design.
8. **Timestamps:** Owner sees `UTC` in activity; offer localized event time with explicit time zone while retaining raw UTC in accessible technical details.
9. **QA sample data:** visually distinguish `NOT A CUSTOMER` test requests to avoid treating them as production customer orders.

## P2 — later, separately governed integrations
- Owner-authorized Shopify Catalog product/variant CRUD, inventory/location controls and media.
- Quote revision-bound customer accept/decline → native Shopify calculation → explicit authorized draft order/invoice/order → order fulfillment/tracking.
- My JILL read-only and write authorizations that use exact Shopify Customer GIDs; no guest claim by email.
- Rewards, rentals and membership expansion after the core commerce lifecycle is accepted.

## Shortest verification sequence next
1. Owner screenshots/test the **Requests inbox listing** with one row expanded and the two direct action buttons. Do not send messages to real customers.
2. Verify a single safe QA status change with server readback if owner explicitly chooses to exercise writes.
3. Resolve messaging and quote Save/Reload before promising a working HQ workflow; keep Contact Us and commerce features OFF until their respective E2E tests pass.
4. Source-only incremental changes on feature branches, CI, followed by distinct WORK-only owner-approved release, rollback pin, and browser acceptance. No unapproved paid services, LIVE or KEEP changes.

**Conclusion:** WORK HQ's shell, custom-order read, and Shopify Catalog read are visually functioning. Owner visual acceptance is PARTIAL. One-click customer messaging, unified Contact Us, durable quote drafts, checkout/order and My JILL cross-surface workflows are NOT certified by these screenshots.
