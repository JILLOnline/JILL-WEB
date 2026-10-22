import assert from 'node:assert/strict';
import {UPLOADED,verifyUploadedFiveTabReceipt,
 evaluateUploadedFiveTabProof} from './inspect-work-hq-five-tab-uploaded-owner.mjs';
import {BASELINE} from './stage-work-hq-five-tab-owner.mjs';
const plain=(name,text)=>({name,type:'plain_text',text});
const flags={
 JILL_WORK_HOST_STAGE:'canary',JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'};
const bindings=[
 ...Object.entries(flags).map(([k,v])=>plain(k,v)),
 ...['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET']
 .map(name=>({name,type:'secret_text'})),
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
  id:'3f17c186-c794-4e00-8f20-017191373a19'},
 {name:'CF_VERSION_METADATA',type:'version_metadata'}];
const before={deployment:BASELINE.deployment,versions:[
 {id:BASELINE.active,percentage:100},{id:BASELINE.quote,percentage:0}]};
const sourceNonce='1c3e558b-cd99-46cc-8ca1-c778e49c5080';
const receipt={operation:'HQ_FIVE_TAB_WORK_INACTIVE_UPLOAD',
 source:UPLOADED.source,package_sha256:UPLOADED.package,
 retry_allowed:false,nonce:sourceNonce,baseline:before};
const active={id:BASELINE.active,resources:{
 bindings,script:{etag:'prior',handlers:['fetch']},
 script_runtime:{compatibility_date:'2026-10-14',assets:{
  html_handling:'auto-trailing-slash',not_found_handling:'none'}}}};
const quote={id:BASELINE.quote,resources:{
 bindings:bindings.filter(x=>!['JILL_WORK_CATALOG_ENABLED',
 'JILL_WORK_CONVERSATION_ENABLED','CF_VERSION_METADATA'].includes(x.name))
 .map(x=>x.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?
  plain(x.name,'true'):x),
 script:{etag:'quote',handlers:['fetch']},
 script_runtime:structuredClone(active.resources.script_runtime)}};
const candidate={id:UPLOADED.candidate,
 annotations:{'workers/message':verifyUploadedFiveTabReceipt(receipt)},
 resources:{bindings:structuredClone(bindings),
 script:{etag:'new',handlers:['fetch']},
 script_runtime:structuredClone(active.resources.script_runtime)}};
const compiled={
 name:'jill-order-desk-canary-work',workers_dev:true,
 compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
 main:'index.js',assets:{directory:'../client'},
 d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
  database_name:'jill-order-desk-work',
  database_id:'3f17c186-c794-4e00-8f20-017191373a19'}],
 vars:{JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'false'}};
const health={status:200,runtime_version:BASELINE.active,database_ready:true};
function snapshot(){return {
 before:structuredClone(before),after:structuredClone(before),
 active:structuredClone(active),quote:structuredClone(quote),
 candidate:structuredClone(candidate),health:structuredClone(health),
 receipt:structuredClone(receipt),compiled:structuredClone(compiled),
 digest:UPLOADED.package};}
const ok=evaluateUploadedFiveTabProof(snapshot());
assert.equal(ok.status,'FIVE_TAB_INACTIVE_WORK_CANDIDATE_VERIFIED');
assert.equal(ok.candidate_id,UPLOADED.candidate);
assert.equal(ok.deployment_requested,false);
assert.equal(ok.upload_receipt_spent,true);
const failures=[
 x=>x.receipt.source='other',
 x=>x.receipt.package_sha256='other',
 x=>x.receipt.retry_allowed=true,
 x=>x.receipt.baseline.deployment='other',
 x=>x.after.deployment='other',
 x=>x.before.versions[0].percentage=0,
 x=>x.health.runtime_version=BASELINE.quote,
 x=>x.active.resources.bindings[6].text='true',
 x=>x.candidate.resources.bindings[6].text='true',
 x=>x.candidate.resources.script.etag='prior',
 x=>x.candidate.id=BASELINE.active,
 x=>x.candidate.annotations['workers/message']='wrong',
 x=>x.digest='wrong',
 x=>x.compiled.r2_buckets=[{binding:'NEW',bucket_name:'unapproved'}],
];
for(const change of failures){
 const x=snapshot();change(x);
 assert.throws(()=>evaluateUploadedFiveTabProof(x));
}
console.log('PASS read-only exact uploaded five-tab receipt, source, package, candidate direct-version identity, 100/0 WORK allocation, D1 and binding parity; no provider calls.');
