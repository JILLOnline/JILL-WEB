# JILL HQ + My JILL — Copilot execution plan (2026-11-11)

**Status:** documentation-only handoff for source work. Branch: jill/copilot-hq-myjill-handoff-20261111. Source starting point: PR #190 head e344a32f4b56d4d69a775245b1535db4f1521ff9 (HQ PR #188 c9129160b43a6498e91f7386bae7407223b67823, My JILL PR #189 a93f601e2864028c7e9671a946e3bdac7c553282). These three PRs are open draft and unmerged. The reviewed joined source tree was 3ac8cdd4e7c819b1cfda710075565ef152eb6d5c. The source-level GitHub Actions receipts passed; the active WORK app was not changed by them.

**Evidence limit:** This snapshot was prepared by reading GitHub repository contents, active tracking issues and PRs on Nov 11, 2026. We did not open the private codex:// thread or the user's local Visual Studio workspace, run source tests locally, inspect the installed current Shopify/Cloudflare allocation, or perform authenticated WORK browser QA. Do not use this snapshot to claim fresh runtime state. Issue #152 is the active feature register; docs with earlier release IDs can be historical, even when they contain useful architecture.

## A. Truthful progress against scope

Statuses: SOURCE means code/tests/design exist, not installed WORK proof. PARTIAL WORK means prior authenticated Owner observation for specific reads, not workflow completion. HOLD means disabled/gated or unaccepted. UNVERIFIED means no sufficient current proof.

| Area | Evidence available | Status / missing proof |
| --- | --- | --- |
| HQ shell/navigation | services/jill-order-desk/app-home/app/routes/app.tsx has Home, Requests, Messages, Contact Us, Catalog, Settings. Oct 24 Owner screenshots show embedded Admin shell. | PARTIAL WORK. Preserve SIX areas; current OAuth refresh, mobile keyboard/focus and performance not accepted. |
| HQ Requests/detail | app.requests.tsx, app.requests.$submissionId.tsx, inbox styles and signed read modules; Owner saw a QA request/detail. PR #188 corrects name/date states. | PARTIAL WORK for detail, SOURCE for newest fixes; inbox accordion and two direct actions still need authenticated screenshot/accessibility evidence. |
| HQ Messages | app.messages.tsx and canonical message policies; verified request selector observed. | HOLD for public threads; conversation flag OFF; no two-way customer readback or delivery claim. |
| HQ Contact Us | app.contacts.tsx and source policies, native Shopify contact remains. | HOLD. Don't represent disconnected ticket intake as empty/zero or enable replies. |
| HQ Quote Studio | Quote worksheet, save/reconcile source in PR #188, joined exact source QA in #190; historical 0% canary. | SOURCE/HOLD. No new real Save→Leave→Reload Owner acceptance, published quote, Shopify calculate, invoice or payment. |
| HQ Catalog | Oct 24 screenshots show Products, Collections, Inventory and Locations. | PARTIAL WORK READ. No certified HQ write/edit; Shopify truth, untracked stock must read “Not tracked / quantity unknown.” |
| HQ Home/Settings | Screens and owner session overview observed. | PARTIAL WORK. Verify source freshness/unknown states, permissions, staff denial and p50/p95 perf; never invent totals. |
| My JILL foundation | Dashboard.jsx → ConnectedHub.jsx → AccountHub.jsx. Shopify Preact components, native Orders/Profile links. | SOURCE, not certified published Customer A/B/guest WORK acceptance. |
| My JILL navigation | hub/routes.mjs contains 8 routes: Overview, Rewards, Coupons, Custom Orders, Messages, Celebrations, Saved, Settings. | SOURCE. Master #164 targets 9 with Contact Requests; do not create a pretend active ticket route while Contact is OFF. |
| My JILL Custom Orders | pages/CustomOrders.jsx, signed policies, PR #189 deep-link reset after exact owner verification. | SOURCE; need real A/B/guest/account-switch, deep link, mobile and expired session readbacks. |
| My JILL Messages / approvals | pages/Messages.jsx, RequestConversation.jsx, OwnedQuotePreview.jsx and backend proposals. | SOURCE/HOLD for two-way messaging, signed customer decisions and quote/commerce. |
| Rewards & Coupons | Existing customer UI and v13 system; target flexible rewards in docs/JILL_REWARDS_WORK_FLEX_REDEMPTION.md. | Existing program retained; target redemption migration HOLD. Don't change ledger or assume new policy live. |
| Connected customer journey | #154 messaging, #155 quote-to-commerce. | HOLD. No real cross-app signed acceptance nor one native Shopify Draft Order/invoice/paid Order proof. |

