import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectWorkMerchantInbox} from '../services/jill-order-desk/merchant-inbox-read.mjs';
import {
  mayReuseWorkRequestsSnapshot,isWorkRequestsPath,
  WORK_REQUESTS_NAVIGATION_REUSE_MS,
} from '../services/jill-order-desk/requests-navigation-policy.mjs';

const base='services/jill-order-desk/app-home/app/';
const route=readFileSync(base+'routes/app.requests.$submissionId.tsx','utf8');
const layout=readFileSync(base+'routes/app.requests.layout.tsx','utf8');
const inbox=readFileSync(base+'routes/app.requests.tsx','utf8');
const routes=readFileSync(base+'routes.ts','utf8');
const app=readFileSync(base+'routes/app.tsx','utf8');
const styles=readFileSync(base+'styles/request-detail.css','utf8');
const ownerReader=readFileSync('services/jill-order-desk/merchant-inbox-read.mjs','utf8');

// One parent route owns the verified feed; children are view-only consumers.
// React Router keeps this loader data during sibling navigation when fresh.
assert.match(routes,/route\("requests","routes\/app\.requests\.layout\.tsx",\[/);
assert.match(routes,/index\("routes\/app\.requests\.tsx"\)/);
assert.match(routes,/route\(":submissionId","routes\/app\.requests\.\$submissionId\.tsx"\)/);
assert.match(routes,/route\("requests\/command","routes\/app\.requests\.command\.tsx"\)/);
assert.match(inbox,/useRouteLoaderData\("routes\/app\.requests\.layout"\)/);
assert.match(inbox,/encodeURIComponent\(item\.submission_id\)/);
assert.match(inbox,/Open request workspace/);
assert.match(layout,/loader as loadVerifiedInbox/);
assert.match(layout,/await loadVerifiedInbox\(args\)/);
assert.match(layout,/shouldRevalidate/);
assert.match(layout,/mayReuseWorkRequestsSnapshot/);
assert.match(layout,/args\.params\.submissionId/);
assert.match(layout,/throw new Response\("Not found"/);
assert.match(layout,/status:404/);
assert.match(layout,/verifiedAt:Date\.now\(\)/);
assert.match(layout,/headers\.set\("cache-control","private, no-store, max-age=0"\)/);
assert.match(layout,/headers\.set\("x-content-type-options","nosniff"\)/);
assert.match(route,/useRouteLoaderData\("routes\/app\.requests\.layout"\)/);
assert.match(route,/useParams\(\)/);
assert.match(route,/item=>item\.submission_id===submissionId/);
assert.match(route,/state==="ready"&&!record\?"not_found"/);
assert.match(route,/Latest verified snapshot — not a complete status history/);
assert.match(route,/Full item customization, customer contact, attachments,/);
assert.match(route,/Quotes, Shopify fulfillment and payments remain separate/);
assert.match(route,/WorkRequestQuickActions/);
assert.match(route,/Source revision/);
assert.match(route,/Last recorded update/);
assert.match(route,/Custom Orders inbox/);
assert.match(app,/export function shouldRevalidate/);
assert.match(app,/if\(!formMethod && !formAction/);
assert.match(styles,/@media\(max-width:750px\)/);
assert.match(styles,/:focus-visible/);
assert.match(styles,/\.jill-request__grid/);
assert.doesNotMatch(styles,/!important|@import|url\(/i);
assert.doesNotMatch(route,/custom-order-account-read|JILL_SHEET_ID|SHOPIFY_ACCESS_TOKEN|JILL_CUSTOM_ORDER_GATEWAY_SECRET|shopify_customer_id|useFetcher|useSubmit|fetch\(|<form|<button|action\s*\(|workShopify\(|readWorkGoogleQaMerchantList/);
assert.match(ownerReader,/readWorkMerchantPermission/);
assert.match(ownerReader,/access\.role!=='owner'/);
assert.match(ownerReader,/return result\(200,projectWorkMerchantInbox\(source\)\)/);

const raw={
  version:1,operation:'custom_order.merchant.list.result',ok:true,
  complete:true,shop:'jill-work.myshopify.com',records:[{
    submission_id:'jill:92b32355-900e-47ba-8946-ccd93190a3b7',
    revision:1,customer_status:'received',internal_status:'new',
    submitted_at:'2026-10-13T21:13:57.364Z',
    updated_at:'2026-10-13T21:13:57.364Z',
    date_needed:'2026-10-30',fulfillment:'pickup',item_count:1,
    customer_email:'SECRET_PERSON@example.invalid',
    notes:'PRIVATE CUSTOMER NOTE',
    line_items:[{name:'PRIVATE PRODUCT'}],
    shopify_customer_id:'PRIVATE_123',
  }],
};
const model=projectWorkMerchantInbox(raw);
assert.equal(model.state,'ready');
const id=raw.records[0].submission_id;
assert.equal(model.records.find(r=>r.submission_id===id)?.revision,1);
assert.equal(model.records.find(r=>r.submission_id==='jill:does-not-exist'),undefined);
assert.equal(decodeURIComponent(encodeURIComponent(id)),id);
const serialized=JSON.stringify(model.records[0]);
for(const blocked of ['SECRET_PERSON','PRIVATE CUSTOMER','PRIVATE PRODUCT','PRIVATE_123'])
  assert.ok(!serialized.includes(blocked));
assert.equal(Object.keys(model.records[0]).length,9);

// Only a short-lived, already Owner-authorized snapshot may survive sibling
// navigation. Writes and manual refresh always re-read Google canonically.
assert.equal(WORK_REQUESTS_NAVIGATION_REUSE_MS,15000);
const currentUrl=new URL('https://work.example/app/requests');
const nextUrl=new URL('https://work.example/app/requests/'+encodeURIComponent(id));
const now=100000;
const snapshot={state:'ready',readOnly:true,verifiedAt:now-500};
const options={currentUrl,nextUrl,snapshot,now};
assert.equal(isWorkRequestsPath(currentUrl.pathname),true);
assert.equal(isWorkRequestsPath(nextUrl.pathname),true);
assert.equal(isWorkRequestsPath('/app/requests/command'),false);
assert.equal(mayReuseWorkRequestsSnapshot(options),true);
assert.equal(mayReuseWorkRequestsSnapshot({...options,
  currentUrl:nextUrl,nextUrl:currentUrl}),true);
for(const wrong of [
  {...options,snapshot:{...snapshot,state:'access_denied'}},
  {...options,snapshot:{...snapshot,readOnly:false}},
  {...options,snapshot:{...snapshot,verifiedAt:now-15000}},
  {...options,snapshot:{...snapshot,verifiedAt:now+1}},
  {...options,snapshot:undefined},
  {...options,formMethod:'POST',formAction:'/app/requests/command'},
  {...options,nextUrl:currentUrl},
  {...options,nextUrl:new URL('https://work.example/app')},
  {...options,nextUrl:new URL('https://work.example/app/requests/command')},
  {...options,nextUrl:new URL(nextUrl+'?sort=recent')},
])assert.equal(mayReuseWorkRequestsSnapshot(wrong),false,
  'Unverified navigation source reused: '+JSON.stringify(wrong).slice(0,180));
console.log('PASS WORK request navigation: one Owner-authorized parent feed, fast bounded sibling reuse, canonical refresh on write, secure direct access and 404, exact nine-field projection.');
