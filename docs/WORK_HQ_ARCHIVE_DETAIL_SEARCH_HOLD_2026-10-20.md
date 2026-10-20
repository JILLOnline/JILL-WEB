# JILL HQ WORK — non-destructive request Archive + detailed search

**Status: SOURCE-ONLY REVIEW. Not deployed. Do not re-use prior visual-only releases or receipts.** Production LIVE, customer intake, Google QA, Shopify store theme, payments and quote/invoice state are unchanged. The currently known signed Google WORK list is bounded to **50 request metadata rows**; this release does not claim unbounded historical coverage.

## UX and behavior

The WORK Custom Orders page gains **Active**, **Archive** and **All requests** tabs with counts. Cancelled/completed rows from the signed canonical 9-field list automatically appear under Archive, not Active. **Removed** is a separate archive category, not a new customer status. It represents a recoverable Owner-driven *soft remove* without deleting the original request, changing its customer-visible status, or touching associated Shopify orders. Active, Archive and All are local views over the same signed list; no source rows are cloned or deleted.

Status badges, request name colors, card actions and the existing full-row details/scroll behavior are unchanged. An authenticated Owner D1 overlay can later place other requests in the archive and restore them; the corresponding UI action is invisible until source capability is explicitly enabled, and unknown write receipts must not be blindly retried.

The Search requests bar keeps immediate request ID/status/date/fulfillment matching. **Search details** (Enter or button) explicitly invokes the Owner-only WORK search route. It can find signed original detail fields including customer name, contact, event date/address, item titles, options, variants, per-unit personalization and request attributes. The server returns **only verified matching request IDs**, no customer PII or search text. Results are read-only, no search index or browser storage, with a **six-request page maximum**, **two simultaneous signed Google details maximum**, and manual **Search next 6 requests** continuation. Stale metadata/revision or a detail outage is an error, never a false negative; the user must restart after canonical data changes. Search covers the currently returned <=50 rows, not all historical requests beyond that contract. Conversation/email text, deleted Google source rows and payment/invoice history are NOT yet searchable.

## Authorization / security

Search route: `/app/requests/search` POST, strict Origin/form, no query string, Shopify online authentication and WORK D1 requests.read Owner authorization, then canonical signed Google list and immutable exact-ID detail reader. It is independently gated by WORK canary and the existing `JILL_WORK_HQ_DETAIL_ENABLED` and merchant-read secret. No invocation on each keystroke.

Archive route: `/app/requests/archive` GET / POST, Shopify online Owner authorization with read/write actions respectively. D1 operations require the **absent-by-default** `JILL_WORK_HQ_ARCHIVE_ENABLED=true` flag. Soft removal and restoration are operation-id audited with the verified canonical submission ID/revision. Archive rows contain request IDs, revision, audit IDs and staff/time stamps only — no names, email, raw payloads, addresses, references, images or customer tokens. No DELETE/UPDATE is issued to original intake, Shopify orders or the Google source.

Schema is stored **outside active migrations** under `services/jill-order-desk/archive-proposals/0010_work_request_soft_archive.sql`. Do not apply it remotely, edit Worker release manifests or enable flags until Owner explicitly approves the schema, exact WORK D1 target, quotas and a separate fail-closed release/read-back test. Existing free-tier limits remain mandatory.

## Source controls and next steps

The source edition is frozen in `scripts/work-hq-archive-search-package.mjs` (21 files including the previous 13 reviewed UI files, new server routes/modules and the inert schema proposal). It is *not* a visual-only overlay and cannot use the historical one-use `workspace-layout:release-once`, `quick-pill:release-once` or other spent scripts.

OFFLINE commands after clean PC sync:
- `npm.cmd run work:hq:archive-search:check`
- `npm.cmd run test:work-hq-archive-search`
- `npm.cmd run test:work-hq-inbox-ui`
- `npm.cmd --prefix services/jill-order-desk/app-home run typecheck`
- `npm.cmd --prefix services/jill-order-desk/app-home run build`

Once CI and authenticated tests pass, prepare a separate **WORK-only backend-capable** guarded release with the actual current deployment/source annotation, exact bindings and 0% quote canary preserved. Do not deploy using the old 13-file presentation builder, as it would omit both new server endpoints. Separately approve D1 migration and the soft-remove activation. Confirm completed/cancelled archival, exact search matches and pagination, permission denials, no PII in logs, and no real customer messages/orders changed. If a historical request is missing from the 50-row canonical list, STOP rather than assuming Archive retained it — source pagination/retention is a separate prerequisite for long-term history.
