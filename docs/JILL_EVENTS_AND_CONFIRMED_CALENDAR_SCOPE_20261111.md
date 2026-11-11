# JILL Events & Decor + Confirmed-Only Calendar — Additive Product Scope

**Decision:** November 11, 2026. **Status:** SCOPE / HOLD, not implemented or authenticated WORK-certified. **Primary tracker:** [JILL Master Feature Register #152](https://github.com/JILLOnline/JILL-WEB/issues/152). **Implementation/acceptance track:** [Events #192](https://github.com/JILLOnline/JILL-WEB/issues/192). Dependent tracks: [HQ #163](https://github.com/JILLOnline/JILL-WEB/issues/163), [My JILL #164](https://github.com/JILLOnline/JILL-WEB/issues/164), [messages #154](https://github.com/JILLOnline/JILL-WEB/issues/154), [quote-to-commerce #155](https://github.com/JILLOnline/JILL-WEB/issues/155).

This is the canonical scope addendum for the NEW Events & Decor business line. It does not supersede existing domain authority, WORK/LIVE/KEEP release restrictions, codebase design system, or previously accepted UI. It does not justify new infrastructure or provider writes. Existing Custom Orders, My JILL, Rewards and Shopify store behavior remain intact. In conflict, the master feature register and latest authenticated Owner evidence take precedence over historical release notes.

## 1. Product vision and rollout order

JILL is a cohesive, self-describing platform with one source of truth for each business fact, not multiple unrelated apps or copies of the same data. HQ manages authorized merchant operations; My JILL shows a signed-in customer's permitted view; Shopify storefront collects product purchases and later event inquiries; Shopify retains native customer and commerce authority.

Service market: **Jacksonville and Ocala, Florida**, initially local individuals, families, companies, organizations and event hosts. Supported prospective offerings include event design/planning, balloon installations, arches/garlands, backdrops/backboards, table styling, centerpieces, matching custom piñatas and party favors, installation and breakdown. Service availability depends on approved capacity, equipment and location; a service listed in a form is not a booking promise.

Order of work:
1. Continue current HQ/My JILL core feature validation and UI/UX polish. Do not block visual progress for a new event engine.
2. Specify canonical request/estimate/event booking contract, terminology and visual information architecture. SOURCE scope only.
3. Add event inquiry, costed proposal and customer review behind WORK-only feature gates, reusing common request/customer/quote operations.
4. Activate the confirmed-only calendar only after atomic booking/resource conflict tests, authenticated WORK browser acceptance and separate Owner-approved release.
5. Finish major Events & Decor storefront presentation after HQ/My JILL workflows and complete journey are certified; retain the current storefront meanwhile.

No full-blown physical machine-production scheduler, playground/membership/check-in domain or generalized rental marketplace is in scope. Physical equipment used for an event may require allocation counts; that is an event scheduling resource, not a speculative inventory system.

## 2. Naming and information architecture

- **Customer call to action:** Request a Quote / Get an Event Estimate.
- **Lifecycle object:** Custom Request, with a versioned request kind (custom product or event service). Mixed-product/service requests only after their explicit item contract is approved.
- **Merchant work artifact:** Estimate / Quote; an internal draft is not a published customer commitment.
- **Booked service artifact:** Event Booking, separate from customer inquiry and Shopify paid Order truth.
- **HQ scope:** retain the six observed visible areas (Home, Requests, Messages, Contact Us, Catalog, Settings) while source/visual acceptance continues. A future Events/Calendar area or a Requests sub-view is an Owner-reviewed UI decision; do not immediately rename existing routes or remove accepted tabs.
- **My JILL scope:** Custom Requests can display both product requests and event proposals, plus signed customer-only confirmed event information; preserve existing route identities/Shopify extension UIDs. Do not silently enable Contact Requests or add speculative booked states.
- **Storefront later:** a premium Events & Decor discovery/portfolio/service landing and request entry; no duplicate event quote calculator in the storefront.

Proposed tab labels and navigation are not yet Owner-approved. No blind mass rename from Custom Orders to Custom Quote or Estimate: historic orders and current URLs must remain usable.

## 3. Domain authority and self-recognition

| Fact / responsibility | Canonical authority / consumer rule |
| --- | --- |
| Shopify customer login, orders, product variants, discounts, invoices, tax, payment, fulfillment | Shopify. No shadow local payment state or client-side authority. |
| Existing deployed custom-product intake, immutable submitted details and existing public event history | Existing signed Google WORK QA Custom Order authority, unchanged until an independently reviewed migration. |
| New event-service intake | New verified event kind/adapter and durable ID; source and owner must be chosen against existing contracts before implementation. Do not assume a new typed date or email proves ownership. |
| Merchant-owned draft quotes and operation receipts | Existing authorized WORK D1 quote/reconciliation pattern, extended through an approved versioned contract rather than a parallel quote engine. |
| Customer-visible published proposal and agreement | Immutable revision/terms digest with verified customer identity and canonical signed approval; customer acceptance does not mean booked or paid. |
| Confirmed booking, reserved event resources, availability constraints and calendar projection | Single JILL booking authority (candidate WORK D1 transactional schema, subject to provider/scale review). Calendar itself never owns separate editable booking facts. |
| Reward points and coupons | Existing single Rewards ledger; event eligibility/discounts require policy+Shopify confirmation. No duplicate event-wallet logic. |
| Shared capability introspection | Reuse/extend existing domain contract architecture and canonical feature gates; each surface reads an authorized, versioned capability/status projection. Unknown/unavailable never means enabled or zero. |

The system should recognize which request kinds are supported, which customer fields and service item templates are valid, which stages and actions are enabled for which principal, what data is authoritative, and what is currently unavailable. This must not produce a second global master database; it means one well-governed contract per domain, explicit links, and normalized projections.

All integrations carry the verified shop, signed customer or staff principal, stable canonical IDs, revision, source timestamps, operation IDs, idempotency receipts and fail-closed errors. No customer identity based solely on submitted name, email, phone or guest-typed order number.

## 4. Event inquiry contract

Customer submits an event request, not a booking. Initial fields:

| Group | Proposed fields |
| --- | --- |
| Customer and organization | Personal/company request kind, authorized name/contact, organization name where supplied, verified Shopify account binding or guest-safe route |
| Event basics | Occasion/type, requested date, local start/end time, venue name/address, city, indoor/outdoor, estimated guests |
| Services | Event planning, balloons, backdrops, table styling, centerpieces, party favor/personalized-product extras, installation and teardown |
| Design | Theme, colors, inspiration references, customer notes, quoted deliverables |
| Venue logistics | Access/load-in, setup start, teardown end, parking/stairs, venue restrictions, weather contingency |
| Budget and policies | Customer budget range, minimum-service/distance eligibility when approved, privacy/attachment consent, explicit deposit/contract policies if later adopted |

Field sets must be versioned, validated, and extensible without writing separate form/validation engines for each event category. Event time/date may be requested even when fully booked; form submission is not an availability guarantee. For venues in Jacksonville/Ocala, interpret and display local time using America/New_York; retain full IANA zone if elsewhere.

Private customer references/media use the established access grants, per-customer ACL, size/type quotas, retention/deletion and explicit R2 budget gates; never public links by default. Corporate contacts do not gain implicit authority over unrelated customers or staff information.

## 5. One Quote Studio with service-aware estimates

Existing product quote and Shopify bridge remain intact. Extend the quote **data model, not the quote system**, to support:
- exact products/variant GIDs and quantity/personalization where applicable;
- service deliverable and per-line hours/units;
- materials and fabrication;
- design/planning/administrative time;
- crew labor (prep, transportation, install, event attendance if selected, teardown);
- mileage and travel time based on actual route inputs, not invented travel metrics;
- equipment/backdrop/stand/rental allocation and wear/replacement allowance;
- helpers/subcontractors, parking, permits if applicable, per diem, transport;
- contingency, discounts, tax treatment, customer deposits/final-payment policy, verified margin.

Internal costs, target margin and profitability are HQ-private; customer estimate lists agreed deliverables, unit/service pricing, inclusions/exclusions, tax, delivery/setup, payment terms, event date/time/place, proposal expiration and revision. No hard-coded pricing or guessed tax/rates. Native Shopify quote/draft calculation must be checked for the supported service workflow; unsupported capabilities HOLD, not silently estimated as authoritative.

Stage transitions should distinguish:
Inquiry → Estimate Draft → Estimate Sent → Customer Accepts/Requests Changes/Declines → Merchant Payment/Contract Verification → Booking Confirmed → Event Execution → Completed.

Customer acceptance alone NEVER inserts the calendar event. A submitted inquiry, published estimate, tentative discussion or pending Shopify draft/invoice also NEVER inserts an event.

## 6. Calendar source and exact confirmation rule

### Non-negotiable rule

**Only confirmed event bookings appear as Events in JILL HQ Calendar.** Quotes, inquiries, accepted-but-unconfirmed proposals and tentative holds are not calendar events. Avoid creating a quote-count calendar or duplicating bookings in a second calendar table.

A valid confirmed event requires one merchant-authorized, auditable transition after all applicable conditions have been verified:
1. Exact event scope, address, date/time/time zone, staff/equipment needs, setup and teardown agreed; customer-approved proposal revision still current.
2. Required agreement/contract/deposit or payment condition under JILL's *approved* policy is satisfied by an authoritative readback. We are NOT deciding here that all events require a deposit, a specific deposit percentage or full payment.
3. Availability and resource conflicts rechecked transactionally at confirmation time.
4. One immutable stable booking ID, linked to source request ID/quote revision and applicable verified Shopify financial/order references, is committed with resource allocations and audit record.

If any condition is unknown, inconsistent, stale, out-of-budget or conflicts with another confirmed booking, **do not confirm and do not put an event on the calendar**. Show an actionable exception requiring Owner review. Payment is never presumed from quote acceptance, sent invoice or a local flag.

### Calendar behavior
- Month / week / day views of ONLY confirmed or legitimately completed historical bookings, with confirmed event title, date/time, location and role-appropriate summary. No estimates or inquiry pins.
- Calendar entry is a read projection from the canonical Booking record; not a second editable event database. Direct edits use the authorized booking reschedule/cancel commands.
- One booking → one event identity even across refresh, retry, tabs or reschedule. Customer-visible date remains accurate after signed readback.
- Cancellation removes the booking from the **active upcoming** schedule; keep historical records/audit. Completion retains historical confirmed date.
- Staff time off, business closure, equipment downtime and venue/resource availability may display as a separate visually distinguishable *Availability* overlay or control. They are not event booking entries.
- The calendar cannot auto-import customer inquiries from Google Calendar or another external provider; later sync is optional and separately approved. JILL's booking authority remains canonical.

### Availability before confirmation

Incoming inquiries can request dates and read an availability preview, but they reserve NOTHING on the events calendar. Confirmation must atomically enforce interval overlap rules for:
- assigned crew/assistants and verified availability;
- equipment/backdrop/stand quantities needed;
- venue or space restrictions when JILL controls that resource;
- setup, breakdown, travel, pickup/delivery and sufficient buffer between commitments;
- time zone and daylight-saving changes, including midnight/multi-day events.

Multiple bookings on the same date are allowed if the separately required capacity is genuinely available; a date-alone lock would lose legitimate business. Double-click, concurrent staff approvals, stale quote, two browsers, retried command or ambiguous backend response must not create two bookings or oversubscribe a resource.

Do NOT introduce speculative quote holds or date reservations that block availability. If a later service/payment design needs a short-lived non-calendar transaction lease, specify it as a separate approved protection; never display it as a confirmed event. If a customer payment is verified but the requested booking cannot be confirmed, create an authorized exception for reconciliation instead of inventing a confirmation.

Use interval conflict math in UTC with venue-local IANA zone retained and shown to humans. Internal allocation is source-backed and permission-scoped.

## 7. Screen scope and visual design

### HQ
- Requests: kind filters Custom Product / Event Service, honest statuses and verified customer/source; same accessible row/accordion and direct action controls; no fake booked icon.
- Existing Quote Studio: service-aware line item sections, private costing, revision/terms, current source and customer decision. Preserve quote Save→Leave→Reload, idempotency and authorization gates.
- Events/Calendar workspace (approved placement TBD): polished confirmed-only calendar, week/day operational timeline, location/details, assigned crew and equipment controls, warnings and authorized reschedule/cancel. Show closures/availability separately; mobile schedule remains readable and keyboard accessible.
- Overview: separate accurate confirmed events upcoming KPI and inquiry/estimate work queue, never mix or invent counts. Unknown source = unknown, not zero.
- Owners and authorized staff see only permitted records; no accidental release of private customer contact, media or internal margin data.

### My JILL
- Signed owner can review event request, public proposal and quote decisions under the existing Account Hub.
- Only after confirmed Booking: customer sees confirmed date/time/address, approved scope and any linked Shopify order/payment/tracking when verified. Unconfirmed event dates are explicitly requested/proposed, not reserved.
- A/B/guest account-switch isolation, expired/forged token denial; no other customer's event, staff shifts, vendor rates or internal notes.
- Preserve Preact/Shopify account component constraints, current Rewards/Coupons art and native Orders/Profile.

### Storefront (finishing phase later)
- Premium Events & Decor landing, services/gallery, local coverage and quote request path, responsive typography, clear availability/booking disclaimers, customer account link.
- Existing product catalog, personalization, native checkout, native Contact Us fallback, collection/nav and customer rewards remain working while the other systems mature.
- The storefront consumes the same approved feature descriptors/intake/quote/identity contracts; never runs a duplicate customer ledger, estimator or booking reservation engine.

## 8. Policies intentionally undecided

The following are **decisions to capture before implementing the real confirmation gate**, not blanks to fill with guesses:
- minimum lead time, service radius/surcharges, travel/per diem rates and minimum event price;
- whether deposit or full payment and signed service agreement are required; timing of final balance;
- cancellation/rescheduling policy, weather policies and damage/security deposits;
- when a booked event occupies crew resources (install-only or attendance throughout);
- allocation rules for JILL-owned equipment vs third-party rentals;
- corporate invoicing, staffing permissions and liability/insurance terms.

No automatic promotion from estimate acceptance to booked until approved rules are explicit.

## 9. Testing, milestones and finish criteria

| Gate | Scope | Completion evidence |
| --- | --- | --- |
| E0 Contract | Canonical request kind, service capabilities, booking owner, lifecycle and retention; no UI/release | Versioned source contract and cross-domain review; regression coverage for existing Custom Orders |
| E1 Estimate SOURCE | Event intake and service-aware Quote Studio under OFF gates, no customer exposure | Validation, revision, idempotency, costing and private/public projection tests |
| E2 Calendar SOURCE | Booking write model, conflict check and confirmed-only read projection | Race/overlap/DST/reschedule/cancel/zero-unconfirmed tests with synthetic fixtures |
| E3 Visual | HQ operational calendar and event estimate screens; My JILL customer status and service entry mocks | Actual 390/768/1440 screenshots, focus, screen reader/touch, empty/error/blocked/confirmed states |
| E4 Signed WORK | Authorized merchant and Customer A/B/guest, real readback, one confirmed booking → one calendar entry | Provider version/source receipts, Shopify financial proof where required, source-age/rollback, no foreign-account data |
| E5 Storefront | Event discovery/request contract, unified style and route links after foundational workflows are stable | Responsive storefront integration tests, customer journey, distinct release authorization |

Non-negotiable negative tests:
- 0 calendar events for inquiry/draft/sent/customer-approved-only/pending confirmation;
- 1 stable entry for one confirmed booking, including after retries/timeouts and date changes;
- no double booking of staff/equipment/time when capacity insufficient;
- ability to book separate adequately resourced events on same day;
- accurate venue local time and DST across multi-day windows;
- canceled not in active future calendar, auditable old booking;
- one signed customer's data not visible in another's account or via typed ID;
- no fabricated zero, payment, contact notification, inventory availability, or ETA;
- no LIVE/KEEP, app publishing, paid provider, secret or irreversible data change without explicit Owner approval.

**No implementation or deployment is authorized by this document.** Continue the already-running visual/UX-first HQ/My JILL sprint and protected PR #191. This new plan should be implemented through small reviewed source branches once the existing build, source tests and actual WORK identity/feature gates permit it.
