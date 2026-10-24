// WORK-only, owner-initiated Cloudflare deployment and binding inspection.
// No customer payloads, D1 SELECT, Shopify API, credentials, mutation,
// deployment, migration, secret rotation, traffic change or release approval.
// Default mode uses source files ONLY; --owner-readonly performs metadata GETs.
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HQ=join(ROOT,'services/jill-order-desk/app-home');
const GATEWAY=join(ROOT,'services/custom-order-cloudflare');
const CLI=join(HQ,'node_modules/wrangler/bin/wrangler.js');
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const FLAGS=Object.freeze({
 hq:['JILL_WORK_CONTACT_INBOX_ENABLED','JILL_WORK_CONTACT_STATUS_ENABLED',
  'JILL_WORK_CONTACT_MESSAGES_ENABLED'],
 gateway:['JILL_WORK_CONTACT_INTAKE_ENABLED',
  'JILL_WORK_CONTACT_ACCOUNT_ENABLED','JILL_WORK_CONTACT_CLAIM_ENABLED',
  'JILL_WORK_CONTACT_THREAD_ENABLED'],
});
const TARGET=Object.freeze({
 hq:{name:'jill-order-desk-canary-work',config:'./wrangler.canary.jsonc',
  cwd:HQ},
 gateway:{name:'jill-work-custom-orders-qa',config:'./wrangler.toml',
  cwd:GATEWAY},
});
const stop=reason=>{throw Error('work_contact_runtime_'+reason);};
const ensure=(condition,reason)=>{if(!condition)stop(reason);};
export function verifyRuntimeSource(hq,gateway){
 ensure(hq?.name===TARGET.hq.name&&
  hq.vars?.JILL_WORK_HOST_STAGE==='canary'&&
  hq.d1_databases?.length===1&&
  hq.d1_databases[0].binding==='JILL_ORDER_DESK_WORK_DB'&&
  hq.d1_databases[0].database_id===D1,'hq_source_scope_mismatch');
 ensure(typeof gateway==='string'&&
  /^name = "jill-work-custom-orders-qa"$/m.test(gateway)&&
  !gateway.includes('JILL_ORDER_DESK_WORK_DB')&&
  !gateway.includes('[[d1_databases]]'),'gateway_source_scope_mismatch');
 return {hq:'correct_WORK_canary_source',gateway:'isolated_WORK_gateway_source'};
}
// Cloudflare deployments inventory may include preserved inactive versions;
// verify exactly ONE 100% active version and refuse splits/unstable snapshots.
export function current100Version(input){
 const items=Array.isArray(input)?input:input?.deployments??input?.result?.deployments;
 ensure(Array.isArray(items)&&items.length>=1&&items.length<=50,
  'deployment_inventory_invalid');
 const entries=items.map(d=>{
  ensure(UUID.test(d?.id||'')&&
   Number.isFinite(Date.parse(d?.created_on||''))&&
   Array.isArray(d.versions)&&d.versions.length>=1&&d.versions.length<=2,
   'deployment_inventory_invalid');
  const versions=d.versions;
  ensure(versions.every(v=>UUID.test(v?.version_id||'')&&
    Number.isFinite(v.percentage)&&v.percentage>=0&&v.percentage<=100)&&
    new Set(versions.map(v=>v.version_id)).size===versions.length&&
    versions.reduce((n,v)=>n+v.percentage,0)===100,
    'deployment_split_or_invalid');
  return {id:d.id,when:Date.parse(d.created_on),versions};
 }).sort((a,b)=>b.when-a.when);
 ensure(entries.length===1||entries[0].when>entries[1].when,
  'deployment_ambiguous');
 const current=entries[0];
 const on=current.versions.filter(x=>x.percentage===100);
 ensure(on.length===1&&current.versions.every(x=>
  x.percentage===100||x.percentage===0),
  'deployment_split_or_invalid');
 return Object.freeze({deployment:current.id,active:on[0].version_id,
  allocation:current.versions.map(v=>({id:v.version_id,pct:v.percentage}))});
}
export function verifyWorkActiveBindings(which,current,view){
 ensure(Object.hasOwn(TARGET,which)&&UUID.test(current?.active||'')&&
  view?.id===current.active&&Array.isArray(view?.resources?.bindings)&&
  view.resources.bindings.length<=60,'active_version_unverified');
 const bindings=view.resources.bindings;
 const map=new Map();
 for(const entry of bindings){
  ensure(typeof entry?.name==='string'&&entry.name&&
   typeof entry?.type==='string'&&entry.type&&!map.has(entry.name),
   'binding_metadata_invalid');
  map.set(entry.name,entry);
 }
 for(const flag of FLAGS[which]){
  const b=map.get(flag);
  ensure(!b||(b.type==='plain_text'&&b.text==='false'),
    'contact_feature_enabled_or_unverified');
 }
 if(which==='hq'){
  const db=map.get('JILL_ORDER_DESK_WORK_DB');
  ensure(db?.type==='d1'&&(db.id===D1||db.database_id===D1),
   'active_hq_work_d1_binding_unverified');
  ensure(map.get('JILL_WORK_HOST_STAGE')?.type==='plain_text'&&
   map.get('JILL_WORK_HOST_STAGE')?.text==='canary'&&
   map.get('JILL_WORK_OAUTH_ENABLED')?.type==='plain_text'&&
   map.get('JILL_WORK_OAUTH_ENABLED')?.text==='true',
   'active_hq_canary_stage_unverified');
 }else{
  ensure(![...map.values()].some(b=>
   b.type==='d1'||b.name==='JILL_ORDER_DESK_WORK_DB'),
   'public_gateway_has_private_d1');
  ensure(map.get('RATE_LIMITER')&&
   map.get('SHOPIFY_WORK_APP_SECRET')?.type==='secret_text'&&
   map.get('JILL_CUSTOM_ORDER_GATEWAY_SECRET')?.type==='secret_text',
   'active_gateway_safety_bindings_unverified');
 }
 return Object.freeze({
  active_version:current.active,
  deployment:current.deployment,
  contact_flags_present:FLAGS[which].filter(k=>map.has(k)),
  contact_flags_enabled:false,
  correct_work_bindings_observed:true,
  secret_values_read:false,
  published_source_commit_verified:false,
 });
}
export async function inspectActiveContactRuntime({readMetadata}={}){
 ensure(typeof readMetadata==='function','metadata_reader_missing');
 const readings={};
 // Each Worker: allocation A, exact 100% version, allocation B.
 // The metadata reader must reject any failed operation, never use cache.
 for(const which of ['hq','gateway']){
  const first=current100Version(await readMetadata(which,'deployments'));
  const view=await readMetadata(which,'version',first.active);
  const again=current100Version(await readMetadata(which,'deployments'));
  ensure(JSON.stringify(first)===JSON.stringify(again),
   'deployment_changed_during_inspection');
  readings[which]=verifyWorkActiveBindings(which,first,view);
 }
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  reason:'runtime_identity_only_no_release_authorization',
  ...readings,real_customer_account_verified:false,
  contact_pipeline_active:false,
  contact_schema_reapplied:false,
  operations_performed:'metadata_read_only',
 });
}
function command(which,mode,id){
 ensure(Object.hasOwn(TARGET,which),'unknown_worker');
 ensure(existsSync(CLI),'isolated_work_wrangler_missing');
 const t=TARGET[which];
 const args=mode==='deployments'
  ?['deployments','list','--name',t.name,'--config',t.config,'--json']
  :['versions','view',id,'--name',t.name,'--config',t.config,'--json'];
 ensure(mode==='deployments'||(mode==='version'&&UUID.test(id||'')),
  'unapproved_metadata_operation');
 const p=spawnSync(process.execPath,[CLI,...args],{
  cwd:t.cwd,encoding:'utf8',windowsHide:true,shell:false,
  stdio:['ignore','pipe','pipe'],timeout:45000,
  maxBuffer:4*1024*1024,
  env:{...process.env,WRANGLER_SEND_METRICS:'false'},
 });
 ensure(!p.error&&!p.signal&&p.status===0,'cloudflare_metadata_unavailable');
 try{return JSON.parse(p.stdout);}catch{stop('cloudflare_metadata_invalid');}
}
async function main(){
 ensure(process.argv.length===2||
  (process.argv.length===3&&process.argv[2]==='--owner-readonly'),
  'unsupported_mode');
 const hq=JSON.parse(readFileSync(join(HQ,'wrangler.canary.jsonc'),'utf8'));
 const gateway=readFileSync(join(GATEWAY,'wrangler.toml'),'utf8');
 const source=verifyRuntimeSource(hq,gateway);
 if(process.argv.length===2){
  console.log(JSON.stringify({environment:'WORK',source,
   status:'HOLD',active_versions:'unverified',
   contact_flags:'unverified',commands_run:'none'},null,2));
  return;
 }
 const result=await inspectActiveContactRuntime({
  readMetadata:async(which,mode,id)=>command(which,mode,id),
 });
 console.log(JSON.stringify({source,...result},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(e){
  console.error('HOLD '+(e?.message?.startsWith('work_contact_runtime_')
   ?e.message:'work_contact_runtime_unavailable'));
  process.exitCode=1;
 }
}
