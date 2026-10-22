// M2 saved quote certification: canonical D1 planner -> stored row ->
// independently verified reader -> worksheet restoration. No I/O.
import assert from 'node:assert/strict';
import {planLocalWorkQuoteDraftSave,inspectLocalWorkQuoteDraftReceipt}
  from '../services/jill-order-desk/work-quote-draft-plan.mjs';
import {projectVerifiedWorkQuoteDraft,handleWorkQuoteDraftRead}
  from '../services/jill-order-desk/work-quote-draft-read.mjs';
import {handleWorkQuoteDraftSave}
  from '../services/jill-order-desk/work-quote-save-boundary.mjs';
import {hydrateVerifiedWorkQuoteWorksheet}
  from '../services/jill-order-desk/work-quote-restore-model.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:22222222-3333-4444-8555-666666666666';
const OP='jill:hq:quote:11111111-2222-4333-8444-555555555555';
const nowMs=Date.parse('2026-10-21T16:00:00Z');
const items=[
  {item_id:'custom-item-001',quantity:2,title:'Tote kit',
    reference_ids:['private-media-reference'],customer_email:'NOLEAK@example.invalid'},
  {item_id:'custom-item-002',quantity:1,title:'Notepad'},
];
const detail={submission_id:ID,revision:3,items};
const record={submission_id:ID,revision:3,customer_status:'reviewing'};
const lines=[{id:'custom-item-001',quantity:2,unitPrice:'25.50'},
  {id:'custom-item-002',quantity:1,unitPrice:'12.00'}];
const fees={materials:'5.00',labor:'2.00',shipping:'4.00',
  other:'0.00',discount:'3.00',tax:'2.50'};
const make=()=>planLocalWorkQuoteDraftSave({
  shop:SHOP,submissionId:ID,detail,record,lines,fees,
  expectedDraftRevision:0,operationId:OP,nowMs,
});
const plan=make();
assert.equal(plan.kind,'synthetic_work_quote_draft_d1_batch_plan');
assert.equal(plan.quoted_total_cents,7350);
assert.equal(plan.remote_d1_write_authorized,false);
assert.equal(plan.statements.length,2);
const p=plan.statements[0].params;
const row={
 shop:p[0],submission_id:p[1],draft_revision:p[2],
 source_revision:p[3],source_sha256:p[4],quote_sha256:p[5],
 quote_json:p[6],total_cents:p[7],currency:p[8],state:p[9],
 last_operation_id:p[10],created_at_ms:p[11],updated_at_ms:p[12],
};
const receipt={submission_id:ID,draft_revision:1,quote_sha256:plan.quote_sha256};
assert.equal(inspectLocalWorkQuoteDraftReceipt({plan,receipt}).kind,
  'matching_synthetic_operation_receipt');
const verified=projectVerifiedWorkQuoteDraft({row,detail,submissionId:ID});
assert.equal(verified.state,'ready');
assert.equal(verified.estimated_total_cents,7350);
assert.equal(verified.draft_revision,1);
assert.equal(verified.customer_approved,false);
assert.equal(verified.invoice_sent,false);
const restored=hydrateVerifiedWorkQuoteWorksheet({
 draft:verified,detail,submissionId:ID,
});
assert.equal(restored.state,'verified_draft_restore');
assert.equal(restored.draftRevision,1);
assert.equal(restored.prices['custom-item-001'],'25.50');
assert.equal(restored.estimatedTotalCents,7350);
for(const secret of ['NOLEAK@example.invalid','private-media-reference','customer_email']){
 assert.equal(JSON.stringify(plan).includes(secret),false);
 assert.equal(JSON.stringify(verified).includes(secret),false);
 assert.equal(JSON.stringify(restored).includes(secret),false);
}
const rejects=(rowDelta,detailDelta=detail,id=ID)=>{
 assert.throws(()=>projectVerifiedWorkQuoteDraft({
 row:{...row,...rowDelta},detail:detailDelta,submissionId:id,
 }));
};
rejects({quote_sha256:'0'.repeat(64)});
rejects({source_sha256:'1'.repeat(64)});
rejects({total_cents:7351});
rejects({currency:'CAD'});
rejects({state:'approved'});
rejects({submission_id:'jill:other-request-0001'});
rejects({source_revision:4});
rejects({}, {...detail,revision:4});
rejects({}, {...detail,items:[{...items[0],quantity:3},items[1]]});
rejects({quote_json:row.quote_json.replace('2550','2551')});
assert.equal(hydrateVerifiedWorkQuoteWorksheet({draft:verified,
  detail:{...detail,revision:4},submissionId:ID}),null);
assert.equal(hydrateVerifiedWorkQuoteWorksheet({draft:verified,
  detail,submissionId:'jill:foreign-request-001'}),null);
const foreignReceipt={...receipt,quote_sha256:'a'.repeat(64)};
assert.equal(inspectLocalWorkQuoteDraftReceipt({plan,receipt:foreignReceipt}).kind,
  'operation_receipt_conflict');
assert.equal(inspectLocalWorkQuoteDraftReceipt({plan,receipt:null}).kind,
  'no_matching_operation_receipt');
let touches=0;
const forbidden={admin(){touches++;throw Error('AUTH READ CALLED')}};
const db={prepare(){touches++;throw Error('DATABASE CALLED')},
  batch(){touches++;throw Error('D1 BATCH CALLED')}};
const endpoint='https://jill-work.example/app/requests/quote-draft?submission_id='+
 encodeURIComponent(ID);
const read=await handleWorkQuoteDraftRead({request:new Request(endpoint),
 enabled:false,authenticate:forbidden,db,
 readFreshList(){touches++;throw Error('SOURCE CALLED')},
 readExactDetail(){touches++;throw Error('DETAIL CALLED')}});
assert.equal(read.status,503);
assert.equal((await read.json()).code,'quote_drafts_not_enabled');
const save=await handleWorkQuoteDraftSave({request:new Request(endpoint,{
  method:'POST',body:'{}',headers:{'content-type':'application/json',
    origin:'https://jill-work.example'}}),
 enabled:false,authenticate:forbidden,db});
assert.equal(save.status,503);
assert.equal((await save.json()).code,'quote_drafts_not_enabled');
assert.equal(touches,0);
console.log('PASS M2 real quote draft-plan -> hash/read -> restore; 14+ tamper/stale, no private data, OFF endpoints');
