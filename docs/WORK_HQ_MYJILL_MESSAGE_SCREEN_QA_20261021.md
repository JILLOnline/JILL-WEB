# JILL WORK Messaging — Owner / Customer Screen Correlation & Release Gates

Owner-provided screenshots from Oct 21, 2026, in HQ WORK and signed-in My JILL. No customer identity or full real request identifier is preserved in this repo.

## Confirmed observations
- HQ Messages shows three verified Owner-visible Custom Order records, while conversation history is disconnected.
- My JILL Custom Orders displays two requests associated with the authenticated customer account.
- One request appears on both screens with matching short ID and the public In review status. My JILL shows item details, event date, pickup method and status history.
- Different counts are expected: merchant-wide HQ can see more requests than a single Shopify customer. Do not infer cross-account ownership via typed emails.
- Customer's status-only tracking history and the disabled reply composer do not prove timeline-v2 conversation readiness.
- These screenshots do NOT prove two-way messages, a deployed customer Messages tab, Customer A/B denial, an invoice, or saved quote.

## Separate release gates
1. UI labels: disconnected Owner entries are verified requests, not verified conversation threads.
2. Local canonical regression: node scripts/test-work-conversation.mjs must execute in preview CI. It simulates signed Google WORK source merchant/customer event readback, owner A/B, hidden private notes, lost ACK and duplicate operation receipts, and independently disabled flags.
3. Local tests do NOT prove current Google Apps Script endpoint/flags or customer-account app release. Confirm runtime versions, secret presence only, grants, and identity with read-only provider checks.
4. Customer A/B/guest and legacy-v1-versus-v2 behaviors must be accepted in WORK before enabling a conversation flag.
5. Separately approved, disposable WORK request: Owner message with stable op ID, My JILL readback, customer reply, HQ readback; revalidate private notes, ownership, stale revisions and duplicate receipt.
6. Separate one-use reversible activation only after these gates; no replay of spent five-tab/connected-content receipts, no LIVE/KEEP, no new paid service.

This plan authorizes no Google/Shopify/Cloudflare writes, no messaging flag, and no commerce actions.
