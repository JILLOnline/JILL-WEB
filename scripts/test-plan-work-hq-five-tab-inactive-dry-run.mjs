import assert from 'node:assert/strict';
import {planWorkFiveTabLocalDryRun}
 from './plan-work-hq-five-tab-inactive-dry-run.mjs';
const ids={active:'cd233caa-0128-4b22-bf68-002caf2ecf65',
 quote:'dbc6341f-de7f-41de-8e97-6bf971201eeb',
 deployment:'0f2704bb-f8e6-4f61-a55f-947065ef8546'};
const plain=(name,text)=>({name,type:'plain_text',text});
const flags={
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
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
const allocation={deployment:ids.deployment,
 versions:[{id:ids.active,percentage:100},{id:ids.quote,percentage:0}]};
const active={id:ids.active,resources:{bindings,
 script:{handlers:['fetch']}}};
const quote={id:ids.quote,resources:{
 bindings:bindings.filter(v=>!['JILL_WORK_CATALOG_ENABLED',
  'JILL_WORK_CONVERSATION_ENABLED','CF_VERSION_METADATA'].includes(v.name))
 .map(v=>v.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?
  plain(v.name,'true'):v),
 script:{handlers:['fetch']}}};
const compiled={
 name:'jill-order-desk-canary-work',workers_dev:true,
 compatibility_date:'2026-10-14',
 compatibility_flags:['nodejs_compat'],main:'index.js',
 assets:{directory:'../client'},
 d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
  database_name:'jill-order-desk-work',
  database_id:'3f17c186-c794-4e00-8f20-017191373a19'}],
 vars:{JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'false'}
};
const options={allocation,active,quote,compiled};
const plan=planWorkFiveTabLocalDryRun(options);
assert.equal(plan.state,'LOCAL_DRY_RUN_MANIFEST_PREPARED',plan.reason);
assert.equal(plan.baseline_active,ids.active);
assert.equal(plan.baseline_deployment,ids.deployment);
assert.equal(plan.quote_canary,ids.quote);
assert.equal(plan.upload_authorized,false);
assert.equal(plan.deploy_authorized,false);
assert.equal(plan.manifest.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(plan.manifest.vars.JILL_WORK_CONVERSATION_ENABLED,'false');
assert.equal(plan.manifest.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,'false');
assert.equal(plan.manifest.keep_vars,true);
assert.equal(plan.manifest.d1_databases.length,1);
assert.equal(Object.hasOwn(plan.manifest,'r2_buckets'),false);
function deny(change,reason){
 const v=structuredClone(options);change(v);
 const result=planWorkFiveTabLocalDryRun(v);
 assert.equal(result.state,'held');
 assert.equal(result.reason,reason);
 assert.equal(result.upload_authorized,false);
 assert.equal(result.deploy_authorized,false);
}
deny(v=>v.allocation.deployment='stale','live_allocation_changed');
deny(v=>v.allocation.versions[0].percentage=50,'live_allocation_changed');
deny(v=>v.active.id=ids.quote,'version_source_unverified');
deny(v=>v.active.resources.bindings[6].text='true',
 'required_live_stage_flag_changed');
deny(v=>v.active.resources.bindings[7].text='true',
 'required_live_stage_flag_changed');
deny(v=>v.active.resources.bindings[8].type='plain_text',
 'live_secret_presence_unverified');
deny(v=>v.active.resources.bindings[12].id='foreign',
 'existing_d1_changed');
deny(v=>v.active.resources.bindings.push({
 name:'NEW_R2',type:'r2_bucket'}),'unreviewed_active_resource_type');
deny(v=>v.compiled.r2_buckets=[{binding:'R2',bucket_name:'paid'}],
 'unapproved_compiled_resource');
deny(v=>v.compiled.d1_databases.push({binding:'EXTRA',database_id:'x'}),
 'correct_canary_compiled_manifest_required');
deny(v=>v.quote.resources.bindings[6].text='false',
 'quote_canary_identity_changed');
console.log('PASS five-tab successor manifest: active WORK baseline, 100/0 quote, 14 bindings, four secrets, exact D1, no R2/additional paid resources or enabled quote/conversation; OFFLINE.');
