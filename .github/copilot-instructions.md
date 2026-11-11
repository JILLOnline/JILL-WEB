# GitHub Copilot instructions — JILL HQ / My JILL WORK

Checkpoint: 2026-11-11. This branch starts from the pinned source integration head of PR #190, commit e344a32f4b56d4d69a775245b1535db4f1521ff9. It is NOT main, a LIVE release, or proof of authenticated WORK acceptance. This file is a working contract for Copilot in VS Code/Visual Studio, not authorization for a deployment.

## Read before acting

1. Read AGENTS.md in full. Follow its domain ownership, no-duplicate, security, testing and housekeeping rules.
2. Read docs/JILL_HQ_MYJILL_COPILOT_PLAN_20261111.md and issues #152, #163, #164, #154 and #155.
3. For HQ visuals, read docs/JILL_HQ_VISUAL_SYSTEM.md and docs/WORK_HQ_OWNER_VISUAL_QA_20261024.md. For cross-system authority, read docs/WORK_UNIFIED_INTEGRATION_MILESTONES_20261023.md, docs/JILL_HQ_MY_JILL_CUSTOMER_HANDOFF.md and docs/DOMAIN_OWNERSHIP.md.
4. For customer account work, read docs/CUSTOMER_ACCOUNT_HYBRID.md and the current implementation; distinguish historical architecture text from the newer nine-route scope in issue #164.
5. For rewards, read docs/JILL_REWARDS_WORK_FLEX_REDEMPTION.md and the active v13 contracts. The target policy (0.1 point/$1 earned, 1 point=$1 discount, 0.1-point steps, eligible subtotal >= 10x reward value, no stacking, no 50-point unlock) is NOT an activated ledger migration. Do not alter existing balances, issued coupons, v13 values or Shopify discounts.

## Exact safe boundaries

- WORK store: jill-work.myshopify.com; preserve the existing installed Shopify app, extension UIDs, handle, scopes, credentials, D1/Google sources and deployed versions. LIVE, KEEP and the current production storefront are excluded.
- PR #188 (HQ), #189 (My JILL) and #190 (pinned join) remain draft and unmerged. Source CI is not authenticated browser acceptance, and no new commit automatically certifies or authorizes release.
- Do not run deployment, extension publishing, Cloudflare upload/traffic allocation, D1 migration/write, customer message, invoice, discount issue/redemption, checkout/order mutation, payment/refund, paid service, or historical one-use release/rollback scripts. Never reset spent receipts. Explicit separate Owner approval and fresh provider evidence are required for any later gated operation.
- Never infer an authenticated customer from an email, phone, typed ID, UI route or guest claim. Verify Shopify Customer Account identity and exact request ownership. Verify every merchant operation using Shopify online staff auth, JILL D1 grants and canonical authorization.
- Shopify owns products/variants/inventory, customer accounts, Orders, taxes, checkout and fulfillment. Google WORK QA signed intake/events own original Custom Orders; WORK D1 owns authorized merchant draft/receipt state, not a parallel customer/order database. Rewards has one backend wallet authority. Preserve Contact Us in a truthful OFF/disconnected state until its distinct intake and authorization gates pass.
- One component, visual token, business rule, integration adapter, state machine and data owner per responsibility. Never reintroduce the five-tab HQ assumption; the accepted HQ shell has six visible sections including Contact Us.

## Where work lives

- HQ embedded Admin shell/routes: services/jill-order-desk/app-home/app/routes/app.tsx and nearby app.*.tsx files.
- HQ shared look: services/jill-order-desk/app-home/app/styles/hq-theme.css; per-page files under the same styles directory. Keep the existing dark-purple/gold navigation, brand density and disclosures; do not add global override or patch CSS.
- HQ domain and auth/data rules: services/jill-order-desk/*.mjs plus backend/ and shared/ canonical policy/contract modules.
- My JILL single full-page Shopify Customer Account entry: extensions/jill-account-dashboard/src/Dashboard.jsx, hub/AccountHub.jsx, hub/ConnectedHub.jsx, hub/routes.mjs, and pages/*.jsx.
- My JILL currently exposes eight internal routes in routes.mjs. Issue #164 targets nine, including Contact Requests, which has not been added to the current registry. Record the gap; do NOT invent a connected ticket screen or enable Contact replies.
- My JILL uses Shopify Customer Account Preact UI extension components, not Theme Core CSS or arbitrary DOM styling. Preserve the existing Rewards/Coupons UI, signed request filtering, guarded drafts and native Shopify Orders/Profile links.
- Canonical UI/theme architecture: docs/DESIGN_SYSTEM.md, docs/DOMAIN_OWNERSHIP.md. Never duplicate Theme Core tokens in extensions.

## Required execution loop

1. Inspect exact local branch, Git status, installed Node and package scripts; ensure the checkout is on the requested handoff branch with no overwritten local changes. Do not cherry-pick, rebase or merge protected drafts as a setup shortcut.
2. Reproduce the source-only baseline using EXISTING tests. Root safe commands include npm run check:account-hub, npm run test:my-jill-presentation, npm run test:customer-custom-orders, npm run test:work-message-inboxes and npm run test:work-hq-inbox-ui. For HQ's nested app, after appropriate local dependencies: npm run typecheck --prefix services/jill-order-desk/app-home and npm run build --prefix services/jill-order-desk/app-home. Report commands attempted, pass/fail and blockers; don't claim tests were run unless logs prove it.
3. Capture an inventory of six HQ areas and all currently exposed My JILL routes; mark each feature SOURCE, PARTIAL WORK, HOLD or UNVERIFIED. Maintain one source of truth for that matrix.
4. Start with a SMALL, SOURCE-ONLY, visual/interaction work item. Compare Owner-approved presentation against real component behavior and local synthetic browser fixtures at 390px, 768px and 1440px (and 320px when possible). Maintain focus visibility, 44px mobile targets, no horizontal overflow, loading/empty/error states, honest source age and responsive requests navigation. Check accessibility and copy. Do NOT change auth, backend policy, flags or command handlers during visual-only work.
5. Make one scoped change at a time, then run relevant source tests, build/typecheck, repository guards and regression tests. For visual changes, attach before/after screenshots and note the fixture vs real authenticated browser distinction.
6. Request a human/Owner review before any WORK runtime release. Real signed Owner + Customer A + Customer B + guest acceptance, genuine request/message readbacks and explicit release receipts are separate gates. Never claim a feature DONE solely from source tests.

## First assignment for Copilot

Audit the existing HQ Requests accordion, request-detail hierarchy, Messages/Contact OFF states and Catalog stock copy alongside My JILL Overview, Custom Orders, Messages, Rewards and Coupons. Produce a concise table of observed SOURCE implementation vs missing WORK proof and a screenshot-driven visual defect list, citing exact files/lines. Then choose ONE low-risk visual-only defect (prefer clarity/readability/stock wording without changing data truth), implement it in its canonical component/CSS owner, add a regression guard, and provide the test evidence. If screenshots or safe local fixtures are unavailable, stop before speculative styling changes and report that limitation.

Do not touch storefront/Theme Core, physical machine/capacity systems, CRM, unapproved marketing, unrelated worker automations, or Etsy in this slice.

## Definition of done for this handoff sprint

A clean branch, changed-file list, reproducible safe test outputs, no release side effects, screenshots at desktop/tablet/mobile where technically available, an honest SOURCE/PARTIAL WORK/HOLD matrix, one reviewed visual improvement or an explicit proof-backed blocker, and a recommended next small task with Owner signoff gate.