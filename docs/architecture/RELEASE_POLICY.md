# JILL release policy — WORK / KEEP / LIVE

**Defaults:** no implicit deployments from commits, PRs, merges, postinstall, or CI. Production release requires separate explicit human authorization for each artifact and target. No auto-release of a Shopify app version. No `setupJillRewards()` in Custom Order QA.

1. **WORK** is isolated development and QA; validated code is not production. Use exact WORK store/client ID, theme ID, app config, Cloudflare Worker, Google QA script/deployment, and QA spreadsheet. Do not turn off the storefront password gate merely to make curl pass.
2. **KEEP** is an immutable known-good pinned commit + recoverable deployed theme/app/backend versions. It is *not* a third mutable source of customer data. Record artifacts and deployment IDs before release.
3. **LIVE** is production. Only an explicitly approved component deployment may change it. Never point a LIVE app at a QA spreadsheet or WORK Cloudflare endpoint.
4. **Website-only** release: audited `theme/**` artifact and theme preview; no `shopify app deploy`, extension release, Google/Cloudflare deployment, or customer identity migration.
5. **Accounts-only** release: audited extension/app artifact; no theme publish, customer request submission rewrite, or backend deployment unless separately scheduled/approved. Existing production theme must remain compatible.
6. **Backend-only** release: explicit named service version, target, secret ownership and backward compatibility; no implicit Shopify app/theme release.
7. Pin commit SHA, target IDs, source files, artifact checksum where available, contract version, tests, preview evidence, current deployed version, reversible action, restore procedure and authorizing person. Refuse unknown/mismatched targets.
8. Verify CI, WORK integration and regressions, A/B customer isolation, guest takeover denial, private merchant-field exclusion, account extension network approval, Rewards/Coupons nonregression and independent rollback before production consideration.

**No mass branch merges** between theme-core and rewards-work. Shared changes use narrow reviewed commits/cherry-picks or independent contract PRs. Branch protection and environment approvals must be configured separately in GitHub/Shopify; documentation alone does not enforce them.
