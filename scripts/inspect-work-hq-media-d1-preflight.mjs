// Preflight for FUTURE WORK media registry migration. READ ONLY.
// Never executes migration SQL, provisions keys or reads customer rows.
// Hard-coded Cloudflare WORK scope. No arbitrary SQL/DB CLI arguments.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion}
  from './deploy-work-hq-inbox-shell.mjs';
import {DETAIL_ON_CANDIDATE}
  from './release-work-hq-detail-v9-on.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONF='./wrangler.canary.jsonc';
const WORKER='jill-order-desk-canary-work';
const DATABASE='jill-order-desk-work';
export const WORK_MEDIA_D1_ID='3f17c186-c794-4e00-8f20-017191373a19';
export const WORK_MEDIA_TABLE='jill_work_private_media_registry';
export const WORK_MEDIA_BASE_TABLES=Object.freeze([
  'jill_merchant_audit',
  'jill_merchant_authority',
  'jill_merchant_grants',
  'jill_shopify_sessions',
  'jill_work_verified_inbox_index',
]);
export const WORK_MEDIA_SCHEMA_SQL=
  "SELECT name,type FROM sqlite_master WHERE type='table' AND name IN ("+
  [...WORK_MEDIA_BASE_TABLES,WORK_MEDIA_TABLE].map(x=>"'"+x+"'").join(',')+
  ") ORDER BY name";
