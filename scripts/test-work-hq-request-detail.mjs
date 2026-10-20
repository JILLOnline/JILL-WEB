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
// The existing "Open request" navigation now belongs to the compact shared
// Quick Actions component, not an isolated inbox card footer.
const quickActions=readFileSync(base+'components/WorkRequestQuickActions.tsx','utf8');
assert.match(inbox,/<WorkRequestQuickActions record=\{item\} enabled=\{controlsEnabled\} compact\/>/);
assert.doesNotMatch(inbox,/Open request|jill-inbox__open/);
assert.match(quickActions,/\{compact&&<Link className="jill-actions__open-link"/);
assert.match(quickActions,/to=\{"\/app\/requests\/"\+encodeURIComponent\(record\.submission_id\)\}/);
assert.match(quickActions,/Open request <span aria-hidden="true">→<\/span>/);
assert.match(quickActions,/import \{Link,useFetcher,useRevalidator\} from "react-router"/);
assert.match(quickActions,/action:"\/app\/requests\/command"/);
const source=readFileSync(base+'routes/app.requests-source.server.ts','utf8');
assert.match(layout,/import \{loadVerifiedMerchantInbox\} from\s*".\/app.requests-source.server"/);
assert.match(layout,/await loadVerifiedMerchantInbox\(args\)/);
// The child index must have NO loader and NO server imports; the verified
// parent is the only registered request loader across every navigation.
assert.match(source,/export async function loadVerifiedMerchantInbox\(/);
assert.match(source,/workShopify\(env\)\.authenticate/);
assert.match(source,/loadWorkMerchantInbox/);
assert.match(source,/readWorkMerchantSourceCached/);
assert.doesNotMatch(inbox,/(?:export\s+(?:async\s+)?function|export\s+(?:const|let))\s+loader\b/);
assert.doesNotMatch(inbox,/workShopify|readWorkGoogleQaMerchantList|loadWorkMerchantInbox|work-merchant-source-cache/);
assert.match(layout,/export async function loader\(args:LoaderFunctionArgs\)/);
assert.match(layout,/shouldRevalidate/);
assert.match(layout,/useEffect/);
assert.match(layout,/visibleClientSnapshot/);
assert.doesNotMatch(layout,/localStorage|sessionStorage|document.cookie/);
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
assert.match(route,/WorkOriginalRequestDetails/);
assert.match(route,/loadAuthorizedWorkRequestDetail/);
assert.match(route,/export async function loader\(args:LoaderFunctionArgs\)/);
assert.match(route,/Quotes below are internal drafts/);
assert.match(route,/Customer approval and Shopify payments are not enabled here/);
assert.match(route,/WorkQuoteWorksheet key=\{record\.submission_id\}/);
assert.match(route,/WorkRequestQuickActions/);
assert.match(route,/WorkOrderDetails model=\{original\} submissionId=\{record\.submission_id\}/);
assert.match(route,/Last recorded update/);
assert.match(route,/← Requests/);
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
const snapshot={state:'ready',readOnly:true,scope:'inbox',verifiedAt:now-500};
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
  {...options,snapshot:{...snapshot,scope:'detail'}},
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
// Stress realistic back/forth patterns across the 15-second TTL:
// fast inbox -> detail -> inbox uses the SAME parent record; expiration,
// manual refresh and mutations must cause a new, authorized canonical read.
for (let cycle=0;cycle<210;cycle++) {
  const forward=cycle%2===0;
  const from=forward?currentUrl:nextUrl;
  const to=forward?nextUrl:currentUrl;
  const time=100000+cycle*100;
  const safe={
    currentUrl:from,nextUrl:to,
    snapshot:{...snapshot,verifiedAt:100000},
    now:time,
  };
  assert.equal(mayReuseWorkRequestsSnapshot(safe),time-100000<15000,
    'stress navigation TTL mismatch at click '+cycle);
  assert.equal(mayReuseWorkRequestsSnapshot({
    ...safe,formMethod:'POST',formAction:'/app/requests/command',
  }),false,'mutation must revalidate on every click '+cycle);
}
console.log('PASS WORK request navigation: one Owner-authorized parent feed, fast bounded sibling reuse, canonical refresh on write, secure direct access and 404, exact nine-field projection.');
