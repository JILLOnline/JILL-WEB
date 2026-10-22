// JILL HQ M1+M2 WORK Owner preflight: metadata and public health READ ONLY.
// No source edit, no customer read, no signed write, no Cloudflare upload,
// deployment, secret change, migration, billing upgrade or receipt mutation.
// Old V4 activation receipts are spent; never import an old release executor.
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {currentAllocation} from './collect-work-runtime-readonly.mjs';
import {read as cloudRead} from './stage-work-hq-connected-read-owner.mjs';
import {readConnectedHealth} from './release-work-hq-connected-read-owner.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const QUOTE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const REQUIRED_SECRETS=[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET'];
const DISABLED=[
 'JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',
 'JILL_WORK_CONVERSATION_ENABLED',
 'JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED',
 'JILL_WORK_HQ_PRIVATE_MEDIA_ENABLED',
 'JILL_WORK_HQ_INVOICE_ENABLED',
 'JILL_WORK_HQ_DRAFT_ORDER_CREATE_ENABLED',
 'JILL_WORK_HQ_QUOTE_PUBLICATION_ENABLED',
];
const HOLD=(reason,proof={})=>Object.freeze({
 status:'HOLD',reason,environment:'WORK',traffic_changed:false,
 deployment_requested:false,upload_requested:false,
 migration_requested:false,paid_upgrade_requested:false,
 authorization_to_activate:false,...proof});
const validView=(x,id)=>x?.id===id&&Array.isArray(x.resources?.bindings)&&
 x.resources.bindings.length>=8&&x.resources.bindings.length<=40;
// Wrangler versions list is a PAGINATED INVENTORY, not the authority for
// deployed version identity. Its most recent page may omit the live active
// version and the preserved 0% canary. Current deployment allocation plus
// exact versions view metadata for BOTH IDs are the authoritative proofs.
function verifyReadOnlyBindings(active){
 if(!validView(active,active.id))return 'active_bindings_unavailable';
 const b=new Map();
 for(const entry of active.resources.bindings){
  if(typeof entry?.name!=='string'||!entry.name||b.has(entry.name))
   return 'invalid_or_duplicate_binding';
  b.set(entry.name,entry);
 }
 const plain=(name,value)=>b.get(name)?.type==='plain_text'&&
   b.get(name).text===value;
 if(!plain('JILL_WORK_HOST_STAGE','canary')||
    !plain('JILL_WORK_OAUTH_ENABLED','true')||
    !plain('JILL_WORK_CATALOG_ENABLED','true'))
   return 'work_read_binding_unverified';
 if(DISABLED.some(flag=>b.has(flag)&&!plain(flag,'false'))||
    !plain('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false')||
    !plain('JILL_WORK_CONVERSATION_ENABLED','false'))
   return 'sensitive_feature_flags_not_off';
 const db=b.get('JILL_ORDER_DESK_WORK_DB');
 if(db?.type!=='d1'||!(db.id===D1||db.database_id===D1))
   return 'existing_d1_binding_changed';
 if(REQUIRED_SECRETS.some(key=>b.get(key)?.type!=='secret_text'))
   return 'secret_binding_presence_unverified';
 if(b.has('CF_VERSION_METADATA')&&b.get('CF_VERSION_METADATA')?.type!=='version_metadata')
   return 'version_metadata_binding_changed';
 if(active.resources?.script?.handlers&&
    !Array.isArray(active.resources.script.handlers))
   return 'worker_handlers_unverified';
 return null;
}
/** Read 5 Cloudflare metadata snapshots, then optional unpinned public
 * health on stable current active version. Independent reads never suppress
 * other observations. Only bounded approved commands; no mutations. */
