import assert from 'node:assert/strict';
import {BASELINE,assertBaseline,selectStageCandidate,assertCandidate,
 explainWorkM1M2Plan,planM1M2StageManifest,
 connectedContentCompiledConfigPaths,connectedContentUploadArgs}
 from './stage-work-hq-connected-content-owner.mjs';
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
const marker='JILL HQ WORK CONNECTED-CONTENT source-locked INACTIVE TEST';
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
console.log('PASS CONNECTED-CONTENT one-use Owner stage: exact WORK baseline, candidate identity, immutable bindings, runtime and fail-closed denials. NO provider call.');

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
console.log('PASS safe CONNECTED-CONTENT read-only manifest diagnostics; never disclose provider bindings.');

 // Regression for 2026-10-21 Owner HOLD:
 // the actual upload path passed {baseline,active,quote} through directly
 // to a policy that expected "allocation", while --diagnose adapted it.
 // Shared adapter must accept the exact 14-binding WORK allocation.
const observedPlain={
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'
};
const observedBindings=[
 ...Object.entries(observedPlain).map(([name,text])=>plain(name,text)),
 ...['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET']
   .map(name=>({name,type:'secret_text'})),
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
  id:'3f17c186-c794-4e00-8f20-017191373a19'},
 {name:'CF_VERSION_METADATA',type:'version_metadata'}
];
const snapshot={
 baseline:structuredClone(baseline),
 active:{id:BASELINE.active,resources:{
  bindings:observedBindings,script:{handlers:['fetch']}}},
 quote:{id:BASELINE.quote,resources:{
  bindings:observedBindings.filter(x=>![
   'JILL_WORK_CATALOG_ENABLED','JILL_WORK_CONVERSATION_ENABLED',
   'CF_VERSION_METADATA'].includes(x.name))
  .map(x=>x.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?
   plain(x.name,'true'):x),
  script:{handlers:['fetch']}}}
};
assert.equal(snapshot.active.resources.bindings.length,14);
assert.equal(snapshot.quote.resources.bindings.length,11);
const knownCompiled={
 name:'jill-order-desk-canary-work',workers_dev:true,
 compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
 main:'index.js',assets:{directory:'../client'},
 d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
  database_name:'jill-order-desk-work',
  database_id:'3f17c186-c794-4e00-8f20-017191373a19'}],
 vars:{JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'false'}
};
const stagePlan=planM1M2StageManifest(snapshot,knownCompiled);
assert.equal(stagePlan.state,'LOCAL_DRY_RUN_MANIFEST_PREPARED',
 stagePlan.reason);
assert.equal(stagePlan.manifest.keep_vars,true);
assert.equal(stagePlan.manifest.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(stagePlan.manifest.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,'false');
assert.equal(stagePlan.upload_authorized,false);
assert.equal(stagePlan.deploy_authorized,false);
const diagnosePlan=explainWorkM1M2Plan({...snapshot,compiled:knownCompiled});
assert.equal(diagnosePlan.status,'READ_ONLY_LOCAL_MANIFEST_PREPARED');
assert.equal(diagnosePlan.reason,'local_manifest_prepared');
assert.equal(planM1M2StageManifest(
 {...snapshot,baseline:{...snapshot.baseline,deployment:'other'}},
 knownCompiled).reason,'live_allocation_changed');
assert.equal(planM1M2StageManifest(snapshot,{
 ...knownCompiled,r2_buckets:[{binding:'NEW',bucket_name:'billable'}]
}).reason,'unapproved_compiled_resource');
console.log('PASS Owner successor regression: real stage and diagnostic share exact validated WORK allocation mapping; wrong baselines and billable resources still HOLD.');

 // Regression: 2026-10-21 owner local dry-run previously wrote
 // wrangler.hq-connected-content-inactive.json but passed old M1/M2 filename to CLI.
 // Use an edition-unique filename and require path parity for ALL commands.
const stageSource='b2a1a561ece1c3073b42536fbaec4d5d4e9a1037';
const paths=connectedContentCompiledConfigPaths(stageSource);
assert.match(paths.config,
 /^\.\/dist\/server\/wrangler\.hq-connected-content-inactive\.[a-f0-9]{12}\.json$/);
assert.equal(paths.config.endsWith(stageSource.slice(0,12)+'.json'),true);
assert.equal(paths.file.endsWith(
 'wrangler.hq-connected-content-inactive.'+stageSource.slice(0,12)+'.json'),true);
assert.equal(paths.config.includes('m1m2'),false);
const uploadMarker='JILL HQ WORK CONNECTED-CONTENT source-locked INACTIVE '+
 stageSource+' 22df975f-0475-45f5-ab3c-f1976eb1dbb9';
const expected=['versions','upload','--config',paths.config,
 '--keep-vars','--message',uploadMarker];
assert.deepEqual(connectedContentUploadArgs(paths.config,uploadMarker),expected);
assert.deepEqual(connectedContentUploadArgs(paths.config,uploadMarker,{dryRun:true}),
 [...expected,'--dry-run']);
assert.throws(()=>connectedContentCompiledConfigPaths('not-a-sha'),
 /unverified_compiled_config_source/);
assert.throws(()=>connectedContentUploadArgs(
 './dist/server/wrangler.hq-m1m2-inactive.json',uploadMarker),
 /unverified_five_tab_upload_arguments/);
assert.throws(()=>connectedContentUploadArgs(paths.config,'untrusted message'),
 /unverified_five_tab_upload_arguments/);
console.log('PASS connected-content exact compiled config file = Wrangler dry-run/upload target; legacy M1/M2 path rejected, source-scoped filename, upload not invoked.');
