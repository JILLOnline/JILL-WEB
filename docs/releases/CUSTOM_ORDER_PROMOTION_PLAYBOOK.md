# Custom Order promotion — WORK first, LIVE independently

## Build staging package (no upload)
From a clean tracked checkout of `jill/governance-release-boundaries`:
```powershell
git fetch origin
git switch jill/governance-release-boundaries
git pull --ff-only
node scripts/prepare-work-custom-order-theme.mjs
if ($LASTEXITCODE -ne 0) { throw "Staging build failed" }
node scripts/audit-theme-dependencies.mjs .work-custom-order-theme
if ($LASTEXITCODE -ne 0) { throw "Staging audit failed" }
```
Staging is gitignored and cannot be mistaken for a canonical website checkout. Never stage by manually copying only page.custom-order.json.

## WORK-only unpublished upload (separate gated action)
Before any upload independently verify store and current theme list:
```powershell
npx.cmd --no-install shopify theme list --store jill-work.myshopify.com
```
If QA package passes detailed translation/dynamic-resource checks and correct Shopify app proxy config is confirmed, create **a new unpublished theme** with Shopify CLI from `.work-custom-order-theme`. Do not use an existing theme ID, publish, `--live`, or omit `--store jill-work.myshopify.com`. Record new theme ID and verify published `test-data` (ID `155877572743`) remains MAIN. CLI syntax must be confirmed with `npx.cmd --no-install shopify theme push --help` against installed version before the upload. Do not assume a new unpublished theme alone creates the Shopify Page object: create a separate WORK-only page with suffix `custom-order` once the theme is staged.

**Important:** the staging builder removes the legacy direct-Google default and sets `verified_submission_endpoint` to `/apps/jill-custom-order`, but Shopify existing theme overrides and app proxy configuration still require browser verification. Authenticated customer A/B intake QA remains pending.

## LIVE promotion is a distinct release, NOT this staging package
1. Validate website canonical changes on `jill/theme-core` through small reviewed integration PR. Do not merge all of accounts or the governance branch.
2. Produce a production-only website theme artifact from a newly pinned, tested website commit, never from `.work-custom-order-theme`. Use LIVE-specific backend contract and correct production credentials only after a separate production privacy/ownership migration approval.
3. Run independent website-only regressions with unchanged Accounts app version. Record production theme ID, KEEP rollback version, Shopify app version and backend schema. Obtain explicit approval. Preserve existing LIVE Custom Order submission behavior until replacement is proved compatible.
4. **No release to LIVE** until the user's independent authorization, a verified production environment matrix, network access and data migrations are completed. A code merge does not publish the app or theme.
5. Accounts extension release is separate; independently certify JWT, owner ledger, A/B denial, private fields and Rewards/Coupons regressions. Never point production account reads at WORK QA.

## Operational baseline
WORK `test-data` MAIN: 155877572743. Other preexisting themes Horizon 155877507207 and debut-vintage-theme 155877539975 are off limits for QA overwrite. Branch `jill/governance-release-boundaries` is an audit/staging branch, not a production code authority.
