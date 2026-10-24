import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectContactPairedBaseline}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
const compiledHq=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gatewayCandidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const hqVersion='44ad4a81-55ad-4f49-9965-61260cc2294d';
const gatewayVersion='9322193f-5e87-4479-88c9-39229dddb5f2';
const bind=(name,type,extra={})=>({name,type,...extra});
const hqView={id:hqVersion,resources:{bindings:[
 bind('JILL_ORDER_DESK_WORK_DB','d1',{id:
  '3f17c186-c794-4e00-8f20-017191373a19'}),
 bind('SHOPIFY_API_SECRET','secret_text'),
 bind('JILL_WORK_SESSION_KEY_B64','secret_text'),
 bind('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
 bind('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text',{text:'false'}),
 bind('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
]}};
const gatewayView={id:gatewayVersion,resources:{bindings:[
 bind('RATE_LIMITER','durable_object_namespace'),
 bind('SHOPIFY_WORK_APP_SECRET','secret_text'),
 bind('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
 bind('CF_VERSION_METADATA','version_metadata'),
]}};
const deployed=(id)=>({deployments:[{
 id:'11111111-2222-4333-8444-555555555555',
 created_on:'2026-10-23T20:00:00Z',
 versions:[{version_id:id,percentage:100}],
}]});
const requestTrace=[];
const data={hq:{deployments:deployed(hqVersion),version:hqView},
 gateway:{deployments:deployed(gatewayVersion),version:gatewayView}};
const readMetadata=async(which,mode)=>{
 requestTrace.push(which+':'+mode);
 return data[which][mode];
};
const report=await inspectContactPairedBaseline({
 readMetadata,compiledHq,gatewayCandidate,
});
assert.equal(report.status,'HOLD');
assert.equal(report.active_versions_verified,true);
assert.equal(report.hq.candidate_plaintext_parity,true);
assert.equal(report.gateway.named_service_binding_in_candidate,true);
assert.equal(report.secret_values_read,false);
assert.equal(report.release_authorized,false);
assert.deepEqual(requestTrace,[
 'hq:deployments','hq:version','hq:deployments',
 'gateway:deployments','gateway:version','gateway:deployments',
]);
const pinChanged={...data,hq:{
 deployments:deployed('00000000-1111-4111-8111-111111111111'),
 version:hqView}};
await assert.rejects(()=>inspectContactPairedBaseline({
 readMetadata:async(which,mode)=>pinChanged[which][mode],
 compiledHq,gatewayCandidate,
}),/contact_paired_baseline_hq_version_changed_since_owner_attestation/);
let reads=0;
await assert.rejects(()=>inspectContactPairedBaseline({
 readMetadata:async(which,mode)=>{
  reads++;
  if(which==='hq'&&mode==='deployments'&&reads===3){
   return {deployments:[{...data.hq.deployments.deployments[0],
    id:'44444444-4444-4444-8444-444444444444'}]};
  }
  return data[which][mode];
 },
 compiledHq,gatewayCandidate,
}),/contact_paired_baseline_hq_allocation_changed/);
await assert.rejects(()=>inspectContactPairedBaseline({
 readMetadata:async(which,mode)=>which==='hq'&&mode==='version'
  ?{...hqView,resources:{bindings:hqView.resources.bindings.map(b=>
    b.name==='JILL_WORK_OAUTH_ENABLED'?{...b,text:'false'}:b)}}
  :data[which][mode],
 compiledHq,gatewayCandidate,
}),/work_contact_runtime_active_hq_canary_stage_unverified/);
const inspector=readFileSync(
 'scripts/inspect-work-contact-paired-baseline-readonly.mjs','utf8');
assert.doesNotMatch(inspector, /\['(?:deploy|upload|apply|restore|delete|secret put)'/);
assert.ok(inspector.includes('active_binding_parity'));
console.log('PASS paired WORK Contact remote baseline contract: pinned current versions, stable allocation, active Shopify OAuth, private gateway and metadata-only reads; always HOLD.');
