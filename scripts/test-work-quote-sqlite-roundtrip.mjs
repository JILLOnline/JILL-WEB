// JILL HQ WORK — real SQLITE (in-memory only) quote Save/Reload contract.
// This executes the EXACT source-only D1 SQL plans against disposable SQLite,
// never WORK D1, Shopify, Cloudflare, or actual customer/account information.
// Run: node --disable-warning=ExperimentalWarning scripts/test-work-quote-sqlite-roundtrip.mjs
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {planLocalWorkQuoteDraftSave,inspectLocalWorkQuoteDraftReceipt}
 from '../services/jill-order-desk/work-quote-draft-plan.mjs';
import {projectVerifiedWorkQuoteDraft}
 from '../services/jill-order-desk/work-quote-draft-read.mjs';
import {hydrateVerifiedWorkQuoteWorksheet}
 from '../services/jill-order-desk/work-quote-restore-model.mjs';
import {prepareWorkQuoteUiSavePayload}
 from '../services/jill-order-desk/work-quote-ui-payload.mjs';

const SHOP='jill-work.myshopify.com';
const SUBMISSION='jill:fixture:quote:abc12345';
const UNIT='jill:fixture:item:00000001';
const now=1792860012345;
const fees={materials:'12.00',labor:'8.00',shipping:'0.00',
 other:'0.00',discount:'2.00',tax:'1.50'};
const source={submission_id:SUBMISSION,revision:4,items:[
 {item_id:UNIT,title:'Synthetic custom item',quantity:2,
  customer_email:'NEVER_SHOW_PRIVATE_EMAIL'},
]};
const record={submission_id:SUBMISSION,revision:4,customer_status:'reviewing'};
const op=n=>'jill:hq:quote:00000000-0000-4000-8000-'+
 String(n).padStart(12,'0');
const db=new DatabaseSync(':memory:');
db.exec(`
 CREATE TABLE jill_work_quote_drafts(
  shop TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL,
  source_revision INTEGER NOT NULL,
  source_sha256 TEXT NOT NULL,
  quote_sha256 TEXT NOT NULL,
  quote_json TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  state TEXT NOT NULL,
  last_operation_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY(shop,submission_id)
 );
 CREATE TABLE jill_work_quote_draft_operations(
  shop TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL,
  quote_sha256 TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY(shop,operation_id)
 );
`);
const plan=(price,expectedRevision,operationId,detail=source,
 merchantRecord=record)=>planLocalWorkQuoteDraftSave({
 shop:SHOP,submissionId:SUBMISSION,detail,record:merchantRecord,
 lines:[{id:UNIT,quantity:2,unitPrice:price}],
 fees,expectedDraftRevision:expectedRevision,
 operationId,nowMs:now,
});
const receipt=q=>db.prepare(q.receipt_lookup.sql).get(...q.receipt_lookup.params);
const draftRow=()=>db.prepare('SELECT * FROM jill_work_quote_drafts WHERE shop=? AND submission_id=?')
 .get(SHOP,SUBMISSION);
const ops=()=>db.prepare('SELECT count(*) AS count FROM jill_work_quote_draft_operations')
 .get().count;
