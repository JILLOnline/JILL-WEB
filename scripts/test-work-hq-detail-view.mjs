import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='services/jill-order-desk/app-home/app/';
const loader=readFileSync(base+'routes/app.requests-detail-source.server.ts','utf8');
const route=readFileSync(base+'routes/app.requests.$submissionId.tsx','utf8');
const index=readFileSync(base+'routes/app.requests.tsx','utf8');
const component=readFileSync(base+'components/WorkOriginalRequestDetails.tsx','utf8');
const styling=readFileSync(base+'styles/request-detail.css','utf8');
const config=readFileSync('services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8');

// Nothing in the current deployed/staged Worker manifests can turn this on.
// No remote detail read is allowed until QA version and signed endpoint exist.
assert.doesNotMatch(config,/JILL_WORK_HQ_DETAIL_ENABLED/);
assert.match(loader,/JILL_WORK_HQ_DETAIL_ENABLED!=="true"/);
assert.match(loader,/return result\(200,"not_connected"\)/);
assert.match(loader,/JILL_WORK_HOST_STAGE!=="canary"/);
// Authorization must be completed before the signed exact-ID Google read.
const auth=loader.indexOf('authenticateWorkAdminOnce<{session:unknown}>(');
const owner=loader.indexOf('readWorkMerchantPermission(');
const google=loader.indexOf('readWorkGoogleQaMerchantDetail(');
assert.ok(auth>0&&owner>auth&&google>owner,
  'detail must authenticate Shopify, authorize WORK D1 Owner, then read Google');
assert.match(loader,/action:"requests\.read"/);
assert.match(loader,/grant\.role!=="owner"/);
assert.match(loader,/scope:context\.cloudflare/);
assert.match(loader,/submissionId:id/);
assert.match(loader,/if\(typeof id!=="string"\|\|!ID\.test\(id\)\)/);
assert.match(loader,/status,headers/);
assert.match(loader,/private, no-store, max-age=0/);
assert.doesNotMatch(loader,/SHOPIFY_ACCESS_TOKEN|JILL_SHEET_ID|shopify_customer_id|localStorage|sessionStorage/);
assert.doesNotMatch(index,/readWorkGoogleQaMerchantDetail|WorkOriginalRequestDetails/);
assert.match(route,/export async function loader\(args:LoaderFunctionArgs\)/);
assert.match(route,/loadAuthorizedWorkRequestDetail\(args\)/);
assert.match(route,/useLoaderData<typeof loader>\(\)/);
assert.match(route,/WorkOriginalRequestDetails model=\{original\}/);
assert.match(component,/Original request · Items & personalization/);
for(const feature of [
  'Customer & event','Request-level instructions','Selected variations',
  'Per-unit personalization','Item references','Request-level references',
  'Qty {item.quantity}','Verified revision {details.revision}',
  'No unverified information is shown',
])assert.ok(component.includes(feature),'Missing '+feature);
assert.match(component,/details\.items\.map/);
assert.match(component,/item\.personalization_groups\.map/);
assert.match(component,/g\.allocations\.map/);
assert.match(component,/reference_ids/);
assert.match(component,/Reference IDs only/);
assert.match(component,/secure file preview\/download/);
assert.doesNotMatch(component,/<a\s+href=|<img\s+src=|fetch\(|URL\.createObjectURL/);
assert.doesNotMatch(styling,/!important|@import|url\(/i);
assert.match(styling,/jill-request__personalization-grid/);
assert.match(styling,/@media\(max-width:750px\)/);

// Version 7 QA endpoint has NOT been upgraded. Browser route must never
// expose the private raw_payload or the Google source URL.
assert.doesNotMatch(route,/raw_payload|script\.google\.com|JILL_HQ_MERCHANT_READ_SECRET/);
assert.doesNotMatch(component,/raw_payload|script\.google\.com|JILL_HQ_MERCHANT_READ_SECRET/);
console.log('PASS WORK full detail workspace: opt-in OFF, Shopify Owner+D1 before exact-ID Google read, independent from inbox, P1/P2 item UI, opaque file refs only.');
