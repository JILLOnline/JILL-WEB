// JILL WORK — Contact Us D1 release inventory. READ ONLY.
// Never submits tickets, runs migrations, exposes customer rows, stages
// secrets, changes Cloudflare versions, or enables any runtime flag.
// Normal invocation is completely offline. The sole opt-in option
// --owner-readonly runs a fixed SELECT against the existing WORK D1.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const GATEWAY=path.join(ROOT,'services/custom-order-cloudflare/wrangler.toml');
const HQ_CONFIG=path.join(APP,'wrangler.canary.jsonc');
const MIGRATION=path.join(ROOT,'services/jill-order-desk/migrations/0004_work_contact_tickets_source_only.sql');
const WRANGLER=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const DATABASE='jill-order-desk-work';
const DB_ID='3f17c186-c794-4e00-8f20-017191373a19';
const TARGET='jill-order-desk-canary-work';
export const CONTACT_SCHEMA_NAMES=Object.freeze([
 'jill_work_contact_tickets',
 'jill_work_contact_status_events',
 'jill_work_contact_messages',
 'jill_contact_initial_event',
 'jill_contact_status_revision_guard',
 'jill_contact_status_event',
]);
export const READ_ONLY_SQL=`SELECT name,type FROM sqlite_master WHERE name IN (${CONTACT_SCHEMA_NAMES
 .map(x=>"'"+x+"'").join(',')}) ORDER BY name`;

const fail=reason=>{throw Error('work_contact_inventory_'+reason);};
export function inspectSourceConfiguration({hq,gateway,migration}={}){
 if(!hq||hq.name!==TARGET||!Array.isArray(hq.d1_databases)||
   hq.d1_databases.length!==1||
   hq.d1_databases[0].binding!=='JILL_ORDER_DESK_WORK_DB'||
   hq.d1_databases[0].database_name!==DATABASE||
   hq.d1_databases[0].database_id!==DB_ID)fail('hq_binding_mismatch');
 if(typeof gateway!=='string'||gateway.includes('[[d1_databases]]')||
    gateway.includes('JILL_ORDER_DESK_WORK_DB'))
  fail('gateway_private_d1_exposure');
 // Claim CAS lives in the signed backend handler. The migration needs
 // the claim hash, customer field, audit history and message constraints.
 if(typeof migration!=='string'||!CONTACT_SCHEMA_NAMES.every(x=>
   migration.includes(x))||!migration.includes('claim_sha256')||
   !migration.includes('owner_customer_gid'))
  fail('source_migration_mismatch');
 const contactVars=['JILL_WORK_CONTACT_INTAKE_ENABLED',
  'JILL_WORK_CONTACT_ACCOUNT_ENABLED',
  'JILL_WORK_CONTACT_CLAIM_ENABLED',
  'JILL_WORK_CONTACT_THREAD_ENABLED',
  'JILL_WORK_CONTACT_MESSAGES_ENABLED',
  'JILL_WORK_CONTACT_INBOX_ENABLED',
  'JILL_WORK_CONTACT_STATUS_ENABLED'];
 return Object.freeze({hq_binding_source:true,
  gateway_has_no_contact_d1_binding:true,
  source_migration_present:true,
  expected_flags:contactVars});
}
export function inspectRemoteSchemaRows(rows){
 if(!Array.isArray(rows)||rows.length>30)fail('remote_metadata_invalid');
 const names=new Set();
 for(const r of rows){
  if(!r||!CONTACT_SCHEMA_NAMES.includes(r.name)||
    !['table','trigger'].includes(r.type)||names.has(r.name))
   fail('remote_metadata_invalid');
  names.add(r.name);
 }
 const count=names.size;
 return Object.freeze({state:count===0?'unapplied':
   count===CONTACT_SCHEMA_NAMES.length?'present_unverified':'partial_conflict',
   found:CONTACT_SCHEMA_NAMES.filter(x=>names.has(x)),
   missing:CONTACT_SCHEMA_NAMES.filter(x=>!names.has(x))});
}
export function decodeWranglerReadOnlyResult(raw){
 if(typeof raw!=='string'||raw.length>32768)fail('remote_metadata_invalid');
 let parsed;
 try{parsed=JSON.parse(raw);}catch{fail('remote_metadata_invalid');}
 const rows=Array.isArray(parsed)&&parsed.length===1?
   parsed[0]?.results:parsed?.results;
 return inspectRemoteSchemaRows(rows);
}
function readCloudflareSchema(){
 if(!fs.existsSync(WRANGLER))fail('local_wrangler_missing');
 const args=[WRANGLER,'d1','execute',DATABASE,'--remote',
  '--config','./wrangler.canary.jsonc','--command',READ_ONLY_SQL,'--json'];
 if(args.includes('--file')||/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|PRAGMA)\b/i.test(READ_ONLY_SQL))
  fail('non_readonly_query');
 const proc=spawnSync(process.execPath,args,{
  cwd:APP,encoding:'utf8',timeout:45000,maxBuffer:32768,
  stdio:['ignore','pipe','pipe'],
  env:{...process.env,WRANGLER_SEND_METRICS:'false'},
 });
 if(proc.status!==0)fail('authenticated_cloudflare_read_unavailable');
 return decodeWranglerReadOnlyResult(proc.stdout);
}
function main(){
 if(process.argv.slice(2).some(x=>x!=='--owner-readonly')||
    process.argv.slice(2).length>1)fail('unrecognized_argument');
 const hq=JSON.parse(fs.readFileSync(HQ_CONFIG,'utf8'));
 const gateway=fs.readFileSync(GATEWAY,'utf8');
 const migration=fs.readFileSync(MIGRATION,'utf8');
 const source=inspectSourceConfiguration({hq,gateway,migration});
 const report={
  environment:'WORK',kind:'contact_d1_read_only_inventory',
  source,status:'HOLD',
  remote_schema:'unverified',
  active_worker_binding:'unverified',
  shopify_account_jwt_smoke:'unverified',
  customer_messages_enabled:false,
  migration_performed:false,deployment_performed:false,
  approved_paid_services:false,
 };
 if(process.argv.includes('--owner-readonly'))
  report.remote_schema=readCloudflareSchema();
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main();
