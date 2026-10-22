import assert from 'node:assert/strict';
import {CONNECTED_CONTENT_BASELINE,evaluateConnectedContentInventory}
 from './inspect-work-hq-connected-content-owner.mjs';
const b=CONNECTED_CONTENT_BASELINE;
const plain=(name,text)=>({name,type:'plain_text',text});
const required={
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'};
const bindings=[
 ...Object.entries(required).map(([k,v])=>plain(k,v)),
 ...['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET']
 .map(name=>({name,type:'secret_text'})),
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:b.d1},
 {name:'CF_VERSION_METADATA',type:'version_metadata'}];
const before={deployment:b.deployment,
 versions:[{id:b.active,percentage:100},{id:b.quote,percentage:0}]};
const active={id:b.active,resources:{bindings,script:{handlers:['fetch']}}};
const quote={id:b.quote,resources:{bindings:[
 plain('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','true')],
 script:{handlers:['fetch']}}};
const health={status:200,runtime_version:b.active,database_ready:true};
const create=()=>({before:structuredClone(before),after:structuredClone(before),
 active:structuredClone(active),quote:structuredClone(quote),
 health:structuredClone(health)});
assert.equal(evaluateConnectedContentInventory(create()).status,
 'READ_ONLY_CONNECTED_CONTENT_BASELINE_VERIFIED');
function hold(change,reason){
 const x=create();change(x);
 const result=evaluateConnectedContentInventory(x);
 assert.equal(result.status,'HOLD');
 assert.equal(result.reason,reason);
 assert.equal(result.upload_requested,false);
 assert.equal(result.deployment_requested,false);
 assert.equal(result.activation_authorized,false);
}
hold(x=>x.before.deployment='other','unstable_deployment_reads');
hold(x=>{x.before.deployment='other';x.after.deployment='other';},
 'not_exact_activated_m1m2_baseline');
hold(x=>x.after.versions[0].percentage=50,'unstable_deployment_reads');
hold(x=>x.active.id=b.quote,'version_metadata_unverified');
hold(x=>x.active.resources.bindings.push(plain('R2_STORAGE','enabled')),
 'unexpected_active_binding_set');
hold(x=>x.active.resources.bindings[0].text='work',
 'required_work_flag_changed');
hold(x=>x.active.resources.bindings[6].text='true',
 'required_work_flag_changed');
hold(x=>x.active.resources.bindings[8].type='plain_text',
 'secret_presence_unverified');
hold(x=>x.active.resources.bindings[12].id='foreign',
 'existing_work_d1_changed');
hold(x=>x.active.resources.bindings[13].type='secret_text',
 'version_identity_not_bound');
hold(x=>x.active.resources.script.handlers=['scheduled'],
 'worker_handler_changed');
hold(x=>x.quote.resources.bindings[0].text='false',
 'historical_quote_canary_changed');
hold(x=>x.health.runtime_version=b.quote,'canonical_work_health_failed');
console.log('PASS successor 5-tab WORK-only read-only release baseline: active 100/quote 0, 14 immutable bindings, D1, 4 secrets, disabled sensitive flags and exact health; fail closed; NO provider mutations.');
