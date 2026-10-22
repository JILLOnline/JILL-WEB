// Read-only successor WORK snapshot for CONNECTED-CONTENT navigation release.
// Previous M1/M2 one-use upload/activation receipts are spent. This
// inspector never uploads, deploys, migrates, changes secrets, writes a
// receipt, invokes Shopify customer data, or opens paid resources.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {certifyM1M2SourceEdition} from './certify-work-hq-m1-m2-source-edition.mjs';
import {read,view} from './stage-work-hq-connected-read-owner.mjs';
import {readConnectedHealth} from './release-work-hq-connected-read-owner.mjs';
import {currentAllocation} from './collect-work-runtime-readonly.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const BRANCH='jill/m1-work-queue-preview-20261021';
export const CONNECTED_CONTENT_BASELINE=Object.freeze({
 deployment:'4dbd31a4-94f6-4dee-8518-17b8ade0eb20',
 active:'5c5a0358-fe43-4076-afd6-e5463936170f',
 quote:'dbc6341f-de7f-41de-8e97-6bf971201eeb',
 d1:'3f17c186-c794-4e00-8f20-017191373a19'
});
const SECRETS=new Set([
 'SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET'
]);
const REQUIRED=Object.freeze({
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
});
const SAFE_OFF=new Set([
 'JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED',
 'JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED',
 'JILL_WORK_HQ_PRIVATE_MEDIA_ENABLED',
 'JILL_WORK_HQ_INVOICE_ENABLED',
 'JILL_WORK_HQ_DRAFT_ORDER_CREATE_ENABLED',
 'JILL_WORK_HQ_QUOTE_PUBLICATION_ENABLED',
]);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const denied=(reason)=>Object.freeze({
 status:'HOLD',reason,environment:'WORK',upload_requested:false,
 deployment_requested:false,traffic_changed:false,
 secrets_changed:false,new_billable_resources:false,
 activation_authorized:false
});
export function evaluateConnectedContentInventory({before,after,active,quote,health}={}){
 const b=CONNECTED_CONTENT_BASELINE;
 try{
  if(!before||!isDeepStrictEqual(before,after))
   return denied('unstable_deployment_reads');
  if(before.deployment!==b.deployment||before.versions?.length!==2||
     !before.versions.some(v=>v.id===b.active&&v.percentage===100)||
     !before.versions.some(v=>v.id===b.quote&&v.percentage===0))
   return denied('not_exact_activated_m1m2_baseline');
  if(active?.id!==b.active||quote?.id!==b.quote||
     !Array.isArray(active.resources?.bindings)||
     !Array.isArray(quote.resources?.bindings)||
     !Array.isArray(active.resources?.script?.handlers)||
     !Array.isArray(quote.resources?.script?.handlers))
   return denied('version_metadata_unverified');
  const binding=active.resources.bindings;
  if(binding.length!==14||new Set(binding.map(v=>v.name)).size!==14)
   return denied('unexpected_active_binding_set');
  const map=new Map(binding.map(v=>[v.name,v]));
  for(const [key,value] of Object.entries(REQUIRED))
   if(map.get(key)?.type!=='plain_text'||map.get(key)?.text!==value)
    return denied('required_work_flag_changed');
  for(const key of SAFE_OFF)
   if(map.has(key)&&!(map.get(key)?.type==='plain_text'&&
    map.get(key).text==='false'))return denied('sensitive_feature_enabled');
  for(const key of SECRETS)if(map.get(key)?.type!=='secret_text')
   return denied('secret_presence_unverified');
  if(map.get('JILL_ORDER_DESK_WORK_DB')?.type!=='d1'||
     (map.get('JILL_ORDER_DESK_WORK_DB').id??
      map.get('JILL_ORDER_DESK_WORK_DB').database_id)!==b.d1)
   return denied('existing_work_d1_changed');
  if(map.get('CF_VERSION_METADATA')?.type!=='version_metadata')
   return denied('version_identity_not_bound');
  const known=new Set([...Object.keys(REQUIRED),...SAFE_OFF,
    ...SECRETS,'JILL_ORDER_DESK_WORK_DB','CF_VERSION_METADATA']);
  if(binding.some(v=>!known.has(v.name)||
    !['plain_text','secret_text','d1','version_metadata'].includes(v.type)))
   return denied('unreviewed_binding_present');
  if(active.resources.script.handlers.length!==1||
     active.resources.script.handlers[0]!=='fetch')
   return denied('worker_handler_changed');
  const q=new Map(quote.resources.bindings.map(v=>[v.name,v]));
  if(q.size!==quote.resources.bindings.length||
     q.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED')?.type!=='plain_text'||
     q.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED').text!=='true')
   return denied('historical_quote_canary_changed');
  if(health?.status!==200||health.runtime_version!==b.active||
     health.database_ready!==true)
   return denied('canonical_work_health_failed');
  return Object.freeze({
   status:'READ_ONLY_CONNECTED_CONTENT_BASELINE_VERIFIED',
   source:'authenticated_WORK_provider_metadata',
   environment:'WORK',deployment:b.deployment,
   active_version:b.active,active_percentage:100,
   quote_canary:b.quote,quote_percentage:0,
   preserved_binding_count:binding.length,
   health_verified:true,source_change_deployed:false,
   new_candidate_uploaded:false,upload_requested:false,
   deployment_requested:false,traffic_changed:false,
   secrets_changed:false,new_billable_resources:false,
   activation_authorized:false
  });
 }catch{return denied('inventory_unverified');}
}
function git(...args){return execFileSync('git',['-C',ROOT,...args],{
 encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trim();}
function sourceGuard(){
 if(process.platform!=='win32')throw Error('owner_windows_only');
 const root=fs.realpathSync(ROOT).toLowerCase();
 const temporary=fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep;
 if(!root.startsWith(temporary)||!path.basename(root).startsWith('jill_m1_m2_qa_')||
    git('branch','--show-current')!==BRANCH||
    git('status','--porcelain','--untracked-files=no')!==''||
    git('rev-parse','HEAD')!==git('rev-parse','refs/remotes/origin/'+BRANCH)||
    certifyM1M2SourceEdition().ok!==true)
  throw Error('certified_preview_checkout_required');
}
async function inspect(){
 sourceGuard();
 const pre=currentAllocation(read(['deployments','list']));
 const active=view(CONNECTED_CONTENT_BASELINE.active);
 const quote=view(CONNECTED_CONTENT_BASELINE.quote);
 const health=await readConnectedHealth(CONNECTED_CONTENT_BASELINE.active);
 const post=currentAllocation(read(['deployments','list']));
 return evaluateConnectedContentInventory({before:pre,after:post,
  active,quote,health});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||process.argv[2]!=='--inspect'){
  console.error('STOP only --inspect is supported. No upload or deployment.');
  process.exitCode=1;
 }else{
  try{
   const result=await inspect();
   console.log(JSON.stringify(result,null,2));
   if(result.status!=='READ_ONLY_CONNECTED_CONTENT_BASELINE_VERIFIED')process.exitCode=1;
  }catch{
   console.error(JSON.stringify(denied('source_or_provider_read_unverified')));
   process.exitCode=1;
  }
 }
}
