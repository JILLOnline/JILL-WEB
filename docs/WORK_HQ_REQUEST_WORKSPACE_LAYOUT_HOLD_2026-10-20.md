# HQ WORK full request layout review — source-only HOLD

Status: **Changes committed to jill/rewards-work source only. NO POWERSELL PULL REQUESTED; NO WORK/LIVE DEPLOYMENT.** The user is batching visual feedback before a new, fresh, one-use WORK-only release. Do not reuse any historical Order details, Inbox Polish, or Quick Pill release/restore scripts or their spent receipts.

## Annotated screenshot decisions

1. **Order details on the request detail workspace is NOT a dropdown.** The compact inbox still has its own Order details disclosure, but in the full workspace Customer & event / Special instructions remain visible in a permanent panel.
2. **Items & personalization IS a dropdown.** Closed by default, native HTML `details` / `summary`. Its verified items, opaque product references, variation allocation and P1/P2 personalization remain available when expanded. The summary exposes verified revision.
3. **Estimate / Quote worksheet IS a dropdown.** Closed by default. Its summary retains `NOT SAVED · NOT SENT` or `RESTORED DRAFT · NOT SENT`; the price inputs, item/fee calculations, Save Draft/Reload actions, authentication and server capability switch are unchanged. Native `details` preserves mounted inputs during collapsing; no unmount/reinitialization or automatic save action.
4. Remove the **blue-boxed redundant descriptions**: activity history disclaimer, request submitted/quote note, empty-conversation informational filler, worksheet intro and worksheet footer. The verification-error status, yellow quote restrictions, unsaved-edit warning when saving is disabled, and permanent `not sent` state remain, avoiding any false promise that drafts are customer-approved or payments were created.
5. Shared accordion styling remains scoped to WORK full request view; 44px min hit targets, focus-visible and reduced-motion CSS, accessible native keyboard operation. No new requests to Cloudflare Workers, D1, Google Apps Script, Shopify Admin, customer account APIs or R2.

## Reviewed boundary

`scripts/work-hq-workspace-layout-draft.mjs` pins 13 reviewed files: prior polished Quick Actions' 11-file presentation overlay, plus `WorkQuoteWorksheet.tsx` and `WorkRequestConversation.tsx`. Only these full-request UI components and CSS changed since the prior visual package; backend source is held at frozen `DENSITY_RUNTIME_BASE` for future isolated packaging.

Offline checks:
- `npm.cmd run work:hq:workspace-layout:check`
- `npm.cmd run test:work-hq-workspace-layout-draft`
- `npm.cmd run test:work-hq-request-detail`
- `npm.cmd run test:work-hq-detail-view`
- `npm.cmd run test:work-hq-quote-worksheet`
- `npm.cmd run test:work-hq-quote-ui-wiring`

All older one-time release receipts and profiles remain historical, NOT re-keyed to this draft. Source-only compilation and regression checks do not constitute live visual acceptance.

## HOLD until next user-reviewed changes

Wait for user's additional edits. Then collect a new read-only WORK runtime inventory and precise source annotation for the actual active version. Build and certify a *new* one-time guarded WORK-only release including this change and the polished Quick Actions pill; compare immutable provider bindings, exact traffic allocation, the held 0% quote canary, pre-release health and all spent receipt namespaces. STOP on any uncertain state. Keep LIVE isolated and Cloudflare usage within existing free-tier limits. No paid service authorization.
