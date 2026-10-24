// JILL WORK remote Contact Us 0004 postflight. Strict READ-ONLY schema
// inventory; never queries customer records, submits traffic, applies SQL,
// deploys Workers, restores a bookmark, or accesses secret values.
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectSourceConfiguration}
 from './inspect-work-contact-d1-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const WRANGLER=join(APP,'node_modules/wrangler/bin/wrangler.js');
const DB='jill-order-desk-work';
const MIGRATION='0004_work_contact_tickets_source_only.sql';
const EXPECTED=Object.freeze({
 jill_work_contact_tickets:'table',
 jill_work_contact_status_events:'table',
 jill_work_contact_messages:'table',
 jill_work_contact_tickets_updated:'index',
 jill_work_contact_tickets_account:'index',
 jill_work_contact_messages_by_ticket:'index',
 jill_contact_initial_event:'trigger',
 jill_contact_status_revision_guard:'trigger',
 jill_contact_status_event:'trigger',
});
const PRESERVED=Object.freeze([
 'jill_merchant_audit','jill_merchant_authority','jill_merchant_grants',
 'jill_shopify_sessions','jill_work_quote_draft_operations',
 'jill_work_quote_drafts','jill_work_verified_inbox_index',
]);
const stop=reason=>{throw Error('work_contact_postflight_'+reason);};
const check=(v,reason)=>{if(!v)stop(reason);};
const quote=x=>"'"+x+"'";
export const QUERIES=Object.freeze({
 migration:"SELECT name FROM d1_migrations WHERE name="+quote(MIGRATION),
 objects:"SELECT name,type FROM sqlite_master WHERE name IN ("+
   Object.keys(EXPECTED).map(quote).join(',')+") ORDER BY name",
 preserved:"SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+
   PRESERVED.map(quote).join(',')+") ORDER BY name",
});
function rows(json){
 let parsed;
 try{parsed=JSON.parse(json);}catch{stop('invalid_cloudflare_json');}
 const item=Array.isArray(parsed)&&parsed.length===1?parsed[0]:parsed;
 check(item?.success===true&&Array.isArray(item.results)&&
   item.results.length<=30,'invalid_cloudflare_rows');
 return item.results;
}
function names(input,expected){
 check(Array.isArray(input)&&input.length===expected.length,'schema_missing');
 const observed=new Set();
 for(const r of input){
  check(r&&typeof r==='object'&&
   Object.keys(r).length===1&&expected.includes(r.name)&&
   !observed.has(r.name),'schema_unexpected_or_duplicate');
  observed.add(r.name);
 }
 check(expected.every(n=>observed.has(n)),'schema_missing');
 return true;
}
export function verifyWorkContactPostflight({migration,objects,preserved}={}){
 names(migration,[MIGRATION]);
 const expected=Object.entries(EXPECTED);
 check(Array.isArray(objects)&&objects.length===expected.length,
   'contact_schema_incomplete');
 const seen=new Map();
 for(const r of objects){
  check(r&&typeof r==='object'&&
   Object.keys(r).length===2&&
   Object.hasOwn(EXPECTED,r.name)&&
   EXPECTED[r.name]===r.type&&!seen.has(r.name),
   'contact_schema_unverified');
  seen.set(r.name,r.type);
 }
 names(preserved,PRESERVED);
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  contact_migration_0004:'applied_history_verified',
  contact_schema:'all_3_tables_3_indexes_3_triggers_present',
  preserved_existing_tables:PRESERVED.length,
  private_data_read:false,
  inspection_performed_writes:false,
  deployed_worker_source_verified:false,
  customer_account_verified:false,
  service_binding_approved:false,
  release_authorized:false,
 });
}
function remote(query){
 check(existsSync(WRANGLER),'isolated_wrangler_missing');
 check(Object.values(QUERIES).includes(query)&&
  /^SELECT /i.test(query),'unapproved_sql');
 const args=[WRANGLER,'d1','execute',DB,'--remote',
  '--config','./wrangler.canary.jsonc','--command',query,'--json'];
 const p=spawnSync(process.execPath,args,{
  cwd:APP,encoding:'utf8',windowsHide:true,shell:false,
  timeout:45000,maxBuffer:32768,stdio:['ignore','pipe','pipe'],
  env:{...process.env,WRANGLER_SEND_METRICS:'false'},
 });
 check(!p.error&&!p.signal&&p.status===0,'authenticated_read_unavailable');
 return rows(p.stdout);
}
function sourceScope(){
 const hq=JSON.parse(readFileSync(join(APP,'wrangler.canary.jsonc'),'utf8'));
 const gw=readFileSync(join(ROOT,'services/custom-order-cloudflare/wrangler.toml'),'utf8');
 const sql=readFileSync(join(ROOT,'services/jill-order-desk/migrations',MIGRATION),'utf8');
 inspectSourceConfiguration({hq,gateway:gw,migration:sql});
 for(const name of Object.keys(EXPECTED))check(sql.includes(name),
  'migration_source_unverified');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  check(process.argv.length===2||
   (process.argv.length===3&&process.argv[2]==='--owner-readonly'),
   'unsupported_mode');
  sourceScope();
  if(process.argv.length===2){
   console.log(JSON.stringify({environment:'WORK',status:'HOLD',
    source_scope:'verified',remote_postflight:'unverified',
    remote_queries_executed:0},null,2));
  }else{
   const result=verifyWorkContactPostflight({
    migration:remote(QUERIES.migration),
    objects:remote(QUERIES.objects),
    preserved:remote(QUERIES.preserved),
   });
   console.log(JSON.stringify(result,null,2));
  }
 }catch(e){
  console.error('HOLD '+(e?.message?.startsWith('work_contact_postflight_')
   ?e.message:'work_contact_postflight_unavailable'));
  process.exitCode=1;
 }
}
