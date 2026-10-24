import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VISUAL_CANDIDATE,inspectActivatedWorkHq}
 from './inspect-work-hq-visual-activation-readonly.mjs';
import {FIX_PIN} from './review-work-hq-repaired-artifact-offline.mjs';
import {VERSION_PIN}
 from './inspect-work-hq-uploaded-inactive-readonly.mjs';
const mainConfig=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const flags={
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const required=[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const create=(name,type,rest={})=>({name,type,...rest});
const bindings=[
 create('JILL_ORDER_DESK_WORK_DB','d1',{id:VERSION_PIN.d1}),
 ...Object.entries(flags).map(([key,text])=>
  create(key,'plain_text',{text})),
 ...required.map(key=>create(key,'secret_text')),
 create('CF_VERSION_METADATA','version_metadata'),
];
const original={...structuredClone(mainConfig),
 preview_urls:false,vars:{...mainConfig.vars,...flags},
 secrets:{required:[...required]}};
const repaired={...structuredClone(original),
 version_metadata:{binding:'CF_VERSION_METADATA'}};
const baseArtifact={
 fingerprint_sha256:'c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996',
 manifest_sha256:'890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671',
 bundled_file_count:50,private_worker_entry_found:true,
};
const repairArtifact={
 fingerprint_sha256:FIX_PIN.fingerprint,
 manifest_sha256:FIX_PIN.manifest,
 bundled_file_count:50,private_worker_entry_found:true,
};
const view=(id,which)=>({id,resources:{bindings:structuredClone(
 which==='hq'?bindings:[
  create('RATE_LIMITER','durable_object_namespace'),
  create('SHOPIFY_WORK_APP_SECRET','secret_text'),
  create('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
  create('CF_VERSION_METADATA','version_metadata'),
 ])}});
const deployment=(which,options={})=>({deployments:[{
 id:which==='hq'?
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':
  VERSION_PIN.gatewayDeployment,
 created_on:'2026-10-24T12:00:00Z',
 versions:[{version_id:which==='hq'?
  options.old?VERSION_PIN.active:VISUAL_CANDIDATE:
  VERSION_PIN.gateway,percentage:100}],
}]});
function setup(change={}){
 const stats={local:0,remote:[],preview:0};
 const readOriginal=async()=>{
  stats.local++;
  return {manifest:structuredClone(original),
   artifact:structuredClone(baseArtifact)};
 };
 const readRepaired=async()=>{
  stats.local++;
  const v={manifest:structuredClone(repaired),
   artifact:structuredClone(repairArtifact)};
  return change.local?change.local(v,stats.local):v;
 };
 const readMetadata=async(which,mode,id)=>{
  stats.remote.push({which,mode,id});
  let data=mode==='deployments'?
   deployment(which,{old:change.old}):view(id,which);
  return change.metadata?
   change.metadata({which,mode,id},data,stats.remote.length):data;
 };
 const readSubdomains=async()=>{
  stats.preview++;
  return change.preview?change.preview(stats.preview):
   {hq:{enabled:true,previews_enabled:false},
    gateway:{enabled:true,previews_enabled:false}};
 };
 return {stats,run:(candidate=VISUAL_CANDIDATE)=>inspectActivatedWorkHq({
  readOriginal,readRepaired,readMetadata,readSubdomains,candidate,
 })};
}
const good=setup();
const yes=await good.run();
assert.equal(yes.status,'HOLD_OWNER_VISUAL_ACCEPTANCE');
assert.equal(yes.new_hq_version_at_100_percent,true);
assert.equal(yes.all_14_hq_bindings_restored,true);
assert.equal(yes.version_urls_off_for_both_work_workers,true);
assert.equal(yes.gateway_unchanged,true);
assert.equal(yes.real_oauth_login_verified,false);
assert.equal(yes.release_to_live_authorized,false);
assert.equal(yes.deployment_performed_by_inspector,false);
assert.equal(good.stats.preview,2);
assert.equal(good.stats.local,4);
const unchanged=setup({old:true});
await assert.rejects(unchanged.run(),
 /work_hq_activated_readback_unexpected_active_worker_allocation/);
const publicVersion=setup({preview:()=>({
 hq:{enabled:true,previews_enabled:true},
 gateway:{enabled:true,previews_enabled:false},
})});
await assert.rejects(publicVersion.run(),
 /work_hq_activated_readback_work_preview_settings_changed/);
const noSecret=setup({metadata:({which,mode,id},data)=>{
 if(which==='hq'&&mode==='version'&&id===VISUAL_CANDIDATE)
  data.resources.bindings=data.resources.bindings.filter(x=>
   x.name!=='SHOPIFY_API_SECRET');
 return data;
}});
await assert.rejects(noSecret.run(),/work_hq_inactive_postflight_/);
const diffBinding=setup({metadata:({which,mode,id},data)=>{
 if(which==='hq'&&mode==='version'&&id===VISUAL_CANDIDATE)
  data.resources.bindings=data.resources.bindings.filter(x=>
   x.name!=='CF_VERSION_METADATA');
 return data;
}});
await assert.rejects(diffBinding.run(),
 /work_hq_inactive_postflight_/);
const drifting=setup({metadata:({which,mode,id},data,n)=>{
 if(which==='gateway'&&mode==='deployments'&&n>5)
  data.deployments[0].id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 return data;
}});
await assert.rejects(drifting.run(),
 /work_hq_activated_readback_deployment_changed_during_readback/);
for(const bad of [VERSION_PIN.active,VERSION_PIN.uploaded,'invalid']){
 const reject=setup();
 await assert.rejects(reject.run(bad),
  /work_hq_activated_readback_invalid_or_untrusted_reader/);
 assert.equal(reject.stats.remote.length,0);
}
const changedLocal=setup({local:(data,n)=>{
 if(n===4)data.artifact.fingerprint_sha256='0'.repeat(64);
 return data;
}});
await assert.rejects(changedLocal.run(),
 /contact_inactive_upload_offline_owner_pinned_local_bytes_changed|work_hq_repaired_artifact_review_repaired_manifest_or_bundle_not_owner_pinned/);
console.log('PASS WORK HQ 100% visual activation readback: exact versions, protected previews, no gateway changes, binding parity and 50-file local integrity. Offline only.');
