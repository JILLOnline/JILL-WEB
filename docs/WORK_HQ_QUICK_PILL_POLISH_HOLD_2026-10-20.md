# JILL HQ WORK — Quick Actions pill refinement (SOURCE-ONLY HOLD)

**Status: code committed to WORK branch, no local PowerShell pull requested, no Cloudflare upload/deployment authorized.** Bundle this with the next user-approved visual changes before creating a NEW one-use WORK release. Do not run old `work:hq:quick-pill:release-once`, `work:hq:inbox-polish:release-once`, or any other spent release script.

## Approved refinement

Original issue: the centered QUICK ACTIONS control looked overly wide, visually heavy, and lonely in a tall white card footer. The revised inbox-only treatment uses:
- a narrow, centered purple-gradient capsule with softer shadow, balanced label, smaller chevron, and controlled hover/focus styling;
- reduced blank footer padding to keep the whole request card compact;
- a white, precisely aligned dropdown below the pill with three existing actions in the same order: Update status, Message customer, Open request →;
- a **44px minimum touch target** for both the capsule and each dropdown action;
- natural in-flow expansion (not an absolute overlay), because `.jill-inbox__card{overflow:hidden}` would clip floating menus and mobile cards;
- keyboard Escape with restored summary focus, reduced-motion support, and visible focus rings.

The full request detail's *noncompact* Quick Actions presentation and all authenticated mutation/network operations are unchanged.

## Source and verification

Files changed in the UI: only `services/jill-order-desk/app-home/app/styles/request-actions.css` and `services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx`. A **separate** frozen 11-file overlay manifest `scripts/work-hq-quick-pill-polish-package.mjs` retains the same ten prior UI files and pins only the two changed blobs.

`test:work-hq-quick-pill` now checks the polished (current) source. `test:work-hq-quick-pill-polish-hold` requires the historical v1 pins and release profile to stay unchanged. A new `work:hq:quick-pill:polish:check` source guard checks UI hashes and command/navigation/keyboard behavior. Existing inbox/navigation tests continue to run.

The retired `work-hq-quick-pill-package.mjs`, `release-work-hq-quick-pill-owner.mjs` and `test-work-hq-quick-pill-release.mjs` intentionally remain tied to their historical v1 source. They must **not** be reused or re-pinned to a new Cloudflare version. No new release profile is created yet: the user explicitly wants to accumulate additional visual changes before a PowerShell pull/push.

After the user finishes reviewing other changes, freeze the final aggregated UI scope, collect a fresh Owner read-only WORK runtime inventory, verify current Cloudflare source annotation and receipt history, and create/certify one distinct new WORK-only release profile with all the current UI changes. Do not touch LIVE, customer data/commands, quote canary, paid plans, R2 or D1 migrations.
