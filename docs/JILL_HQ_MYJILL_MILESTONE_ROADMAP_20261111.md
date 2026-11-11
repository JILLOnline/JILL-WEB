# JILL HQ / My JILL — Delivery Milestones and Progress Register

**Revision:** November 11, 2026. **Delivery dashboard:** [GitHub #203](https://github.com/JILLOnline/JILL-WEB/issues/203). **Master feature authority:** [#152](https://github.com/JILLOnline/JILL-WEB/issues/152). **Scope addition:** [Events and confirmed-only calendar](JILL_EVENTS_AND_CONFIRMED_CALENDAR_SCOPE_20261111.md) / [#192](https://github.com/JILLOnline/JILL-WEB/issues/192).

This register reorganizes the WHOLE agreed HQ/My JILL scope into independently testable release gates. It is a delivery index, not permission to implement all milestones simultaneously. Existing domain ownership, WORK gates, Shopify identities and release receipts take precedence. Production (LIVE/KEEP), Cloudflare uploads, financial mutations, customer messages, extension publishing, external calendar sync and paid provisioning remain prohibited without separate explicit authorization.

## 1. Our product definition

**One JILL system; separate authoritative domains; unified experience.** The Storefront collects custom-product orders and eventual Event Services inquiries. My JILL is the Shopify Customer Account customer view. JILL HQ is the authorized merchant operator view. Shopify remains source of truth for products, Customers, financial orders, taxes, checkout and fulfillment; signed Google WORK QA owns existing Custom Order intake/events; WORK D1 manages authorized merchant drafts/receipts and, only after approved design, canonical booking/resource allocation; a single Rewards wallet authority serves all channels. Every screen discovers capabilities and truth through governed, versioned contracts rather than duplicated feature logic, shadow ledgers or global hard-coded product-family special cases.

**Current Owner-accepted HQ navigation:** Home, Requests, Messages, Contact Us, Catalog, Settings (six). Protect legacy routes. Current My JILL full-page source has eight internal routes: Overview, Rewards, Coupons, Custom Orders, Messages, Celebrations, Saved and Settings. Master #164 targets a ninth Contact Requests route under its own OFF/identity gate. Do not promise a connected Contact page just because a target route is described.

**Events & Decor:** Use shared Custom Requests / Quote Studio for service-aware estimates. Confirmed event bookings alone appear as Calendar events. Request, draft, sent or even customer-approved estimate alone never produces an event row. Availability can be checked while pending, but staff/equipment/travel/resources are reserved atomically only upon Owner-authorized confirmation, after agreed terms and applicable contract/payment policy is verified. Calendar is a projection of the single booking authority; closures/time-off/equipment downtime are a distinct availability overlay.

## 2. Milestone delivery board

Each issue contains its detailed acceptance checklist, dependencies and exit gate.

| Gate | GitHub tracker | Current status | Why it matters |
| --- | --- | --- | --- |
| M0 | [#193 Source/runtime truth, visual preview & QA](https://github.com/JILLOnline/JILL-WEB/issues/193) | IN PROGRESS / evidence gaps | One clean baseline and actual visual iteration loop |
| M1 | [#194 JILL HQ premium UI and core usability](https://github.com/JILLOnline/JILL-WEB/issues/194) | PARTIAL WORK | Six clear screens, fast, accessible, useful operational UI |
| M2 | [#195 My JILL premium customer account](https://github.com/JILLOnline/JILL-WEB/issues/195) | SOURCE/HOLD | Signed customer isolation and polished responsive portal |
| M3 | [#196 Requests, Contact and two-way messaging](https://github.com/JILLOnline/JILL-WEB/issues/196) | PARTIAL/HOLD | Customer request and conversation authority, no leaks or false messages |
| M4 | [#197 Unified Quote Studio + Event Estimates](https://github.com/JILLOnline/JILL-WEB/issues/197) | SOURCE/HOLD | Durable versioned draft, precise costs, signed customer agreement |
| M5 | [#198 Shopify finance, fulfillment and Rewards](https://github.com/JILLOnline/JILL-WEB/issues/198) | HOLD | One native paid Order and correctly reconciled wallet |
| M6 | [#192 Events bookings + confirmed-only Calendar](https://github.com/JILLOnline/JILL-WEB/issues/192) | PLANNED | Avoid double-booking and keep calendar free of quotes |
| M7 | [#199 Catalog, staff, media and HQ operations](https://github.com/JILLOnline/JILL-WEB/issues/199) | PARTIAL WORK | Product data, access, costs, production workflow and governance |
| M8 | [#200 Connected WORK customer journey](https://github.com/JILLOnline/JILL-WEB/issues/200) | HOLD | One authentic request→reply→estimate→order/booking across systems |
| M9 | [#201 Storefront finishing and Events discovery](https://github.com/JILLOnline/JILL-WEB/issues/201) | FUTURE | Premium final front door after contracts/flows are stable |
| M10 | [#202 Launch, rollback and operating readiness](https://github.com/JILLOnline/JILL-WEB/issues/202) | HOLD | Safe production rollout, explicit approvals and support |

Statuses are qualitative (not percentage completion). SOURCE means code or synthetic tests exist; PARTIAL WORK means some prior Owner-authenticated WORK reading occurred; HOLD means blocked/unreleased or unproven; WORK ACCEPTED requires exact versions, signed live test environment and approved readback. Avoid assigning arbitrary deadlines before capacity/resource estimates.

## 3. Dependencies and lanes

**Lane A — HQ merchant experience:** M0 enables reliable preview, then M1 HQ UI first; M7 authorized Catalog/roles/media/ops can be specified and tested in parallel, but real writes have separate release gates. M1 must preserve the existing Requests accordion, direct Message Customer / Update Status, compact dark-plum/gold brand and working Shopify Catalog read.

**Lane B — My JILL customer experience:** M0 enables visual/fixture proof; M2 provides the signed Shopify Customer A/B/guest foundation, Rewards/Coupons as currently supported, My JILL Custom Orders and mobile Messages. Preferences/Celebrations/Saved require their own consent and storage contract rather than inert promises.

**Lane C — Connected request/financial workflow:** M3 signed intake/Contact/replies, then M4 quote Save→Reload and verified versioned customer decision, then M5 Shopify-native draft→invoice→checkout/actual payment, tracking and wallet reconciliation. Some source-only tasks may proceed in parallel, but no release assumes prerequisites have passed. New 0.1-point/$1 earn and 1 point=$1 target policy is NOT activated; protect v13 and issued coupons until distinct migration evidence is complete.

**Lane D — Events:** M4 supplies Event Service estimate/terms; M6 adds verified Booking/Calendar/resource allocation after the exact confirmation policy is approved. No quote-only calendar entries, no date-only global lock, no automatic deposit assumptions, no event booking on estimate acceptance.

**Lane E — E2E, storefront and release:** M8 signs off the real connected journey; M9 visually/behaviorally finishes jillonlinestore.com and Events discovery without disturbing the live sales path; M10 handles separately approved production cutovers and rollback. No release by implication.

## 4. Scope by customer/business surface

### HQ (six existing areas)
- Home: certified operational KPI read, source freshness, clear next action without raw customer IDs or fictitious zero counts, fast navigation.
- Requests: one accessible line per request with verified detail, kind/status/filter/search, original P1/P2 personalization, source history, direct message/status action; event-specific quote inputs without duplicate request owner.
- Messages: authorized single public thread per Custom Order (event requests only after canonical event-type contract), signed receipt, safe retry and truthfully disconnected OFF states.
- Contact Us: future durable ticket/claims/thread with independent privacy/migration/flag contract. Native Shopify contact form stays operational until verified cutover.
- Catalog: Shopify Products/Collections/Variants/Inventory/Locations, proper unknown stock text, authorized later edit/archive, honest freshness.
- Settings: staff roles/assignment/revocation, notifications consent, integrations, source health, policy/config, audit and operational reports. Review future Events Calendar navigation placement rather than overriding the six-area accepted UI.

### My JILL (existing account entrypoint)
- Signed Overview with actual recent requests/rewards/coupons/next actions and native Shopify Orders/Profile.
- Customer-only Custom Requests/Custom Orders (product + event kinds), public status, own conversation and immutable quote/decision. No unconfirmed event presented as a reservation.
- Messages and future Contact Requests under exact owning customer GID, no email-only claim.
- Rewards/Coupons use one existing v13 ledger until the separately approved flexible-earn/redemption policy passes real checkout tests.
- Celebrations/Saved/Settings require scoped, private customer storage and explicit opt-in for reminders, with edit/delete/consent. Preserve Shopify extension constraints and privacy.

### Shared Events and Commerce
- Event intake fields: individual/corporate, event type, date/local time, venue/city, guest count, chosen balloons/decor/backdrops/table styling/centerpieces/planning, colors, reference art, setup/breakdown, budget and restrictions.
- HQ private costing: materials, labor, travel/mileage, per diem, rented assets, parking, assistant crew, fees and margin. Customer public estimate: exact deliverables, inclusions/exclusions, price/tax, event details, terms, revision and expiration.
- Quote approval is distinct from Booking Confirmed. Booking requires atomic staff/equipment/venue conflict check and agreed contract/deposit/payment policy. Only confirmed Booking produces Calendar event. Completed historical bookings may remain visible; canceled booking loses active upcoming display but retains audit record.
- Shopify native draft/invoice/payment Order remains financial authority. My JILL customer sees only authorized booking details, native order and fulfillment links, not private cost or staff schedules.

## 5. UX is a first-class acceptance criterion

Do not mark a milestone ready because a TypeScript build passes. Each relevant screen needs an inspected 390px phone, 768px tablet and 1440px desktop rendering, high-contrast/readable typography, visible keyboard focus, touch targets, no clipped buttons, understandable empty/loading/error/offline states and the correct action hierarchy. Review source mocks separately from authenticated WORK; no screenshots from a 421 wrong_host response. Build an isolated synthetic preview using safe fixtures and no weakened WORK host/auth gates. Use JILL's canonical HQ visual styles and Shopify's supported Customer Account Preact components instead of CSS overrides/duplicate style systems.

The visual priority sequence is:
1. Establish a functioning local synthetic visual QA harness (M0) and record current actual deployed screens when separately accessible.
2. HQ Requests readability/accordion/quote density and Home priorities, then My JILL mobile Messages and Overview (M1/M2).
3. End-to-end customer action hierarchy, event estimate and confirmed-only Calendar designs after the verified contracts exist (M3–M6).

## 6. Tracking protocol

- Master scope issue #152 stays open and authoritative. This milestone register is an additive execution layer. Existing #163 HQ, #164 My JILL, #154 messaging, #155 commerce, #192 Events remain independent functional/acceptance owners; do not delete their historical notes.
- Every checkmark must cite exact commit/PR, tested source and installed WORK identity, relevant test output, mobile/tablet/desktop screenshot, customer/staff signed scenario, source timestamp and Owner confirmation when required. Missing evidence = OPEN/HOLD.
- Record blocked cases in the affected milestone issue with a concrete next action. Verify stale source or historical release instructions instead of re-running spent one-use release receipts.
- When sub-work passes SOURCE tests, label it SOURCE and keep the acceptance checkbox open until authenticated WORK proof passes. Status labels and rollups must not equate source green with DONE.
- No automation/worker should merge, deploy, publish, mutate D1, send a customer message or financial invoice, create a booking, alter loyalty balances, reset spent receipts, or touch LIVE/KEEP without a separate explicit authorization.

## 7. Next concrete execution cycle

**First:** Cody reviews his local HQ Catalog/Home commit against the branch and PR #191. The GitHub remote branch checked on November 11 remained at 269c38d8989d7c5277248dc06633ca1c90c221c7; any later local commit should be verified and intentionally pushed, not assumed present.

**Then:** Create an isolated safe visual harness (M0), record actual fixtures/screenshot paths and source-test logs; pick one HQ Requests visual defect with visual evidence (M1), validate it and test the responsive behavior; independently scope My JILL mobile Messages next (M2).

**Meanwhile:** scope-only issue #192 and this document capture the Events new service model, confirmed-only calendar and resource conflict protection. Do not interrupt the ongoing UX-first implementation sprint for an untested booking engine.

**Next exit review:** inspect milestone issues #193–#197 plus #192, report SOURCE vs WORK evidence for each, and approve only the next smallest testable change. Reserve all release permissions for separate approved gates.

No dates were promised or generated; milestones are evidence-based rather than calendar-time-based.
