# JILL Order Desk — WORK merchant host integration

Status: source contract only; no hostname, Shopify App Home, staff role or database is deployed.

This folder deliberately has **no public admin HTTP endpoint**. The current
WORK app is extension-only, with "Update URLs: Not yet configured" in
\`shopify app info --config work\` (verified October 14, 2026). It has three
Customer Account UI extensions and must retain their UIDs, app ID and existing
Rewards/data boundaries.

## Source pieces (built)

- \`../backend/jill-merchant-auth.mjs\`: strict Shopify WORK online staff
  session adaptor. It does **not** authenticate a request by itself.
- \`../backend/jill-merchant-policy.mjs\`: one operation/role policy; merchant
  writes intentionally disabled pending later phases.
- \`merchant-access.mjs\`: prepared D1 authority lookup and explicit
  owner-bootstrap command; no HTTP router and no actual database.
- \`admin-home.mjs\`: server-only read-only landing loader, requiring
  the official \`authenticate.admin(request)\` contract before D1 access.
- \`migrations/0001_staff_authority.sql\`: isolated WORK database schema; NOT applied.

## Required Shopify host (not yet configured)

Use the existing **JILL WORK Rewards app** identity
\`f8e1ebdbae84490dc8ea5b133637e6c0\` and
\`jill-work.myshopify.com\`. Do not run \`shopify app init\` in the repository
to create a second app. Use an official Shopify React Router scaffold as the
implementation reference for a new hosted App Home, with
\`@shopify/shopify-app-react-router\` and \`useOnlineTokens:true\`. Shopify
session storage, OAuth callback handling, and App Bridge must be provided
by that official host. The actual loader must invoke \`authenticate.admin\`
before calling this source adapter.

Pseudo-integration contract (NOT a deployed route):

\`\`\`js
import {loadJillOrderDeskHome} from '../../merchant/admin-home.mjs';
import {authenticate} from '../shopify.server';

// React Router loader on the authenticated APP HOME origin, after host setup.
const result = await loadJillOrderDeskHome({
  request, authenticate, db: env.JILL_ORDER_DESK_WORK_DB,
});
return Response.json(result.model, {
  status:result.status,headers:result.headers,
});
\`\`\`

The host's app configuration will ultimately need an exact WORK HTTPS
\`application_url\`, \`embedded=true\` and validated auth redirect URLs. The
user controls the required Shopify/Cloudflare authorizations. Until those
are established, do not set arbitrary URLs or deploy/release an app version.
A working React Router host and real authenticated staff session are
prerequisites to an actual merchant UI.

## Runtime gates before calling it operational

1. Verify WORK-only public Client ID, WORK shop, exact app version and current
   installed scopes; do not invoke the LIVE Shopify connector.
2. Deploy a supported Shopify React Router App Home host using the official
   auth/session SDK, with online tokens enabled. Keep WORK-only app URL.
3. Provision one isolated D1 database and apply migration after explicit
   permission. Never use an existing customer/Rewards database.
4. From the **genuine WORK store owner session**, explicitly bootstrap Owner.
   No emails, manually typed staff IDs, or guesswork; role writes disabled.
5. Test Owner -> 200, non-owner/no-grant -> 403, offline session -> 401, D1
   disconnected -> 503 and LIVE shop -> 401. Inspect zero customer data leaks.
6. Unlock the read-only merchant inbox only after a scoped, audited Google
   merchant reader exists (P2). Production statuses and drafts still disabled.
7. Stage WORK app changes and verify existing customer extensions/Rewards
   remain unaffected. Do not publish to LIVE without separate authorization.

## Independent source checks

\`npm.cmd run test:jill-order-desk-home\`

No Shopify SDK, D1 or Google secrets are required for this source test.