export async function inspectM1M2WorkRuntime({
 readMetadata,readHealth,
}={}){
 if(typeof readMetadata!=='function'||typeof readHealth!=='function')
  return HOLD('read_sources_unavailable');
 const reads=[],values={};
 async function get(label,args){
  try{values[label]=await readMetadata(args);
   reads.push({name:label,ok:true});}
  catch{reads.push({name:label,ok:false});}
 }
 await get('allocation_before',['deployments','list']);
 await get('versions',['versions','list']);
 let baseline=null,activeId=null;
 try{
  baseline=currentAllocation(values.allocation_before);
  const owners=baseline.versions.filter(v=>v.percentage===100);
  if(owners.length===1)activeId=owners[0].id;
 }catch{}
 if(activeId)await get('active_version',['versions','view',activeId]);
 else reads.push({name:'active_version',ok:false});
 await get('quote_canary',['versions','view',QUOTE]);
 await get('allocation_after',['deployments','list']);
 const safe={reads,source:'authenticated_cloudflare_metadata',
  quote_canary_version:QUOTE};
 if(reads.some(r=>!r.ok))return HOLD('metadata_read_incomplete',safe);
 let after;
 try{after=currentAllocation(values.allocation_after);}
 catch{return HOLD('invalid_deployment_metadata',safe);}
 if(JSON.stringify(baseline)!==JSON.stringify(after))
   return HOLD('allocation_changed_during_read',safe);
 if(!baseline||baseline.versions.length!==2||
    baseline.versions.some(v=>!UUID.test(v.id))||
    baseline.versions.filter(v=>v.percentage===0).length!==1||
    !baseline.versions.some(v=>v.id===QUOTE&&v.percentage===0)||
    !baseline.versions.some(v=>v.id===activeId&&v.percentage===100))
   return HOLD('unexpected_active_or_quote_allocation',safe);
 // Require a successful and structured version-list read, but never mistake
 // pagination/retention for proof that an explicitly viewed version is absent.
 // Direct authenticated versions view + stable deployment allocation bind IDs.
 if(!values.versions||typeof values.versions!=='object'||
    !Array.isArray(values.versions)&&
    !Object.keys(values.versions).length)
   return HOLD('version_list_response_invalid',safe);
 if(!validView(values.active_version,activeId)||
    !validView(values.quote_canary,QUOTE))
   return HOLD('version_metadata_unverified',safe);
 const reason=verifyReadOnlyBindings(values.active_version);
 if(reason)return HOLD(reason,safe);
 const quote=new Map(values.quote_canary.resources.bindings.map(x=>[x.name,x]));
 if(quote.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED')?.type!=='plain_text'||
    quote.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED').text!=='true')
   return HOLD('quote_canary_identity_unverified',safe);
 let health;
 try{health=await readHealth(activeId);}
 catch{return HOLD('health_read_unavailable',safe);}
 if(health?.status!==200||health?.runtime_version!==activeId||
    health?.database_ready!==true)
   return HOLD('runtime_health_unverified',safe);
 // Never assert readiness for activation: read-only proof cannot validate
 // actual authenticated Owner UI, P1/P2 Shopify totals or source promotion.
 return Object.freeze({
  status:'READ_ONLY_RUNTIME_VERIFIED',environment:'WORK',
  observed_deployment:baseline.deployment,
  active_version:activeId,quote_canary:QUOTE,
  quote_percentage:0,active_percentage:100,
  read_count:reads.length,reads,
  version_list_role:'advisory_paginated',
  direct_active_version_verified:true,direct_quote_version_verified:true,
  bindings_verified:true,health_verified:true,
  traffic_changed:false,deployment_requested:false,
  upload_requested:false,migration_requested:false,
  paid_upgrade_requested:false,authorization_to_activate:false,
  next_step:'source_release_and_authenticated_UI_still_required',
 });
}
async function execute(){
 let report;
 try{report=await inspectM1M2WorkRuntime({
  readMetadata:args=>cloudRead(args),
  readHealth:readConnectedHealth,
 });}
 catch{report=HOLD('owner_runtime_inspection_unverified');}
 console.log(JSON.stringify(report,null,2));
 if(report.status!=='READ_ONLY_RUNTIME_VERIFIED')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||process.argv[2]!=='--owner'){
  console.error('STOP M1M2_WORK_OWNER_READ_ONLY_INSPECT_REQUIRED');
  process.exitCode=1;
 }else await execute();
}