## B. Visual direction: polish, do not restart

**JILL HQ:** use the established compact, premium, dark-plum/gold Admin visual system. Shared CSS owner: services/jill-order-desk/app-home/app/styles/hq-theme.css, with local composition owners beside it. Current CSS token examples: ink #211525, muted #66586d, accent #774099, plum #652a91, soft #faf6fd, panel border #e8deed; navigation uses gold active treatment. Do not invent a parallel design system. Source currently sets 12px desktop base text while Oct 24 Owner feedback requests approximately 14–16px legible body content. Audit actual rendered density/readability before tuning the shared owner. Keep compact controls, readable data tables, clear hierarchy, reviewable disclosures, Shopify Admin page sizing, 44px minimum mobile targets, visible focus and reduced-motion behavior.

Protect these accepted patterns:
- One compact multi-column Requests row with an accessible full-row accordion; directly visible “Message Customer” and “Update Status”; full detail one click away. Do not regress to a giant Quick Actions dropdown.
- Request detail prioritizes Items & Personalization, verified status/source, concise header and clearly labelled QA/test records. Advanced technical audit stays available but collapsible.
- Quote form shows draft/unsaved and disabled states truthfully. Never visually enable a backend-OFF operation.
- Messages and Contact have honest unavailable/connection states; no fictional unread count, zero record count or sent notification.
- Catalog distinguishes untracked/unknown inventory from zero. No CRUD-looking affordance without allowed capability.
- Owner-facing time formatting is understandable; raw UTC stays available for diagnostics.

**My JILL:** use the existing Shopify Customer Account UI extension components. Preserve the branded greeting, existing Rewards cards/coupon wallet, simple navigation, sensible request/thread progression and native Shopify Orders/Profile links. No arbitrary Theme Core CSS injection, parallel account page, non-native checkout, or second Rewards state machine. Preview should look cohesive in 390px, 768px and 1440px contexts (and 320px if supported by the platform). Check navigation wrapping, hidden/overflowed actions, loading/empty/error copy, bilingual EN/ES where applicable, focus and touch.

Never replace Owner-approved visuals solely because an older five-tab scope or a generated mockup says otherwise. Before/after screenshots must use the same fixtures/viewport and note if screenshots are synthetic rather than signed WORK.

## C. Immediate VS Code / Copilot setup

Use a clean local worktree. The GitHub branch exists remotely, but this handoff has NOT opened your computer or switched its active VS Code branch. Do not discard local edits. From the existing local repo root in a PowerShell terminal:

    git status --short
    git fetch origin
    git switch --track origin/jill/copilot-hq-myjill-handoff-20261111
    git log -1 --oneline
    node --version

If Git says a matching local branch already exists, inspect it and use git switch jill/copilot-hq-myjill-handoff-20261111; never force-reset. Nested app requires Node >=22.12.0. Review package.json and lockfiles, then install missing local dependencies as appropriate. No Shopify app dev/deploy or Cloudflare release just to preview code.

Safe existing source checks, executed from repo root one at a time (record actual outcomes):

    npm run check:account-hub
    npm run test:my-jill-presentation
    npm run test:customer-custom-orders
    npm run test:work-message-inboxes
    npm run test:work-hq-inbox-ui
    npm run test:work-hq-quote-ui-wiring
    npm run typecheck --prefix services/jill-order-desk/app-home
    npm run build --prefix services/jill-order-desk/app-home

Some tests need dependencies/fixtures and may fail because of environment. Report a reproducible blocker; never bypass guards or mark tests green by expectation. Do not run historic one-use activation, upload or rollback scripts.

## D. Ordered execution and acceptance

### Sprint 0 — establish local truth (read-only + SOURCE tests)
- Check branch/head, dirty files, Node/deps and exact source tree. Inventory any differences between local workspace, PR #190 and the active (if separately verified) WORK deployment. Don't assume the source branch is installed.
- Run the safe commands above, logging pass/fail, script names and evidence. Inventory screen owners and existing screenshots/fixtures.
- Produce a matrix for HQ six areas and My JILL eight implemented routes plus the ninth planned Contact Requests. Mark WORK vs SOURCE vs HOLD accurately.

