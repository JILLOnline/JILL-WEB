# JILL WEB release runbook

Canonical launch checklist for the new Theme Core + Rewards + My JILL.
Production-changing actions are **manual**, independently authorized, and
bound to the exact SHA tested. Do not infer E2E readiness from CI alone.

## Verified environment map (2026-10-11)

| Surface | Store/app/theme | Verified state |
| --- | --- | --- |
| Public storefront | jqtdgr-1y.myshopify.com / jillonlinestore.com | JILL theme 165550686451, role LIVE; never target for development pushes |
| New Theme Core staging | jqtdgr-1y.myshopify.com, JILL WORK 165562941683 | UNPUBLISHED; sole staging write target |
| Retained storefront copy | jqtdgr-1y.myshopify.com, JILL KEEP 165562876147 | UNPUBLISHED; do not modify without separate authorization |
| Rewards development | jill-work.myshopify.com | Separate Shopify WORK test store; not the JILL WORK theme |
| Rewards account app development | JILL WORK Rewards client f8e1ebdbae84490dc8ea5b133637e6c0 | WORK-only releases and browser verification |
| Production account app | JILL Custom Form client ebf1a69d82f46619d2f2945faab78afa | Production release requires manual workflow and exact-SHA confirmation |
| Rewards v13 backend | Existing Apps Script authoritative engine | DO NOT create a second engine or reset balances |

Theme roles and IDs were read from the production Shopify CLI theme inventory
on October 11, 2026, using a read-only WORK-branch diagnostic.

## Operational controls repaired on October 11

- The Theme Core pipeline formerly targeted non-existent theme 165639192819.
  It now requires **JILL WORK** 165562941683 with role **unpublished**,
  checks identity/role before and after staging, and never uses --allow-live.
- Shopify CLI can return exit code zero while reporting file deletion errors.
  The staging pipeline now verifies the final --json result and fails on
  warnings, file errors, wrong role, or wrong theme. Push uses --nodelete to
  preserve remote files (do not infer a perfectly clean remote file inventory).
- Previous production customer-account workflow automatically released apps on
  push to theme-core scripts/extensions. It triggered releases while release
  diagnostics were being committed, culminating in jill-custom-form-103 on
  October 11. The workflow is now **workflow_dispatch only** with required
  confirmation text, full certified SHA and JILL-ACCOUNT-LIVE environment.
- Rewards Apps Script production deployment is now workflow_dispatch only,
  with exact-SHA confirmation and JILL-REWARDS-LIVE environment.
- On October 11 GitHub reported Shopify theme and app tokens configured, but
  CLASPRC_JSON and CLASP_JSON absent. Production Apps Script deployment remains
  blocked until credentials are securely restored. Never print or commit them.
- A successful WORK source test, successful published app bundle, or healthy
  watchdog does not prove that live account pages render or can redeem.

## Launch-critical scope

Release **only** storefront Theme Core + existing custom product/checkout forms,
authenticated account Overview, real points, coupon wallet/public offers, Rewards
redemption, native Orders/Profile links. Custom-order production timeline,
Celebrations, Saved Preferences, automated reminders and design approvals are
postlaunch unless real persistence/ownership and consent contracts pass.

Do not show incomplete account modules as working. Do not replace the native
Shopify cart/session with a second checkout system.

## Certification order

1. **Theme staging**
   - Exact theme-core SHA: CI validation + package + clean structured push pass.
   - Verify JILL WORK remains unpublished and original JILL remains LIVE.
   - Inspect home, collections, configurable products, cart, Custom Order form,
     navigation, EN/ES, 390/768/1440 widths, and Shopify Theme Editor.
   - Document screenshots and regressions. No theme publish yet.
2. **WORK Coupons**
   - Use the signed-in Shopify Customer Account extension browser (not Admin API).
   - Confirm Customer Account wallet read, current Storefront public offers,
     empty vs unavailable handling, two customer identities isolated, and
     no customer IDs accepted from URLs/inputs.
   - Keep redemption disabled if wallet provenance is not proven.
3. **WORK Rewards transaction**
   - Existing v13 engine only; prove No/Yes modal, nonce idempotency, one
     30→20 points transaction on a synthetic QA customer, one customer-targeted
     $5 / $25-minimum / 30-day coupon and wallet reconciliation after refresh.
   - Test duplicate/concurrent click, worker timeout, refund/expiration,
     customer-targeting, checkout minimum and nonstacking rules.
   - "Use Now" cart persistence must match a tested Shopify-native contract.
     Never promise browser-session expiry from /discount/{code} alone.
4. **Production infrastructure**
   - Restore GitHub Apps Script deployment credentials securely.
   - Read and snapshot production Rewards ledger, scopes, metafield definitions,
     Apps Script deployment SHA and watchdog. Do not reset points.
   - Confirm the production app version and extension IDs, migration parity,
     native account navigation, and rollback candidate. No guest claim by email.
5. **Coordinated release**
   - Freeze exact tested commit(s); do not merge a WORK draft PR blindly.
   - Deploy backend only if needed, then production app with manual workflow
     authorization, verifying the exact released app version and first browser
     errors; publish the approved staged theme **last** through Shopify's
     deliberate theme publish process.
   - Run postrelease checkout/account smoke tests immediately; rollback theme
     and app independently if critical checks fail. Preserve customer ledger.

## Required evidence and stop conditions

| Evidence | Stop if absent |
| --- | --- |
| Theme staging clean push at exact SHA, correct role and name | No theme publish |
| Browser-confirmed My JILL runtime and two-customer wallet isolation | No redemption |
| Exactly-once WORK redemption and real Shopify coupon/checkout test | No production Rewards activation |
| Production backend credentials, scope definitions and source integrity | No backend release |
| Manual production app release with exact SHA and runtime verification | No full launch |
| Desktop/mobile + commerce + native profile QA | No storefront publish |

## Manual deployment contracts

- Theme Core staging workflow: .github/workflows/theme-core.yml
  (auto only for theme-related source changes; non-LIVE JILL WORK target).
- Production customer-account workflow: .github/workflows/deploy-customer-account.yml
  requires "DEPLOY JILL ACCOUNT LIVE" and exact jill/theme-core SHA.
- Production Rewards backend workflow: .github/workflows/deploy-rewards-backend.yml
  requires "DEPLOY JILL REWARDS BACKEND LIVE" and exact jill/theme-core SHA.
- READ-ONLY theme inventory/credential audit:
  jill/rewards-work .github/workflows/jill-launch-readiness.yml.

No LIVE theme is touched by these development workflows, and no source CI pass
alone constitutes sign-off for publishing.
