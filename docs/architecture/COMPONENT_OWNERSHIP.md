# Component ownership — single canonical implementation

| Paths | Canonical code owner | Notes |
| --- | --- | --- |
| `theme/**` | Website / `jill/theme-core` | Account changes must enter as small reviewed integration PRs; no wholesale overwrite from Accounts. |
| `extensions/jill-account-*/**` | My JILL Accounts / `jill/rewards-work` | Shopify extension releases must not publish themes. |
| `shared/customer-*.mjs` | Accounts contracts | Token-gated account transport and public projections. |
| `backend/custom-order-*.mjs`, `backend/shopify-work-app-proxy-auth.mjs` | Custom Order service | Authenticated ingress/account readers; independent deployment. |
| `backend/google-apps-script/**` | Backend services | Existing source mixes Rewards and Custom Order helpers: segregate *deployment packaging/targets*, not shadow-copy engines. |
| `services/custom-order-cloudflare/**` | WORK Custom Order gateway | Deploy only to exact verified WORK Worker. |
| `contracts/**` | Shared service interface | Backward-compatible contract reviewed by both lanes. |
| `scripts/**`, CI workflows | Designated release owner per script | Release commands must be component- and environment-specific. |

## Verified divergence (2026-10-12)

`jill/theme-core...jill/rewards-work`: diverged, 377 commits ahead and 8 behind relative to theme-core, 91 changed files reported by GitHub comparison. The file `theme/templates/page.custom-order.json` has the same blob in both branches; `theme/sections/main-custom-order.liquid` differs, as does `theme/assets/jill-custom-order.js`. My JILL `extensions/jill-account-dashboard/src/pages/CustomOrders.jsx` exists on rewards-work and not theme-core or main.

**Block bulk merges and whole-directory copies.** Audit exact changes; preserve existing form contract/content; make any required verified-owner compatibility change on the website lane via a small reviewed commit. Keep guest submission/ownership protections and current Rewards redemption behavior intact. Do not copy QA URLs or credentials into LIVE.
