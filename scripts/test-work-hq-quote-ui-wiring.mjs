// OFFLINE WORK custom quote UI: source-bound Save Draft envelope,
// disabled-by-default page, no actual HTTP/Shopify/Cloudflare calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareWorkQuoteUiSavePayload as prepare,
  workQuoteDraftReadPath as readPath}
  from '../services/jill-order-desk/work-quote-ui-payload.mjs';
const ID='jill:22222222-3333-4444-8555-666666666666';
const OP='jill:hq:quote:11111111-2222-4333-8444-555555555555';
const detail={submission_id:ID,revision:3,items:[
  {item_id:'synthetic-a-1',quantity:2,title:'Synthetic only',
    references:['sensitive synthetic art']},
  {item_id:'synthetic-b-2',quantity:3,title:'Synthetic only',
    email:'never-send@example.invalid'},
]};
const prices={'synthetic-a-1':'25.99','synthetic-b-2':'0.01'};
const fees={materials:'5',labor:'20',shipping:'12',other:'3',
  discount:'10',tax:'4.56'};
const args={submissionId:ID,detail,sourceRevision:3,
  customerStatus:'reviewing',prices,fees,draftRevision:0,
  operationId:OP};
let checks=0;
const must=(value)=>{assert.ok(value);checks++;};
const good=prepare(args);
assert.equal(good.state,'ready');
assert.equal(good.estimatedTotalCents,8657);
assert.equal(good.payload.submission_id,ID);
assert.equal(good.payload.source_revision,3);
assert.equal(good.payload.expected_draft_revision,0);
assert.equal(good.payload.operation_id,OP);
assert.deepEqual(Object.keys(good.payload).sort(),[
  'expected_draft_revision','fees','lines',
  'operation_id','source_revision','submission_id',
]);
assert.deepEqual(good.payload.lines,[
  {id:'synthetic-a-1',quantity:2,unitPrice:'25.99'},
  {id:'synthetic-b-2',quantity:3,unitPrice:'0.01'},
]);
assert.ok(Object.isFrozen(good.payload));
assert.ok(Object.isFrozen(good.payload.lines));
assert.equal(good.remote_d1_write_authorized,false);
assert.equal(good.shopify_invoice_authorized,false);
const serialized=JSON.stringify(good);
for(const forbidden of ['Synthetic only','sensitive synthetic art',
  '@example.invalid','references','customer','raw_payload',
  'session','shopify_token','image_url'])
  assert.equal(serialized.includes(forbidden),false,forbidden);
checks+=21;
assert.equal(readPath(ID),'/app/requests/quote-draft?submission_id='+
  encodeURIComponent(ID));checks++;
assert.throws(()=>readPath('../x'),/invalid_quote_request_id/);checks++;
assert.throws(()=>readPath('jillonlinestore.com/other'),/invalid_quote_request_id/);checks++;
const deny=(input,code)=>{
  const r=prepare(input);
  assert.equal(r.state,'blocked');
  assert.equal(r.code,code);
  checks++;
};
deny({...args,submissionId:'wrong/id'},'verified_source_unavailable');
deny({...args,detail:{...detail,submission_id:'jill:different-111'}},
  'verified_source_unavailable');
deny({...args,sourceRevision:2},'verified_source_unavailable');
deny({...args,sourceRevision:101},'verified_source_unavailable');
deny({...args,customerStatus:'cancelled'},'verified_source_unavailable');
deny({...args,customerStatus:'completed'},'verified_source_unavailable');
deny({...args,draftRevision:-1},'verified_source_unavailable');
deny({...args,draftRevision:100},'verified_source_unavailable');
deny({...args,operationId:'another-op'},'verified_source_unavailable');
deny({...args,fees:{...fees,tip:'10'}},'verified_source_unavailable');
deny({...args,prices:{...prices,'unknown-item':'10.00'}},
  'unverified_price_item');
deny({...args,prices:{'synthetic-a-1':'25.99'}},
  'invalid_verified_items');
deny({...args,prices:{...prices,'synthetic-b-2':''}},
  'enter_every_item_price');
deny({...args,prices:{...prices,'synthetic-b-2':'1e3'}},
  'invalid_money');
deny({...args,detail:{...detail,items:[
  {...detail.items[0],quantity:0},detail.items[1],
]}},'invalid_verified_items');
deny({...args,detail:{...detail,items:[
  detail.items[0],{...detail.items[1],item_id:'synthetic-a-1'},
]}},'invalid_verified_items');
deny({...args,fees:{...fees,discount:'99999.99'}},
  'discount_exceeds_charges');
const versioned=prepare({...args,draftRevision:4,
  customerStatus:'on_hold'});
assert.equal(versioned.state,'ready');
assert.equal(versioned.payload.expected_draft_revision,4);
checks+=2;
const root='services/jill-order-desk/app-home/app/';
const route=readFileSync(root+'routes/app.requests.$submissionId.tsx','utf8');
const ui=readFileSync(root+'components/WorkQuoteWorksheet.tsx','utf8');
const worker=readFileSync('services/jill-order-desk/app-home/workers/app.ts','utf8');
const endpoint=readFileSync(root+'routes/app.requests.quote-draft.tsx','utf8');
must(route.includes('saveDraftEnabled={original?.quoteDraftEnabled===true &&'));
must(route.includes('sourceRevision={record.revision}'));
must(ui.includes('saveDraftEnabled=false'));
must(ui.includes('disabled={!canUseDraft||!ready}'));
must(ui.includes('disabled={!canUseDraft}'));
must(ui.includes('if(!canUseDraft||!readyQuote)return;'));
must(ui.includes('if(!canUseDraft)return;'));
must(ui.includes('crypto.randomUUID()'));
must(ui.includes('setBlocked(true)'));
must(ui.includes('onReloadDraft'));
must(ui.includes('Save Draft'));
must(ui.includes('Reload saved draft'));
must(ui.includes('are not activated in WORK yet'));
must(ui.includes('readFetcher.load(workQuoteDraftReadPath(submissionId))'));
must(worker.includes('if(url.pathname==="/app/requests/quote-draft")'));
must(worker.includes('quote_drafts_not_enabled'));
must(worker.includes('if(!workQuoteDraftFeatureReady(env))'));
must(worker.includes('workQuoteDraftSchemaReady(env.JILL_ORDER_DESK_WORK_DB)'));
must(endpoint.includes('request,enabled:workQuoteDraftFeatureReady(env)'));
must(endpoint.split('request,enabled:workQuoteDraftFeatureReady(env)').length===3);
must(!/localStorage|sessionStorage|indexedDB|navigator\.sendBeacon/.test(ui));
must(!/fetch\(|XMLHttpRequest/.test(ui));
console.log('PASS WORK Quote Save/Reload UI offline: '+checks+
  ' source-revision/payload/nonce/WORK capability-OFF-by-default/no-customer-PII guards.');
console.log('HOLD: Owner installed two empty WORK D1 tables; no quote saved, Worker deployment, customer approval/payment or LIVE/KEEP changes.');
