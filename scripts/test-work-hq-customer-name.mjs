// OFFLINE WORK-only inbox name presentation contract. No customer network I/O.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectWorkMerchantInbox} from '../services/jill-order-desk/merchant-inbox-read.mjs';

const root='services/jill-order-desk/app-home/app/';
const route=readFileSync(root+'routes/app.requests.tsx','utf8');
const style=readFileSync(root+'styles/inbox.css','utf8');
const ownerDetail=readFileSync(root+'routes/app.requests-detail-source.server.ts','utf8');
const reader=readFileSync('services/jill-order-desk/merchant-inbox-read.mjs','utf8');
const source=readFileSync(root+'routes/app.requests-source.server.ts','utf8');
const gas=readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const customerNameRule=(original,id)=>original?.state==='ready'&&
  original.detail?.submission_id===id&&
  typeof original.detail.customer?.name==='string'
  ?original.detail.customer.name.trim():null;
const reqA='jill:00000000-1111-4222-8333-444444444444';
const reqB='jill:00000000-1111-4222-8333-555555555555';
const d={state:'ready',detail:{submission_id:reqA,customer:{name:'  Synthetic Long Customer Name  '}}};
assert.equal(customerNameRule(d,reqA),'Synthetic Long Customer Name');
assert.equal(customerNameRule(d,reqB),null,'Never borrow another request name');
assert.equal(customerNameRule({state:'access_denied',detail:d.detail},reqA),null);
assert.equal(customerNameRule({state:'source_unavailable',detail:d.detail},reqA),null);
assert.equal(customerNameRule({state:'ready',detail:{...d.detail,customer:{name:null}}},reqA),null);
assert.equal(customerNameRule({state:'ready',detail:{...d.detail,customer:{name:'   '}}},reqA),'');
assert.match(route,/useEffect,useMemo,useRef,useState/);
assert.match(route,/const cardNode=useRef<HTMLElement\|null>\(null\)/);
assert.match(route,/const requestedId=useRef<string\|null>\(null\)/);
assert.match(route,/new IntersectionObserver\(/);
assert.match(route,/rootMargin:"120px 0px"/);
assert.match(route,/entry\.isIntersecting/);
assert.match(route,/requestedId\.current===item\.submission_id/);
assert.match(route,/requestedId\.current=item\.submission_id/);
assert.match(route,/orderDetails\.load\("\/app\/requests\/"\+encodeURIComponent\(item\.submission_id\)\)/);
assert.match(route,/original\?\.state==="ready"/);
assert.match(route,/original\.detail\?\.submission_id===item\.submission_id/);
assert.match(route,/typeof original\.detail\.customer\?\.name==="string"/);
assert.match(route,/<span className="jill-inbox__card-kicker">CUSTOM ORDER<\/span>\s*\{customerName\?<p className="jill-inbox__customer-name">\{customerName\}<\/p>:null\}\s*<h3>Request #/);
assert.match(style,/\.jill-inbox__customer-name\{/);
assert.match(style,/font-size:clamp\(12px,1\.2vw,14px\)/);
assert.match(style,/-webkit-line-clamp:2/);
assert.match(style,/overflow-wrap:anywhere/);
assert.doesNotMatch(style,/!important|@import|url\(/);
assert.match(ownerDetail,/loadAuthorizedWorkRequestDetail/);
assert.match(ownerDetail,/grant\.role!=="owner"/);
assert.match(ownerDetail,/readWorkGoogleQaMerchantDetail/);
assert.match(source,/loadWorkMerchantInbox/);
assert.match(reader,/projectWorkMerchantInbox/);
// Signed QA list remains nine non-PII fields, unchanged. The extra name is
// never imported into that signed 20-second list cache or D1 index.
const example={version:1,operation:'custom_order.merchant.list.result',
  ok:true,complete:true,shop:'jill-work.myshopify.com',records:[{
    submission_id:reqA,revision:1,customer_status:'received',
    internal_status:'new',submitted_at:'2026-10-18T12:00:00Z',
    updated_at:'2026-10-18T12:00:00Z',date_needed:'',
    fulfillment:'pickup',item_count:1,customer_name:'PRIVATE_SENTINEL',
    raw_payload:'UNVERIFIED_RAW'
  }]};
const projected=projectWorkMerchantInbox(example);
assert.equal(Object.keys(projected.records[0]).length,9);
assert.equal(JSON.stringify(projected).includes('PRIVATE_SENTINEL'),false);
assert.equal(JSON.stringify(projected).includes('UNVERIFIED_RAW'),false);
assert.match(gas,/'customer_status,date_needed,fulfillment,internal_status,item_count,revision,submission_id,submitted_at,updated_at'/);
assert.doesNotMatch(route,/localStorage|sessionStorage|document\.cookie|shopify_customer_id|customer\.email/);
console.log('PASS WORK HQ customer names: exact signed Owner detail only, visible-card lazy reads, no cross-request data, responsive clamped text, nine-field canonical inbox untouched. OFFLINE.');
