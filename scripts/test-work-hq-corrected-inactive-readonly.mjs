import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIX_PIN} from './review-work-hq-repaired-artifact-offline.mjs';
import {VERSION_PIN}
 from './inspect-work-hq-uploaded-inactive-readonly.mjs';
import {inspectRepairedVersionInactive}
 from './inspect-work-hq-corrected-inactive-readonly.mjs';

const NEW='11111111-2222-4333-8444-555555555555';
const src=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gatewayCandidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml',
 'utf8');
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
const secretNames=[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const mk=(name,type,rest={})=>({name,type,...rest});
const activeBindings=[
 mk('JILL_ORDER_DESK_WORK_DB','d1',{id:VERSION_PIN.d1}),
 ...secretNames.map(s=>mk(s,'secret_text')),
 ...Object.entries(flagValues).map(([k,v])=>
  mk(k,'plain_text',{text:v})),
 mk('CF_VERSION_METADATA','version_metadata'),
];
const gatewayBindings=[
 mk('RATE_LIMITER','durable_object_namespace'),
 ...['SHOPIFY_WORK_APP_SECRET','JILL_CUSTOM_ORDER_GATEWAY_SECRET',
  'JILL_CUSTOM_ORDER_QA_BACKEND_URL'].map(s=>mk(s,'secret_text')),
 mk('CF_VERSION_METADATA','version_metadata'),
];
const original={...structuredClone(src),
 preview_urls:false,
 vars:{...src.vars,...flagValues},
 secrets:{required:[...secretNames]},
};
const repaired={...structuredClone(original),
 version_metadata:{binding:'CF_VERSION_METADATA'}};
const origProof={
 fingerprint_sha256:'c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996',
 manifest_sha256:'890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671',
 bundled_file_count:50,private_worker_entry_found:true,
};
const repairedProof={
 fingerprint_sha256:FIX_PIN.fingerprint,manifest_sha256:FIX_PIN.manifest,
 bundled_file_count:50,private_worker_entry_found:true,
};
const deployment=(which,allocation=false)=>({deployments:[{
 id:which==='hq'?VERSION_PIN.deployment:VERSION_PIN.gatewayDeployment,
 created_on:'2026-10-23T20:00:00Z',
 versions:allocation&&which==='hq'?
  [{version_id:VERSION_PIN.active,percentage:100},
   {version_id:NEW,percentage:0}]:
  [{version_id:which==='hq'?VERSION_PIN.active:
    VERSION_PIN.gateway,percentage:100}],
}]});
function trial(options={}){
 const calls={original:0,repaired:0,metadata:[],previews:0};
 const readOriginal=async()=>{
  calls.original++;
  return {manifest:structuredClone(original),
   artifact:structuredClone(origProof)};
 };
 const readRepaired=async()=>{
  calls.repaired++;
  const data={manifest:structuredClone(repaired),
   artifact:structuredClone(repairedProof)};
  return options.local?options.local(data,calls.repaired):data;
 };
 const readMetadata=async(which,mode,id)=>{
  calls.metadata.push({which,mode,id});
  const data=mode==='deployments'?deployment(which,options.allocated):
   {id,resources:{bindings:structuredClone(
    which==='gateway'?gatewayBindings:activeBindings)}};
  return options.metadata?options.metadata(
   {which,mode,id},data,calls.metadata.length):data;
 };
 const readSubdomains=async()=>{
  calls.previews++;
  return {hq:{enabled:true,previews_enabled:false},
   gateway:{enabled:true,previews_enabled:false}};
 };
 return {calls,run:(newVersion=NEW)=>inspectRepairedVersionInactive({
  newVersion,readOriginal,readRepaired,
  readMetadata,readSubdomains,compiledHq:src,gatewayCandidate,
 })};
}
const success=trial();
const report=await success.run();
assert.equal(report.status,'HOLD');
assert.equal(report.expected_fourteenth_binding_present,true);
assert.equal(report.active_deployment_unchanged,true);
assert.equal(report.uploaded_version_confirmed_outside_traffic_allocation,true);
assert.equal(report.restored_artifact_digest_verified,true);
assert.equal(report.true_secret_value_continuity_verified,false);
assert.equal(report.authorization_to_promote,false);
assert.equal(report.version_uploaded_by_inspector,false);
assert.equal(report.traffic_changed,false);
assert.equal(success.calls.previews,2);
assert.equal(success.calls.original,3);
assert.equal(success.calls.repaired,2);
assert.equal(success.calls.metadata.filter(x=>
 x.which==='hq'&&x.mode==='version'&&x.id===NEW).length,1);
for(const badVersion of [
 VERSION_PIN.uploaded,VERSION_PIN.active,VERSION_PIN.gateway,
 'not-a-uuid',
]){
 const check=trial();
 await assert.rejects(check.run(badVersion),
 /work_hq_corrected_postflight_new_uploaded_version_id_invalid_or_previously_rejected/);
 assert.equal(check.calls.metadata.length,0);
}
const wrongBinding=trial({metadata:({which,mode,id},data)=>{
 if(which==='hq'&&mode==='version'&&id===NEW)
  data.resources.bindings=data.resources.bindings.filter(x=>
   x.name!=='CF_VERSION_METADATA');
 return data;
}});
await assert.rejects(wrongBinding.run(),/work_hq_inactive_postflight_/);
const wrongSecret=trial({metadata:({which,mode,id},data)=>{
 if(which==='hq'&&mode==='version'&&id===NEW)
  data.resources.bindings=data.resources.bindings.filter(x=>
   x.name!=='JILL_WORK_SESSION_KEY_B64');
 return data;
}});
await assert.rejects(wrongSecret.run(),/work_hq_inactive_postflight_/);
const allocated=trial({allocated:true});
await assert.rejects(allocated.run(),
 /work_hq_corrected_postflight_deployed_version_or_traffic_changed_hq/);
const changedLocal=trial({local:(v,n)=>{
 if(n===2)v.artifact.fingerprint_sha256='0'.repeat(64);
 return v;
}});
await assert.rejects(changedLocal.run(),
 /contact_inactive_upload_offline_owner_pinned_local_bytes_changed|work_hq_repaired_artifact_review_repaired_manifest_or_bundle_not_owner_pinned/);
const wrongPreview=trial({metadata:({which,mode,id},data)=>data});
// Source-only CI default mode performs zero remote reads independently.
console.log('PASS WORK HQ corrected version postflight: exact new ID, 14 bindings, no served allocation, owner/local 50-file pin and failure cases. Offline only.');
