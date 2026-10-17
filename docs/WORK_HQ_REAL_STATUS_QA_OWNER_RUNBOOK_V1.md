# JILL HQ WORK — Owner one-shot status QA runbook (HOLD)

**Scope:** one preexisting, disposable Custom Order request on
`jill-work.myshopify.com` only; only an authenticated, authorized WORK
Shopify Owner may perform the test. This is a *runbook*, not a script.
No mutation, provisioning, Google/Shopify/Cloudflare call or deployment
is performed by adding or reading this document.

## Current evidence and limits

- Phase 34 owner Windows PASS proves the synthetic signed command and
  canonical Google QA revision increment plus independent signed
  list/detail readback using **in-memory** sheets and mock sessions.
- Phase 35 owner Windows PASS proves a fresh **read-only** active
  Cloudflare v34, fallback v33, Google QA @9/@7 pin separation,
  anonymous-denial boundary and WORK binding metadata inspection.
- Phase 36 owner Windows PASS confirms **five out of five sampled**
  anonymous v34 `/auth/login` JS/CSS browser assets match the owner's
  local build, **270,036 bytes** with a shared sample SHA-256
  `4a3859c60f77eb0ff41c0d03250d6ff3b020f1dc12be58abf81e84d531f3b49b`.
- These do NOT prove the deployed v34 Worker binary or complete
  browser assets; neither status mutation nor its My JILL
  persistence has been verified with real WORK provider data.

## Non-negotiable gate — separate explicit Owner approval

Do not click Save verified update, run an HTTP POST, use Apps Script
editor mutation functions, modify an event row or choose any QA
request until the Owner explicitly authorizes this **single real
WORK-only status mutation**. The previous local Phase 32–36 PASS
messages do not grant that authorization.

Approval must identify that the test operates only on an existing
disposable QA request created by/for JILL testing, never a real
customer request. Do not infer test ownership from a customer email,
phone number, display name, or screenshot. The request must be
verified as disposable in the WORK-only QA ledger and account.

## Preflight — read-only and no customer data in evidence

1. From the clean, synced `jill/rewards-work` checkout, rerun the
   owner-certified Phase 35 read-only preflight if metadata could
   have changed. Confirm active exact v34, intact v33 fallback,
   Google QA @9/@7 pins, Owner setup OFF, writes ON and WORK D1.
2. Sign into **Shopify WORK** with the authorized Owner account.
   The actual embedded WORK JILL HQ requests page must load
   without changing LIVE or KEEP. Do not paste Shopify cookies,
   request content, customer names, emails, tokens or keys to chat.
3. Confirm one verified disposable QA request appears with
   **Received** status, revision **1** (or record its current
   verified revision if authorized for a different baseline).
   If it is no longer Received, duplicated, not provably test-only,
   revision 100, or the source appears stale, **STOP**.
4. Use only sanitized local/private notes to record the original
   revision, status, stage, and the fact the request is disposable.
   Avoid raw payload, item details, customer PII or session data.

## One-shot controlled action (ONLY AFTER explicit approval)

1. On the already authenticated WORK JILL HQ request workspace,
   expand **Update status**. Keep the internal stage **unchanged**.
2. Select **Reviewing** from **Received**. Leave customer-visible
   note, private note and handoff reference **empty**.
   This is `kind=status`, not `kind=message`; no email should be
   queued by the Google QA command handler. A visible status change
   may still be available to the linked WORK My JILL test account.
3. Click **Save verified update** exactly **once**. Do not use
   browser automation, an arbitrary POST, replay captured requests
   or double-click.
4. Require server acknowledgement `code=saved`, the same selected
   request, `revision=before+1`, and `email_status=not_requested`.
   The UI may only show a success summary; do not fabricate
   unexposed response fields. If needed, inspect the sanitized
   browser network response on the owner's machine **without
   exporting cookies or personal data**.
5. Let the WORK JILL HQ page refresh and then reload independently.
   The canonical Owner inbox must show **Reviewing** and exactly
   the new revision, with unchanged stage. Check the same request's
   authorized WORK My JILL test timeline only if the test customer
   owns that request through the existing verified link.

## STOP and reconcile conditions

- Any 403, 409, 422, 503, unexpected redirect or wrong shop: STOP.
- Any error or `commit_unconfirmed`: **do not assume failure or
  success**. Do not create a new operation ID, click again or
  repeat a mutation. Use independent read-only canonical status
  verification; preserve idempotent operation context privately.
- If the server says `saved` but refresh remains stale, STOP.
  A 20-second per-isolate cache is possible; do not force a
  second event or claim full persistence until revision is verified.
- If exactly one new event cannot be confirmed in the canonical
  WORK QA history, report **unverified**, not success.
- Do not automatically revert Reviewing to Received; a revert
  would be another canonical mutation, requiring new approval.

## Acceptance record (sanitized; NOT yet completed)

| Gate | Required acceptance | State |
|---|---|---|
| Explicit owner approval | Single disposable WORK-only status change | HOLD |
| Real Shopify online Owner | WORK-bound verified identity and D1 authorization | HOLD |
| Before state | One disposable Received request, revision verified | HOLD |
| One-shot command | `kind=status`, Reviewing, internal stage unchanged | HOLD |
| Source acknowledgement | `saved`, revision +1, no email requested | HOLD |
| Independent readback | WORK Owner inbox and authorized QA My JILL timeline agree | HOLD |
| LIVE/KEEP/Cloudflare | No changes to traffic, R2/D1, billing, releases | REQUIRED |

**Do not mark this QA complete based on source tests, static assets,
Google deployments metadata, a browser toast, or an HTTP 200 alone.**
After a separate real QA PASS, v35 release still requires independent
authorization for inactive upload and a separate authorization for
traffic switching, plus deployed v34 provenance assessment.