**Exit:** clean starting point, test log, exact owner file list and top three visual defects grounded in the current implementation.

### Sprint 1 — visual baseline and one controlled polish
- Capture consistent local browser screenshots/fixture outputs at 390, 768, 1440 (plus 320 where supported) for HQ Home, Requests closed/open, Request detail, Messages OFF, Contact OFF, Catalog, Settings, plus My JILL Overview, Custom Orders, Messages, Rewards and Coupons.
- First review legibility, action hierarchy, navigation overflow, one-row Requests behavior and stock truth wording; select ONE defect with a canonical file owner. Proposed safe candidates are a verified typography-density regression or incorrect unknown-inventory text. Do not guess without a reproduced case.
- Implement a source-only scoped change and a focused regression test without altering auth, server data, flags, scripts, receipts or command permissions. Preserve the compact premium JILL look. Re-run focused and broader relevant checks.

**Exit:** before/after screenshots with truthful fixture label, no horizontal overflow, keyboard focus, 44px phone targets, all actions retained, tests and file-by-file diff.

### Sprint 2 — independent HQ WORK browser acceptance (requires Owner action / release gate)
- Recheck actual deployed Worker/D1/permissions read-only, not old release docs. Signed Owner + denial scenarios; six pages across desktop/tablet/phone, real request IDs masked, error/loading/disconnected states.
- Verify request accordion, details, status controls and message draft presentation without writing to real customers. Record 20-run cold/warm p50 and p95 once access is granted.
- Quote Save→Leave→Reload, Contact and public messages remain disabled until independently authorized one-use WORK test conditions and readback exist.

**Exit:** explicit Owner signed screenshots/receipts and list of WORK blockers; never infer full release from source tests.

### Sprint 3 — independent My JILL WORK browser acceptance (separate release gate)
- Keep exact installed extension UIDs. Verify real Customer A, B, guest, expired session, A→B, deep links/back, request ownership, native Orders/Profile and phone/desktop layout.
- Verify existing v13 Rewards/Coupons rendering without changing points or issuing coupons; treat new flexible target policy separately.
- Decide and document the ninth Contact Requests presentation as an OFF/coming-later contract before adding UI. Never claim connected customer replies.

**Exit:** real signed account isolation and UI proof, no customer writes or extension publication without permission.

### Sprint 4 — integrated journey, explicitly gated
- Under #154, certify same signed Custom Order thread read from HQ and My JILL, exact idempotent reply receipts, account isolation and no duplicate messages.
- Under #155, certify quote source revision/Shopify variant pricing/calc, immutable customer agreement, one authorized Shopify Draft Order + separately sent invoice + native paid order and tracking readback, with distinct approval stages.
- Contact durable intake and flexible Rewards migration have their own acceptance/migration gates. No duplicate authority, no LIVE/KEEP change, no paid infra.

**Exit:** independently reproduced signed QA receipts, rollback plan and discrete release decision. This sprint is not authorized by the creation of this document.

## E. Required Copilot report after each change

Report:
1. Branch and exact commit; files changed and why each is the canonical owner.
2. Screens visited, screenshot/fixture vs signed WORK identity, viewport, relevant state.
3. Tests actually executed (command + pass/fail), environment blockers and regressions.
4. Status changes SOURCE/PARTIAL WORK/HOLD only when supported by evidence.
5. Security/privacy and backend flag effects (expected NONE for visual sprint).
6. Smallest next task and any distinct Owner release approval still needed.

## F. Paste this into Copilot Chat

You are the JILL-WEB implementation partner working on the isolated branch jill/copilot-hq-myjill-handoff-20261111, based on PR #190. First read AGENTS.md, .github/copilot-instructions.md and docs/JILL_HQ_MYJILL_COPILOT_PLAN_20261111.md, and respect issues #152/#163/#164/#154/#155. Inspect my actual local status, do not discard changes, and do not touch production, LIVE, KEEP, deployments, D1/customer writes, invoices, coupons or one-use receipts. Run the documented safe tests, inventory the current six HQ areas and eight My JILL routes (nine-route target), then produce a screenshot-driven source-only visual assessment. Implement ONE low-risk visual/UX fix in its canonical owner with a regression test, keep all existing behaviors/authorization unchanged, and show the diff, tests, visuals and remaining WORK acceptance gates. Stop if local tree, fixtures or protected permissions are uncertain; report exact evidence rather than guessing.
