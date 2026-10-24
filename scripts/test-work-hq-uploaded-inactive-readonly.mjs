import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 VERSION_PIN,compareUploadedWorkHqVersion,inspectUploadedWorkHqInactive,
} from './inspect-work-hq-uploaded-inactive-readonly.mjs';
const src=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gw=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const flagValues={
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const secrets=[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const mk=(name,type,additional={})=>({name,type,...additional});
const expectedBindings=[
 mk('JILL_ORDER_DESK_WORK_DB','d1',{id:VERSION_PIN.d1}),
 ...secrets.map(n=>mk(n,'secret_text')),
 ...Object.entries(flagValues).map(([name,text])=>
  mk(name,'plain_text',{text})),
];
const activeView={id:VERSION_PIN.active,
 resources:{bindings:structuredClone(expectedBindings)}};
const uploadedView={id:VERSION_PIN.uploaded,
 resources:{bindings:structuredClone(expectedBindings)}};
const copyView=()=>structuredClone(uploadedView);
const safe=compareUploadedWorkHqVersion({activeView,uploadedView});
assert.equal(safe.uploaded_binding_scope_matches_active,true);
assert.equal(safe.remote_secret_value_continuity_verified,false);
assert.equal(safe.actual_shopify_owner_login_verified,false);
assert.equal(safe.private_entrypoint_remote_execution_verified,false);
for(const mutate of [
 c=>{c.id=VERSION_PIN.active;},
 c=>{c.resources.bindings=c.resources.bindings.filter(
  b=>b.name!=='JILL_WORK_SESSION_KEY_B64');},
 c=>{c.resources.bindings.push(mk('SURPRISE','secret_text'));},
 c=>{c.resources.bindings.push(mk('UNEXPECTED_DB','d1',{
  id:VERSION_PIN.d1}));},
 c=>{c.resources.bindings.find(b=>
  b.name==='JILL_ORDER_DESK_WORK_DB').id='wrong';},
 c=>{c.resources.bindings.find(b=>
  b.name==='JILL_WORK_OAUTH_ENABLED').text='false';},
 c=>{c.resources.bindings.find(b=>
  b.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false';},
 c=>{c.resources.bindings.push(mk(
  'JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED','plain_text',{text:'true'}));},
 c=>{c.resources.bindings.push(mk('UNKNOWN','kv_namespace'));},
 c=>{c.resources.bindings.push(mk('UNKNOWN','assets'));},
 c=>{c.resources.bindings.push(mk('JILL_WORK_OAUTH_ENABLED','plain_text',{
  text:'true'}));},
]){
 const bad=copyView();mutate(bad);
 assert.throws(()=>compareUploadedWorkHqVersion({
  activeView,uploadedView:bad,
 }),/work_hq_inactive_postflight_/);
}
const sourceManifest={...structuredClone(src),
 preview_urls:false,
 vars:{...src.vars,...flagValues},
 secrets:{required:secrets},
};
const artifact={
 fingerprint_sha256:'c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996',
 manifest_sha256:'890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671',
 bundled_file_count:50,private_worker_entry_found:true,
};
const gatewayBindings=[
 mk('RATE_LIMITER','durable_object_namespace'),
 ...['SHOPIFY_WORK_APP_SECRET','JILL_CUSTOM_ORDER_GATEWAY_SECRET',
  'JILL_CUSTOM_ORDER_QA_BACKEND_URL'].map(n=>mk(n,'secret_text')),
 mk('CF_VERSION_METADATA','version_metadata'),
];
const deployment=(which,extra=false)=>({deployments:[{
 id:which==='hq'?VERSION_PIN.deployment:VERSION_PIN.gatewayDeployment,
 created_on:'2026-10-23T20:00:00Z',
 versions:extra&&which==='hq'?
  [{version_id:VERSION_PIN.active,percentage:100},
   {version_id:VERSION_PIN.uploaded,percentage:0}]:
  [{version_id:which==='hq'?VERSION_PIN.active:
    VERSION_PIN.gateway,percentage:100}],
}]});
function scenario(options={}){
 const calls={local:0,meta:[],preview:0};
 const readLocal=async()=>{
  calls.local++;
  const data={manifest:structuredClone(sourceManifest),
   artifact:structuredClone(artifact)};
  return options.local?options.local(data,calls.local):data;
 };
 const readMetadata=async(which,mode,id)=>{
  calls.meta.push({which,mode,id});
  let value=mode==='deployments'?deployment(which,options.allocated):
   which==='gateway'?{id:VERSION_PIN.gateway,
    resources:{bindings:structuredClone(gatewayBindings)}}:
   id===VERSION_PIN.uploaded?copyView():structuredClone(activeView);
  return options.meta?options.meta({which,mode,id},value,calls.meta.length):value;
 };
 const readSubdomains=async()=>{
  calls.preview++;
  return {hq:{enabled:true,previews_enabled:false},
   gateway:{enabled:true,previews_enabled:false}};
 };
 return {calls,run:()=>inspectUploadedWorkHqInactive({
  readLocal,readMetadata,readSubdomains,
  compiledHq:src,gatewayCandidate:gw,
 })};
}
const good=scenario();
const report=await good.run();
assert.equal(report.status,'HOLD');
assert.equal(report.inactive_uploaded_version,VERSION_PIN.uploaded);
assert.equal(report.confirmed_not_in_current_traffic_allocation,true);
assert.equal(report.uploaded_version_metadata_checked,true);
assert.equal(report.remote_secret_value_continuity_verified,false);
assert.equal(report.release_authorized,false);
assert.equal(report.worker_uploaded_by_inspector,false);
assert.equal(report.deployment_performed,false);
assert.equal(report.traffic_changed,false);
assert.equal(good.calls.local,2);
assert.equal(good.calls.preview,2);
assert.equal(good.calls.meta.filter(c=>c.which==='hq'&&c.mode==='version'&&
 c.id===VERSION_PIN.uploaded).length,1);
const badAllocation=scenario({allocated:true});
await assert.rejects(badAllocation.run(),
 /work_hq_inactive_postflight_new_version_serving_or_allocation_changed_hq/);
const missingSecret=scenario({meta:({which,mode,id},view)=>{
 if(which==='hq'&&mode==='version'&&id===VERSION_PIN.uploaded)
  view.resources.bindings=view.resources.bindings.filter(
   b=>b.name!=='SHOPIFY_API_SECRET');
 return view;
}});
await assert.rejects(missingSecret.run(),/work_hq_inactive_postflight_/);
const drifter=scenario({meta:({which,mode,id},view,n)=>{
 if(n===16&&which==='gateway'&&mode==='deployments')
  view.deployments[0].id='99999999-9999-4999-8999-999999999999';
 return view;
}});
await assert.rejects(drifter.run(),/work_hq_inactive_postflight_/);
const badLocal=scenario({local:data=>{
 data.artifact.fingerprint_sha256='0'.repeat(64);return data;
}});
await assert.rejects(badLocal.run(),
 /contact_inactive_upload_offline_owner_pinned_local_bytes_changed/);
assert.equal(badLocal.calls.meta.length,0);
console.log('PASS: WORK HQ exact uploaded inactive version verified against active OAuth/flags/D1/secret names, rejects allocation and metadata drift; read-only HOLD.');
