import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectWorkMerchantInbox} from '../services/jill-order-desk/merchant-inbox-read.mjs';

const base='services/jill-order-desk/app-home/app/';
const route=readFileSync(base+'routes/app.requests.$submissionId.tsx','utf8');
const inbox=readFileSync(base+'routes/app.requests.tsx','utf8');
const routes=readFileSync(base+'routes.ts','utf8');
const styles=readFileSync(base+'styles/request-detail.css','utf8');
const ownerReader=readFileSync('services/jill-order-desk/merchant-inbox-read.mjs','utf8');

assert.match(routes,/route\("requests\/:submissionId","routes\/app\.requests\.\$submissionId\.tsx"\)/);
assert.match(inbox,/encodeURIComponent\(item\.submission_id\)/);
assert.match(inbox,/Open request workspace/);
assert.match(route,/loader as inboxLoader/);
assert.match(route,/await inboxLoader\(args\)/);
assert.match(route,/item\.submission_id===args\.params\.submissionId/);
assert.match(route,/state:"not_found",record:null,readOnly:true/);
assert.match(route,/status:404,headers/);
assert.match(route,/return Response\.json\(\{/);
assert.match(route,/headers\.set\("cache-control","private, no-store, max-age=0"\)/);
assert.match(route,/headers\.set\("x-content-type-options","nosniff"\)/);
assert.match(route,/data\.readOnly!==true/);
assert.match(route,/inbox\.status!==200/);
assert.match(route,/state:"ready",record:selected,readOnly:true/);
assert.match(route,/Latest verified snapshot — not a complete status history/);
assert.match(route,/Full item customization, customer contact, attachments,/);
assert.match(route,/Quote, production and fulfillment edits are not enabled/);
assert.match(route,/Source revision/);
assert.match(route,/Last recorded update/);
assert.match(route,/Back to|Custom Orders inbox/);
assert.match(styles,/@media\(max-width:750px\)/);
assert.match(styles,/:focus-visible/);
assert.match(styles,/\.jill-request__grid/);
assert.doesNotMatch(styles,/!important|@import|url\(/i);
assert.doesNotMatch(route,/custom-order-account-read|JILL_SHEET_ID|SHOPIFY_ACCESS_TOKEN|JILL_CUSTOM_ORDER_GATEWAY_SECRET|shopify_customer_id|useFetcher|useSubmit|fetch\(|<form|<button|action\s*\(/i);
assert.doesNotMatch(route,/reader\.read|readWorkGoogleQaMerchantList|workShopify\(/);
// The canonical projected record (not raw Google payload) determines the
// exact owner-only detail fields; all extra personal fields are dropped.
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
const selected=model.records.find(r=>r.submission_id===id);
assert.equal(selected?.submission_id,id);
assert.equal(model.records.find(r=>r.submission_id==='jill:does-not-exist'),undefined);
const encoded=encodeURIComponent(id);
assert.equal(decodeURIComponent(encoded),id);
const json=JSON.stringify(selected);
for(const blocked of ['SECRET_PERSON','PRIVATE CUSTOMER','PRIVATE PRODUCT','PRIVATE_123'])
  assert.ok(!json.includes(blocked),'Unapproved source field in merchant detail');
assert.equal(Object.keys(selected).length,9);
assert.match(ownerReader,/readWorkMerchantPermission/);
assert.match(ownerReader,/access\.role!=='owner'/);
assert.match(ownerReader,/return result\(200,projectWorkMerchantInbox\(source\)\)/);
console.log('PASS WORK request workspace: reuse Owner-only canonical feed, exact ID route, 404/no-store, 9 whitelisted fields, no writes and no invented history.');