function gate(value,message){if(!value)throw Error(message);}
export function assertWorkMediaD1Config(config){
  const databases=config?.d1_databases;
  gate(config?.name===WORKER &&
    Array.isArray(databases) && databases.length===1 &&
    databases[0]?.binding==='JILL_ORDER_DESK_WORK_DB' &&
    databases[0]?.database_name===DATABASE &&
    databases[0]?.database_id===WORK_MEDIA_D1_ID &&
    databases[0]?.migrations_dir==='../migrations' &&
    config?.vars?.JILL_WORK_HOST_STAGE==='canary' &&
    config?.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false',
    'work_media_d1_local_config_drift');
  return true;
}
export function assertWorkMediaD1AccountList(payload){
  gate(Array.isArray(payload),'cloudflare_d1_inventory_unverifiable');
  const named=payload.filter(x=>x?.name===DATABASE);
  gate(named.length===1 &&
    (named[0]?.uuid===WORK_MEDIA_D1_ID ||
      named[0]?.id===WORK_MEDIA_D1_ID),
    'cloudflare_d1_account_identity_mismatch');
  const sameId=payload.filter(x=>
    x?.uuid===WORK_MEDIA_D1_ID||x?.id===WORK_MEDIA_D1_ID);
  gate(sameId.length===1 && sameId[0]?.name===DATABASE,
    'cloudflare_d1_account_identity_mismatch');
  return Object.freeze({name:DATABASE,id:WORK_MEDIA_D1_ID});
}
export function assertWorkMediaD1Worker(version){
  gate(version?.id===DETAIL_ON_CANDIDATE,
    'work_media_active_version_mismatch');
  const bs=version.resources?.bindings;
  const exact=Array.isArray(bs)?bs.filter(b=>
    b?.name==='JILL_ORDER_DESK_WORK_DB'):[];
  gate(exact.length===1 && exact[0]?.type==='d1' &&
    (exact[0]?.id===WORK_MEDIA_D1_ID ||
     exact[0]?.database_id===WORK_MEDIA_D1_ID),
    'work_media_worker_d1_binding_mismatch');
  const flags=Array.isArray(bs)?bs.filter(b=>
    b?.type==='plain_text'):[];
  const value=k=>flags.filter(b=>b.name===k);
  for(const [key,expected] of Object.entries({
    JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OAUTH_ENABLED:'true',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
    JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
    JILL_WORK_HQ_DETAIL_ENABLED:'true',
  })){
    const found=value(key);
    gate(found.length===1&&found[0].text===expected,
      'work_media_worker_flag_drift');
  }
  return true;
}
export function assertWorkMediaD1Schema(payload){
  const p=Array.isArray(payload)&&payload.length===1?payload[0]:
    (!Array.isArray(payload)?payload:null);
  gate(p?.success===true && Array.isArray(p.results),
    'work_media_schema_query_unverifiable');
  const normalized=p.results.map(x=>x?.name);
  const expected=[...WORK_MEDIA_BASE_TABLES].sort();
  gate(p.results.every(x=>x?.type==='table' &&
    typeof x.name==='string') &&
    normalized.length===expected.length &&
    JSON.stringify([...normalized].sort())===JSON.stringify(expected),
    'work_media_schema_unexpected_or_registry_already_exists');
  return Object.freeze({tables_verified:expected.length,
    registry_absent:true});
}
export function workMediaD1ReadCommand(step){
  switch(step){
    case 'worker_status':
      return ['deployments','status','--name',WORKER,'--config',CONF];
    case 'worker_v34':
      return ['versions','view',DETAIL_ON_CANDIDATE,
        '--name',WORKER,'--config',CONF,'--json'];
    case 'database_list':
      return ['d1','list','--config',CONF,'--json'];
    case 'schema_only':
      return ['d1','execute',DATABASE,'--remote','--config',CONF,
        '--command',WORK_MEDIA_SCHEMA_SQL,'--json'];
    default:
      throw Error('disallowed_work_media_d1_operation');
  }
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8'}).trim();
}
function readCloudflare(step){
  gate(fs.existsSync(BIN),'work_wrangler_not_installed');
  const r=spawnSync(process.execPath,[BIN,...workMediaD1ReadCommand(step)],{
    cwd:APP,shell:false,encoding:'utf8',windowsHide:true,
    maxBuffer:8*1024*1024,
  });
  gate(!r.error&&r.status===0,'cloudflare_metadata_read_failed');
  return String(r.stdout||'');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='start';
  try{
    gate(process.argv.length===3 && process.argv[2]==='--inspect',
      'read_only_mode_required');
    phase='source_integrity';
    gate(git('branch','--show-current')==='jill/rewards-work' &&
      git('rev-parse','HEAD')===
        git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
      !git('status','--porcelain','--untracked-files=no'),
      'work_git_not_synced');
    const migrationDir=path.join(ROOT,'services/jill-order-desk/migrations');
    const filenames=fs.readdirSync(migrationDir).sort();
    gate(JSON.stringify(filenames)===JSON.stringify([
      '0001_staff_authority.sql','0002_shopify_sessions.sql',
      '0003_work_verified_inbox_index.sql',
    ]),'work_media_active_migrations_changed');
    const proposed=path.join(ROOT,
      'services/jill-order-desk/migration-plans/0004_work_private_media_registry.sql');
    gate(fs.existsSync(proposed) &&
      fs.readFileSync(proposed,'utf8').includes(
        'INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION'),
      'work_media_proposal_missing');
    const manifest=JSON.parse(fs.readFileSync(
      path.join(APP,'wrangler.canary.jsonc'),'utf8'));
    assertWorkMediaD1Config(manifest);
    phase='cloudflare_worker_status';
    gate(currentWorkerVersion(readCloudflare('worker_status'))===
      DETAIL_ON_CANDIDATE,'work_media_worker_version_changed');
    phase='cloudflare_worker_binding';
    assertWorkMediaD1Worker(JSON.parse(readCloudflare('worker_v34')));
    phase='cloudflare_d1_inventory';
    assertWorkMediaD1AccountList(JSON.parse(readCloudflare('database_list')));
    phase='remote_schema_metadata';
    const schema=assertWorkMediaD1Schema(
      JSON.parse(readCloudflare('schema_only')));
    // Guard against a concurrent Worker change during metadata inspection.
    phase='worker_status_recheck';
    gate(currentWorkerVersion(readCloudflare('worker_status'))===
      DETAIL_ON_CANDIDATE,'work_media_worker_version_changed');
    console.log('PASS exact WORK canary v34 and exact D1 binding/Cloudflare account database identity.');
    console.log('PASS existing '+schema.tables_verified+' WORK D1 schema tables; registry table ABSENT.');
    console.log('PASS 0004 proposal remains outside active D1 migrations; no dedicated registry MAC key provisioned by this audit.');
    console.log('READ ONLY. No customer rows, keys, D1 changes, Cloudflare traffic switches, Google or Shopify writes.');
    console.log('HOLD: no D1 migration/secret provisioning until separate Owner-approved plan and rollback test.');
  }catch(e){
    const known=new Set([
      'read_only_mode_required','work_git_not_synced',
      'work_media_active_migrations_changed','work_media_proposal_missing',
      'work_media_d1_local_config_drift','work_wrangler_not_installed',
      'cloudflare_metadata_read_failed','work_media_worker_version_changed',
      'work_media_active_version_mismatch',
      'work_media_worker_d1_binding_mismatch',
      'work_media_worker_flag_drift',
      'cloudflare_d1_inventory_unverifiable',
      'cloudflare_d1_account_identity_mismatch',
      'work_media_schema_query_unverifiable',
      'work_media_schema_unexpected_or_registry_already_exists',
    ]);
    console.error('WORK MEDIA D1 PREFLIGHT STOPPED: '+
      (known.has(e?.message)?e.message:'work_media_preflight_unverified'));
    console.error('READ ONLY FAILURE PHASE: '+phase);
    process.exitCode=1;
  }
}
