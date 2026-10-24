import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {current100Version,verifyRuntimeSource,
 verifyWorkActiveBindings,inspectActiveContactRuntime}
 from './inspect-work-contact-runtime-readonly.mjs';
const hq=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gateway=readFileSync(
 'services/custom-order-cloudflare/wrangler.toml','utf8');
assert.deepEqual(verifyRuntimeSource(hq,gateway),{
 hq:'correct_WORK_canary_source',gateway:'isolated_WORK_gateway_source',
});
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const d='33333333-3333-4333-8333-333333333333';
const deployed={
 deployments:[{id:d,created_on:'2026-10-23T18:00:00Z',versions:[
  {version_id:a,percentage:100},{version_id:b,percentage:0},
 ]}],
};
assert.equal(current100Version(deployed).active,a);
assert.throws(()=>current100Version({deployments:[
 {...deployed.deployments[0],versions:[
  {version_id:a,percentage:50},{version_id:b,percentage:50},
 ]},
]}),/work_contact_runtime_deployment_split_or_invalid/);
assert.throws(()=>current100Version({deployments:[
 deployed.deployments[0],deployed.deployments[0],
]}),/work_contact_runtime_deployment_ambiguous/);
assert.throws(()=>current100Version({deployments:[
 {...deployed.deployments[0],versions:[
  {version_id:a,percentage:100},{version_id:a,percentage:0},
 ]},
]}),/work_contact_runtime_deployment_split_or_invalid/);
const bind=(name,type,other={})=>({name,type,...other});
const hqView={id:a,resources:{bindings:[
 bind('JILL_ORDER_DESK_WORK_DB','d1',{
  id:'3f17c186-c794-4e00-8f20-017191373a19'}),
 bind('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
 bind('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
 bind('SHOPIFY_API_SECRET','secret_text'),
 bind('JILL_WORK_CONTACT_MESSAGES_ENABLED','plain_text',{text:'false'}),
]}};
const gwView={id:a,resources:{bindings:[
 bind('RATE_LIMITER','durable_object_namespace'),
 bind('SHOPIFY_WORK_APP_SECRET','secret_text'),
 bind('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
 bind('JILL_WORK_CONTACT_CLAIM_ENABLED','plain_text',{text:'false'}),
]}};
const current=current100Version(deployed);
assert.equal(verifyWorkActiveBindings('hq',current,hqView).contact_flags_enabled,false);
assert.equal(verifyWorkActiveBindings('gateway',current,gwView).contact_flags_enabled,false);
assert.throws(()=>verifyWorkActiveBindings('hq',current,{
 ...hqView,resources:{bindings:[...hqView.resources.bindings,
  bind('JILL_WORK_CONTACT_INBOX_ENABLED','plain_text',{text:'true'})]},
}),/work_contact_runtime_contact_feature_enabled_or_unverified/);
assert.throws(()=>verifyWorkActiveBindings('hq',current,{
 ...hqView,resources:{bindings:[...hqView.resources.bindings,
  bind('JILL_WORK_CONTACT_MESSAGES_ENABLED','plain_text',{text:'false'})]},
}),/work_contact_runtime_binding_metadata_invalid/);
assert.throws(()=>verifyWorkActiveBindings('gateway',current,{
 ...gwView,resources:{bindings:[...gwView.resources.bindings,
  bind('JILL_ORDER_DESK_WORK_DB','d1',{id:
   '3f17c186-c794-4e00-8f20-017191373a19'})]},
}),/work_contact_runtime_public_gateway_has_private_d1/);
assert.throws(()=>verifyWorkActiveBindings('hq',current,{
 ...hqView,resources:{bindings:hqView.resources.bindings.filter(x=>
  x.name!=='JILL_ORDER_DESK_WORK_DB')},
}),/work_contact_runtime_active_hq_work_d1_binding_unverified/);
assert.throws(()=>verifyWorkActiveBindings('hq',current,{
 ...hqView,id:b,
}),/work_contact_runtime_active_version_unverified/);
const calls=[];
const result=await inspectActiveContactRuntime({
 readMetadata:async(which,mode,id)=>{
  calls.push({which,mode,id});
  if(mode==='deployments')return deployed;
  return which==='hq'?hqView:gwView;
 },
});
assert.equal(result.status,'HOLD');
assert.equal(result.hq.active_version,a);
assert.equal(result.gateway.active_version,a);
assert.equal(result.contact_pipeline_active,false);
assert.equal(result.operations_performed,'metadata_read_only');
assert.equal(result.hq.secret_values_read,false);
assert.equal(result.hq.published_source_commit_verified,false);
assert.deepEqual(calls.map(x=>x.mode),[
 'deployments','version','deployments','deployments','version','deployments',
]);
let cursor=0;
await assert.rejects(()=>inspectActiveContactRuntime({
 readMetadata:async(which,mode)=>{
  cursor++;
  if(which==='hq'&&mode==='deployments'&&cursor===3)
   return {deployments:[{...deployed.deployments[0],
    id:'44444444-4444-4444-8444-444444444444'}]};
  return mode==='version'?hqView:deployed;
 },
}),/work_contact_runtime_deployment_changed_during_inspection/);
assert.throws(()=>verifyRuntimeSource({...hq,name:'jill-live'},gateway),
 /work_contact_runtime_hq_source_scope_mismatch/);
assert.throws(()=>verifyRuntimeSource(hq,gateway+'\n[[d1_databases]]'),
 /work_contact_runtime_gateway_source_scope_mismatch/);
console.log('PASS Contact runtime preflight: fixed WORK D1/Worker scope, stable 100pct active, Contact OFF, no public D1, never release approval.');
