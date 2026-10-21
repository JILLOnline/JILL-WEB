import assert from 'node:assert/strict';
import {BASELINE,assertBaseline,selectStageCandidate,assertCandidate,
 explainWorkM1M2Plan}
 from './stage-work-hq-m1-m2-owner.mjs';
const plain=(name,text)=>({name,type:'plain_text',text});
const bindings=[
 plain('JILL_WORK_HOST_STAGE','canary'),
 plain('JILL_WORK_CONVERSATION_ENABLED','false'),
 plain('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false'),
 {name:'SHOPIFY_API_SECRET',type:'secret_text'},
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:'3f17c186-c794-4e00-8f20-017191373a19'},
 {name:'CF_VERSION_METADATA',type:'version_metadata'},
];
const baseline={deployment:BASELINE.deployment,
 versions:[{id:BASELINE.active,percentage:100},{id:BASELINE.quote,percentage:0}]};
const marker='JILL HQ WORK M1+M2 source-locked INACTIVE TEST';
const asset={html_handling:'auto-trailing-slash',
 not_found_handling:'none'};
const runtime={compatibility_date:'2026-10-14',assets:asset};
const active={id:BASELINE.active,resources:{bindings,
 script:{etag:'old',handlers:['fetch']},script_runtime:runtime}};
const quote={...active,id:BASELINE.quote};
const candidate={id:'11111111-2222-4333-8444-555555555555',
 annotations:{'workers/message':marker},
 resources:{bindings:structuredClone(bindings),script:{
  etag:'new',handlers:['fetch']},script_runtime:structuredClone(runtime)}};
const planned={state:'LOCAL_DRY_RUN_MANIFEST_PREPARED',
 upload_authorized:false,deploy_authorized:false,
 manifest:{name:'jill-order-desk-canary-work',
 vars:{JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_CONVERSATION_ENABLED:'false',
  JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'}}};
assert.equal(assertBaseline(baseline),true);
assert.equal(assertCandidate({active,quote,candidate,marker,planned,baseline})
 .candidate_id,candidate.id);
const deny=(mutate,reason)=>{
 const c={active:structuredClone(active),quote:structuredClone(quote),
 candidate:structuredClone(candidate),marker,planned:structuredClone(planned),
 baseline:structuredClone(baseline)};
 mutate(c);
 assert.throws(()=>assertCandidate(c),new RegExp(reason));
};
deny(x=>x.candidate.resources.bindings[1].text='true','candidate_binding_changed');
deny(x=>x.candidate.resources.bindings.push(plain('R2_NEW','x')),
 'candidate_binding_count_changed');
deny(x=>x.candidate.resources.script.etag='old',
 'candidate_code_or_handlers_unverified');
deny(x=>x.candidate.resources.script_runtime.compatibility_date='2027-01-01',
 'candidate_runtime_changed');
deny(x=>x.candidate.resources.script_runtime.assets.run_worker_first=true,
 'candidate_asset_route_changed');
deny(x=>x.candidate.annotations['workers/message']='wrong',
 'candidate_identity_unverified');
deny(x=>x.planned.deploy_authorized=true,'stage_policy_missing');
deny(x=>x.baseline.versions[0].percentage=50,'allocation_changed');
assert.equal(selectStageCandidate({versions:[{id:candidate.id,
 annotations:{'workers/message':marker}}]},marker),candidate.id);
assert.equal(selectStageCandidate({versions:[]},marker),null);
assert.throws(()=>selectStageCandidate({versions:[candidate,candidate]},marker),
 /ambiguous_candidate_identity/);
assert.throws(()=>selectStageCandidate(null,marker),/versions_list_unavailable/);
console.log('PASS M1/M2 one-use Owner stage: exact WORK baseline, candidate identity, immutable bindings, runtime and fail-closed denials. NO provider call.');

const safeReason=explainWorkM1M2Plan({
 baseline,active,quote,compiled:{
  name:'jill-order-desk-canary-work'},});
assert.equal(safeReason.status,'HOLD');
assert.equal(safeReason.reason,'ambiguous_live_bindings');
assert.equal(safeReason.upload_requested,false);
assert.equal(safeReason.shape.active_handlers_array,true);
assert.equal(safeReason.shape.quote_handlers_array,true);
const missingHandlers=explainWorkM1M2Plan({baseline,active,quote:{
 ...quote,resources:{...quote.resources,script:{}}}});
assert.equal(missingHandlers.reason,'version_source_unverified');
assert.equal(missingHandlers.shape.quote_handlers_array,false);
assert.equal(Object.hasOwn(missingHandlers,'bindings'),false);
console.log('PASS safe M1/M2 read-only manifest diagnostics; never disclose provider bindings.');
