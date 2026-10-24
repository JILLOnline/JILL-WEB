import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 applyApprovedWorkPreviewDisable,postDisableWorkVersionUrl,
} from './disable-work-version-urls-owner-approved.mjs';

const HQ='jill-order-desk-canary-work';
const GW='jill-work-custom-orders-qa';
const VERSIONS={
 hq:'44ad4a81-55ad-4f49-9965-61260cc2294d',
 gateway:'9322193f-5e87-4479-88c9-39229dddb5f2',
};
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const B=(name,type,extra={})=>({name,type,...extra});
const hqBindings=[
 B('JILL_ORDER_DESK_WORK_DB','d1',{id:D1}),
 B('SHOPIFY_API_SECRET','secret_text'),
 B('JILL_WORK_SESSION_KEY_B64','secret_text'),
 B('JILL_HQ_MERCHANT_READ_SECRET','secret_text'),
 B('JILL_HQ_MERCHANT_WRITE_SECRET','secret_text'),
 B('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
 B('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
 B('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text',{text:'false'}),
 ...[
  ['JILL_WORK_CATALOG_ENABLED','true'],
  ['JILL_WORK_CONVERSATION_ENABLED','false'],
  ['JILL_WORK_HQ_DETAIL_ENABLED','true'],
  ['JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false'],
  ['JILL_WORK_MERCHANT_WRITES_ENABLED','true'],
 ].map(([name,text])=>B(name,'plain_text',{text})),
];
const gatewayBindings=[
 B('RATE_LIMITER','durable_object_namespace'),
 B('SHOPIFY_WORK_APP_SECRET','secret_text'),
 B('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
 B('JILL_CUSTOM_ORDER_QA_BACKEND_URL','secret_text'),
 B('CF_VERSION_METADATA','version_metadata'),
];
const compiledHq=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gatewayCandidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const deployment=which=>({deployments:[{
 id:'11111111-2222-4333-8444-555555555555',
 created_on:'2026-10-23T20:00:00Z',
 versions:[{version_id:VERSIONS[which],percentage:100}],
}]});
const version=which=>({
 id:VERSIONS[which],resources:{
  bindings:which==='hq'?hqBindings:gatewayBindings,
 },
});
const readMetadata=async(which,mode)=>mode==='version'
 ?version(which):deployment(which);
const state=()=>({
 hq:{enabled:true,previews_enabled:true},
 gateway:{enabled:true,previews_enabled:true},
});
const runWithState=async(stateIn,override={})=>{
 const mutable=structuredClone(stateIn);
 const posts=[];
 const result=await applyApprovedWorkPreviewDisable({
  compiledHq,gatewayCandidate,readMetadata,
  readSubdomains:async()=>structuredClone(mutable),
  writeDisable:async(which)=>{
   posts.push(which);
   mutable[which].previews_enabled=false;
   return {
    worker:which==='hq'?HQ:GW,
    workers_dev_enabled:true,version_urls_enabled:false,
   };
  },...override,
 });
 return {result,mutable,posts};
};
const changed=await runWithState(state());
assert.deepEqual(changed.posts,['hq','gateway']);
assert.deepEqual(changed.mutable,{
 hq:{enabled:true,previews_enabled:false},
 gateway:{enabled:true,previews_enabled:false},
});
assert.equal(changed.result.status,'HOLD');
assert.equal(changed.result.preview_url_exposure_gate_cleared,true);
assert.equal(changed.result.normal_traffic_unchanged,true);
assert.equal(changed.result.worker_uploaded,false);
assert.equal(changed.result.worker_deployed,false);
assert.equal(changed.result.contact_flags_enabled,false);
assert.equal(changed.result.release_authorized,false);
assert.equal(changed.result.secret_values_read,false);
const repeat=await runWithState(changed.mutable);
assert.deepEqual(repeat.posts,[]);
assert.deepEqual(repeat.result.applied_to,[]);
const partial=await runWithState({
 hq:{enabled:true,previews_enabled:false},
 gateway:{enabled:true,previews_enabled:true},
});
assert.deepEqual(partial.posts,['gateway']);
let writes=0;
await assert.rejects(()=>runWithState({
 ...state(),gateway:{enabled:false,previews_enabled:true},
},{writeDisable:async()=>{writes++;}}),
 /work_version_urls_disable_settings_missing_or_workers_dev_not_enabled/);
assert.equal(writes,0);
await assert.rejects(()=>runWithState(state(),{
 readMetadata:async(which,mode)=>which==='hq'&&mode==='deployments'
  ?{deployments:[{...deployment('hq').deployments[0],
   versions:[{version_id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',percentage:100}]}]}
  :readMetadata(which,mode),
 writeDisable:async()=>{writes++;},
}),/contact_paired_baseline_hq_version_changed_since_owner_attestation/);
assert.equal(writes,0);
const half=state();
let halfWrites=0;
await assert.rejects(()=>applyApprovedWorkPreviewDisable({
 compiledHq,gatewayCandidate,readMetadata,
 readSubdomains:async()=>structuredClone(half),
 writeDisable:async which=>{
  halfWrites++;
  if(which==='gateway')throw Error('synthetic POST denied');
  half[which].previews_enabled=false;
  return {worker:HQ,workers_dev_enabled:true,version_urls_enabled:false};
 },
}),/synthetic POST denied/);
assert.equal(halfWrites,2);
assert.equal(half.hq.previews_enabled,false);
assert.equal(half.gateway.previews_enabled,true);
// If another process changes a setting between our GETs, STOP without
// sending an unreviewed write or undoing any previous security action.
const concurrent=state();let concurrentReads=0;let concurrentWrites=0;
await assert.rejects(()=>applyApprovedWorkPreviewDisable({
 compiledHq,gatewayCandidate,readMetadata,
 readSubdomains:async()=>{
  concurrentReads++;
  if(concurrentReads===2)concurrent.gateway.previews_enabled=false;
  return structuredClone(concurrent);
 },
 writeDisable:async()=>{concurrentWrites++;},
}),/work_version_urls_disable_preview_changed_outside_this_operation/);
assert.equal(concurrentWrites,0);
// Exact Cloudflare API: TWO Worker names, one safe body, POST only.
const accountId='0123456789abcdef0123456789abcdef';
const token='synthetic-owner-api-token-example-keep-private';
const outgoing=[];
for(const which of ['hq','gateway']){
 const result=await postDisableWorkVersionUrl({
  which,accountId,token,
  fetchImpl:async(url,options)=>{
   outgoing.push({url,method:options.method,
    body:JSON.parse(options.body),
    auth:options.headers.Authorization,
    redirect:options.redirect,
   });
   return new Response(JSON.stringify({
    success:true,result:{enabled:true,previews_enabled:false},
   }),{status:200,headers:{'content-type':'application/json'}});
  },
 });
 assert.equal(result.version_urls_enabled,false);
 assert.equal(result.workers_dev_enabled,true);
}
assert.deepEqual(outgoing.map(x=>new URL(x.url).pathname.split('/').at(-2)),
 [HQ,GW]);
assert.deepEqual(outgoing.map(x=>x.method),['POST','POST']);
assert.ok(outgoing.every(x=>x.auth==='Bearer '+token&&
 x.redirect==='error'&&JSON.stringify(x.body)==='{"enabled":true,"previews_enabled":false}'));
await assert.rejects(()=>postDisableWorkVersionUrl({
 which:'live',accountId,token,fetchImpl:async()=>{writes++;},
}),/work_version_urls_disable_not_exact_approved_work_target/);
await assert.rejects(()=>postDisableWorkVersionUrl({
 which:'hq',accountId,token,
 fetchImpl:async()=>new Response(JSON.stringify({
  success:true,result:{enabled:false,previews_enabled:false},
 }),{status:200}),
}),/work_version_urls_disable_cloudflare_update_not_confirmed/);
await assert.rejects(()=>postDisableWorkVersionUrl({
 which:'hq',accountId,token,
 fetchImpl:async()=>new Response(JSON.stringify({
  success:false,result:{enabled:true,previews_enabled:false},
 }),{status:403}),
}),/work_version_urls_disable_cloudflare_setting_update_unconfirmed/);
assert.equal(writes,0);
console.log('PASS owner-approved WORK-only Version URL switch: pinned bindings, two exact POSTs, workers.dev preserved, readback verification, partial failures stop, no version uploads.');
