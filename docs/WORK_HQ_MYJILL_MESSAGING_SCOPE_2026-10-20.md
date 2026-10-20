# JILL WORK HQ ↔ My JILL — one canonical two-sided inbox

**Scope approved 2026-10-20:** Messaging is a first-class stream in the HQ / My JILL / Shopify master workflow, alongside request management, quotes, approval, invoices and Shopify order tracking. This is a **WORK SOURCE-ONLY** implementation stage. No Cloudflare Worker upload, new Shopify app extension release, migration, Google Apps Script deployment, flag change, secret change, paid service or LIVE change is approved by this commit.

## Product contract (HQ and My JILL)

- **One conversation per immutable Custom Order submission ID**, not per email, phone, or duplicate Shopify chat record.
- **JILL HQ:** New `/app/messages` under existing embedded WORK HQ. List the Owner-authorized canonical nine-field requests, sorted by *request activity* (do not call it last-message order). Selecting a request explicitly reads the existing `/app/requests/thread` endpoint with its independent Owner/WORK D1 access check, Google-signed thread read and `JILL_WORK_CONVERSATION_ENABLED` gate. Customer-visible merchant/customer events are shown; internal notes are not. Reply uses the existing verified `WorkRequestQuickActions` message command, with the same operation ID and source revision/acknowledgment semantics, not a new writer.
- **My JILL:** New `messages` tab in the **existing** `jill-account-dashboard` extension and an Overview shortcut. The screen uses `loadWorkCustomerCustomOrders`, which verifies Shopify's customer-session JWT at the existing WORK endpoint and retrieves **only that owner GID's** canonical public Custom Orders (maximum 20). No request-list-by-email endpoint, direct Shopify Admin API, or caller supplied customer identifier. Selecting a verified request shows the same public thread and reuses `RequestConversation` for original operation-ID/receipt recovery and bilingual messaging.
- **Shared projection:** `shared/custom-order-message-inbox.mjs` reads only the already verified public timeline v2 (merchant messages/customer replies). Legacy status-only v1 remains visible with honest "not available" messaging, never a fabricated empty conversation.
- **Unread/read/delivery:** No badge, count, push notification, delivered email promise, or assumed last-read until a separately reviewed Owner/customer read cursor and real provider delivery receipts exist. Summary counts request threads, not unread messages. No persistent browser storage of private messages. No background automatic polling or new billing usage.
- **Scope expansion for the Quote → Invoice workflow:** Quote-ready/quote-sent/accepted/expired messages will eventually use the SAME canonical request thread and customer ownership, with explicit unique event types and state machine—not unstructured text mistaken for a legally accepted quote. Actual quote acceptance still requires exact terms/revision and its own signed transactional event.

## What is done vs. what is held

**Source work present now:** two inbox screens; the same canonical thread summary; responsive HQ messages UI with a request-ID/status filter and explicit authenticated thread refresh; rejection of misattributed message authors; existing customer reply composer; navigation on both sides; privacy/identity/legacy tests; no new backends, flags, accounts, or commerce actions. The current reviewed, **unreleased** 32-file source edition is guarded by `work:hq:messaging:check`; historical compact-row release files and spent receipts are unchanged.

**Not enabled or proven in running Shopify:** The existing WORK conversation feature flag remains OFF in the current ordinary HQ runtime; Google WORK signed response path and customer reply gate require separate reviewed activation. The new extension UI is not deployed to Shopify. Visual/functional tests need authenticated HQ Owner and Customer A/B accounts; message lost-ack/retry/duplicate tests must pass for both.

**Deferred to subsequent milestones:** durable read-cursor/unread indicators, attachments/private R2 previews, notifications/email provider delivery reconciliation, pagination beyond existing caps, outbound templates, message escalation/assignment/team roles, canonical quote approval notification and real invoice receipts. Do not add another message database just to enable the inbox.

## Next operational gates

1. Finish GitHub CI, including WORK Admin React Router typecheck/build, the existing My JILL one-extension architecture and the real local canonical Google conversation test. Hold if any failures.
2. Before a WORK runtime release, freeze the *new* reviewed HQ UI files into a new isolated WORK release profile and get fresh read-only Cloudflare allocation/version/binding/0% quote canary inventory. Old Archive/Search/compact-row receipts are spent. Never use the old one-shot scripts or change customer-facing LIVE.
3. Before Shopify customer-account app release, verify the new My JILL tab in the existing extension, preserve the exact extension UIDs and consent/security, and use a separate explicitly approved WORK app release; no new customer account extension target.
4. Activate the WORK conversation integration only after the existing Google gateway, owner, account A/B, and receipt-recovery proof; stop on unverified origin, owner, or Google state.
5. Only after WORK authenticated visual QA and fail-closed tests, consider a separately approved LIVE promotion.

**Operating target:** HQ messages inbox ↔ My JILL customer messages ↔ canonical custom-order timeline ↔ quote/approval/invoice event links ↔ Shopify order source. No separate chat silo.

## Additional WORK quote handoff progress (still NOT an invoice)

`work-quote-personalization-map.mjs` now supports exactly reversible, bounded **item-wide** custom attributes (`id`, `label`, typed `value`) serialized under `JILL:v1:` and passed through Shopify's existing single `JILL personalization` custom attribute. Original character spelling, language, booleans, arrays and source order are retained; unknown fields, oversized content, duplicate IDs and control characters cause fail-closed outcomes. `work-quote-commerce-handoff.mjs` refuses to produce a calculation intent for P1/P2 per-unit groups, reference attachments, request-wide instructions, additional fees, manual tax and discounts. Native Shopify totals, delivery address, merchant approval, customer acceptance, invoice and order creation are still separate unapproved actions. The quote adapter is **not connected to an HTTP route**.