const apply=q=>{
 db.exec('BEGIN IMMEDIATE');
 try{
  const first=db.prepare(q.statements[0].sql)
   .all(...q.statements[0].params);
  const second=db.prepare(q.statements[1].sql)
   .run(...q.statements[1].params);
  db.exec('COMMIT');
  return {first,second};
 }catch(error){
  db.exec('ROLLBACK');
  throw error;
 }
};
try{
 // UI form -> strict quote plan -> actual SQLite transaction -> verified
 // D1 restore -> hydrated original worksheet, with cents unchanged.
 const intent=prepareWorkQuoteUiSavePayload({
  submissionId:SUBMISSION,detail:source,sourceRevision:4,
  customerStatus:'reviewing',prices:{[UNIT]:'45.25'},
  fees,draftRevision:0,operationId:op(1),
 });
 assert.equal(intent.state,'ready');
 assert.equal(intent.remote_d1_write_authorized,false);
 const first=plan('45.25',0,op(1));
 assert.equal(first.remote_d1_write_authorized,false);
 assert.equal(first.next_draft_revision,1);
 const write=apply(first);
 assert.equal(write.first.length,1);
 assert.equal(write.first[0].draft_revision,1);
 assert.equal(ops(),1);
 assert.equal(receipt(first).draft_revision,1);
 assert.equal(inspectLocalWorkQuoteDraftReceipt({
  plan:first,receipt:receipt(first),
 }).kind,'matching_synthetic_operation_receipt');
 const confirmed=projectVerifiedWorkQuoteDraft({
  row:draftRow(),detail:source,submissionId:SUBMISSION,
 });
 assert.equal(confirmed.estimated_total_cents,intent.estimatedTotalCents);
 assert.equal(confirmed.estimated_total_cents,11000);
 assert.equal(confirmed.customer_approved,false);
 assert.equal(confirmed.invoice_sent,false);
 assert.equal(confirmed.payment_confirmed,false);
 const ui=hydrateVerifiedWorkQuoteWorksheet({
  draft:confirmed,detail:source,submissionId:SUBMISSION,
 });
 assert.equal(ui.state,'verified_draft_restore');
 assert.equal(ui.prices[UNIT],'45.25');
 assert.equal(ui.draftRevision,1);
 assert.equal(ui.estimatedTotalCents,intent.estimatedTotalCents);
 assert.equal(JSON.stringify(ui).includes('NEVER_SHOW'),false);
 assert.equal(JSON.stringify(confirmed).includes('NEVER_SHOW'),false);

 // Duplicate/stale saves cannot create a second revision or operation.
 const firstReplay=apply(first);
 assert.equal(firstReplay.first.length,0);
 assert.equal(ops(),1);
 assert.equal(draftRow().draft_revision,1);
 assert.equal(inspectLocalWorkQuoteDraftReceipt({
  plan:first,receipt:receipt(first),
 }).kind,'matching_synthetic_operation_receipt');
 const stale=plan('46.00',0,op(2));
 assert.equal(apply(stale).first.length,0);
 assert.equal(ops(),1);
 assert.equal(receipt(stale),undefined);
 assert.equal(draftRow().draft_revision,1);

 // CAS update increments one revision and persists a new exact quote.
 const second=plan('50.00',1,op(3));
 const updated=apply(second);
 assert.equal(updated.first.length,1);
 assert.equal(draftRow().draft_revision,2);
 assert.equal(ops(),2);
 const revised=projectVerifiedWorkQuoteDraft({
  row:draftRow(),detail:source,submissionId:SUBMISSION,
 });
 assert.equal(revised.lines[0].unitPrice,'50.00');
 assert.equal(revised.draft_revision,2);
 assert.equal(revised.estimated_total_cents,11950);

 // Reused operation ID at a later expected draft revision must roll back
 // any would-be update because receipt uniqueness is never reusable.
 const reuse=plan('55.00',2,op(1));
 assert.throws(()=>apply(reuse),/UNIQUE constraint failed/);
 assert.equal(draftRow().draft_revision,2);
 assert.equal(ops(),2);
 // Repeating revision 1 CAS after revision 2 is also rejected.
 assert.equal(apply(second).first.length,0);
 assert.equal(draftRow().draft_revision,2);

 // Tampered draft hashes, foreign shop or outdated signed source must never
 // hydrate, even when the JSON fields are otherwise well-formed.
 const tampered={...draftRow(),quote_sha256:'a'.repeat(64)};
 assert.throws(()=>projectVerifiedWorkQuoteDraft({
  row:tampered,detail:source,submissionId:SUBMISSION,
 }),/unverified_quote_draft/);
 assert.throws(()=>projectVerifiedWorkQuoteDraft({
  row:{...draftRow(),shop:'other-shop.myshopify.com'},
  detail:source,submissionId:SUBMISSION,
 }),/unverified_quote_draft/);
 assert.throws(()=>projectVerifiedWorkQuoteDraft({
  row:draftRow(),detail:{...source,revision:5},
  submissionId:SUBMISSION,
 }),/stale_quote_draft_source/);
 assert.equal(hydrateVerifiedWorkQuoteWorksheet({
  draft:revised,detail:{...source,revision:5},
  submissionId:SUBMISSION,
 }),null);
 assert.equal(hydrateVerifiedWorkQuoteWorksheet({
  draft:revised,detail:{...source,submission_id:'foreign-request'},
  submissionId:SUBMISSION,
 }),null);
 assert.throws(()=>plan('55.00',2,op(4),
  {...source,revision:5},record),/jill_work_quote_draft_not_authorized/);

 console.log('PASS: In-memory SQL D1-equivalent quote Save/Reload: exact CAS, 2 revisions, idempotency, receipt uniqueness rollback, USD cents, verified hydration, stale source, tampering and foreign shop denials. Zero real provider calls.');
}finally{db.close();}
