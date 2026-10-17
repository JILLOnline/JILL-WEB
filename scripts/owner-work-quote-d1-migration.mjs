// JILL HQ WORK quote D1 owner operator — preflight / private backup / apply.
// This is NOT a GitHub Action. Only the Owner Windows machine with their
// authenticated Cloudflare Wrangler may perform remote operations.
// Absolute scope: exactly WORK DB + two table DDLs, no LIVE/KEEP,
// Shopify/Google commands, R2, billing changes, Worker uploads or traffic.
// --inspect is read only; --backup exports to private LOCAL file;
// --apply requires a recent verified backup and explicit Free-tier review.
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync,statSync} from 'node:fs';
import {resolve,join,isAbsolute,relative,sep} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const CONF=join(APP,'wrangler.canary.jsonc');
const BIN=join(APP,'node_modules/wrangler/bin/wrangler.js');
const SQL=join(ROOT,'services/jill-order-desk/quote-proposals/0008_work_quote_drafts.sql');
const DB='jill-order-desk-work';
const DB_ID='3f17c186-c794-4e00-8f20-017191373a19';
const WORKER='jill-order-desk-canary-work';
const WORK_VERSION='4973b74d-d479-41da-897c-e36129303279';
const TABLES=Object.freeze([
  'jill_work_quote_drafts','jill_work_quote_draft_operations',
]);
const BASE=Object.freeze([
  'jill_merchant_audit','jill_merchant_authority',
  'jill_merchant_grants','jill_shopify_sessions',
  'jill_work_verified_inbox_index',
]);
const MAX_DB=32*1024*1024;  // conservative Owner backup cap, NOT plan limit
const MAX_EXPORT=64*1024*1024;
const MAX_BACKUP_AGE_MS=2*60*60*1000;
const CONFIRM='--free-tier-reviewed';
const STOP=code=>{throw Error('jill_work_quote_d1_'+code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:4096,
  }).trim();}catch{STOP('git_unavailable');}
}
export function checkMigrationSql(content){
  if(typeof content!=='string'||content.length>12000)STOP('sql_unrecognized');
  const sql=content.replace(/^--[^\r\n]*(?:\r?\n|$)/gm,'').trim();
  const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);
  if(statements.length!==2||
     !/^CREATE TABLE IF NOT EXISTS jill_work_quote_drafts\s*\(/i.test(statements[0])||
     !/^CREATE TABLE IF NOT EXISTS jill_work_quote_draft_operations\s*\(/i.test(statements[1])||
     statements.some(s=>/\b(?:DROP|ALTER|DELETE|UPDATE|REPLACE|ATTACH|DETACH|VACUUM|PRAGMA|INSERT|TRIGGER)\b/i.test(s))||
     !/PRIMARY KEY\(shop,submission_id\)/.test(statements[0])||
     !/PRIMARY KEY\(shop,operation_id\)/.test(statements[1])||
     !/FOREIGN KEY\(shop,submission_id\)/.test(statements[1])||
     !/WITHOUT ROWID$/i.test(statements[0])||
     !/WITHOUT ROWID$/i.test(statements[1]))
    STOP('sql_unrecognized');
  return Object.freeze({sha256:sha(Buffer.from(content,'utf8')),count:2});
}
export function parseD1AccountInventory(data){
  const list=Array.isArray(data)?data:
    (Array.isArray(data?.result)?data.result:null);
  if(!list)STOP('account_inventory_unverifiable');
  const matches=list.filter(x=>x?.name===DB);
  const ids=list.filter(x=>
    x?.uuid===DB_ID||x?.id===DB_ID);
  if(matches.length!==1||ids.length!==1||matches[0]!==ids[0])
    STOP('database_identity_mismatch');
  return Object.freeze({database:DB,id:DB_ID});
}
export function parseD1Info(data){
  const info=data?.result && !Array.isArray(data?.result)?data.result:data;
  if(!info||info.uuid!==DB_ID||info.name!==DB||
     !Number.isSafeInteger(info.file_size)||info.file_size<0||
     info.file_size>MAX_DB)
    STOP('database_info_or_size_unverified');
  return Object.freeze({database_bytes:info.file_size});
}
export function parseD1Schema(data,{after=false}={}){
  const p=Array.isArray(data)&&data.length===1?data[0]:
    (!Array.isArray(data)?data:null);
  if(!p||p.success!==true||!Array.isArray(p.results)||
     p.results.length>32||
     p.results.some(x=>typeof x?.name!=='string'||
       x.type!=='table'||!x.name.startsWith('jill_'))||
     new Set(p.results.map(x=>x.name)).size!==p.results.length)
    STOP('schema_unverifiable');
  const names=p.results.map(x=>x.name);
  if(!BASE.filter(x=>x!=='jill_work_verified_inbox_index')
      .every(x=>names.includes(x))||
     names.some(n=>![...BASE,...TABLES].includes(n)))
    STOP('unexpected_work_schema');
  for(const t of TABLES)
    if(names.includes(t)!==after)
      STOP(after?'quote_schema_missing_or_partial':'quote_schema_already_present');
  return Object.freeze({
    core_tables_present:names.filter(x=>BASE.includes(x)).length,
    quote_tables_present:names.filter(x=>TABLES.includes(x)).length,
    inbox_index_present:names.includes('jill_work_verified_inbox_index'),
  });
}
export function parseEmptyQuotes(data){
  const p=Array.isArray(data)&&data.length===1?data[0]:data;
  if(p?.success!==true||p.results?.length!==1||
     !Number.isSafeInteger(p.results[0]?.drafts)||
     !Number.isSafeInteger(p.results[0]?.operations)||
     p.results[0].drafts!==0||p.results[0].operations!==0)
    STOP('new_tables_not_empty');
  return true;
}
export function inspectBackupManifest(manifest,{now,gitHead,sqlSha,bytes,digest}={}){
  if(!manifest||manifest.version!==1||manifest.database!==DB||
     manifest.database_id!==DB_ID||manifest.git_head!==gitHead||
     manifest.proposal_sha256!==sqlSha||
     manifest.backup_sha256!==digest||
     manifest.backup_bytes!==bytes||
     !Number.isSafeInteger(manifest.saved_at_ms)||
     now-manifest.saved_at_ms<0||
     now-manifest.saved_at_ms>MAX_BACKUP_AGE_MS||
     !manifest.free_tier_review_required)
    STOP('backup_manifest_mismatch');
  return true;
}
function checkWorkSource(){
  if(git('branch','--show-current')!=='jill/rewards-work'||
     git('rev-parse','HEAD')!==
       git('rev-parse','refs/remotes/origin/jill/rewards-work')||
     git('status','--porcelain','--untracked-files=no'))
    STOP('checkout_not_clean_and_synced');
  const config=JSON.parse(readFileSync(CONF,'utf8'));
  if(config.name!==WORKER||
     config.vars?.JILL_WORK_HOST_STAGE!=='canary'||
     config.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED!=='false'||
     !Array.isArray(config.d1_databases)||
     config.d1_databases.length!==1||
     config.d1_databases[0]?.binding!=='JILL_ORDER_DESK_WORK_DB'||
     config.d1_databases[0]?.database_name!==DB||
     config.d1_databases[0]?.database_id!==DB_ID||
     config.d1_databases[0]?.migrations_dir!=='../migrations')
    STOP('work_manifest_changed');
  if(!existsSync(BIN)||!existsSync(SQL))STOP('required_local_file_missing');
  return {gitHead:git('rev-parse','HEAD'),
    proposal:checkMigrationSql(readFileSync(SQL,'utf8'))};
}
function wrangler(args,{timeout=65000,maxBuffer=256*1024}={}){
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,shell:false,encoding:'utf8',windowsHide:true,
    timeout,maxBuffer,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  if(r.status!==0||r.error||r.signal)
    STOP('cloudflare_request_failed');
  return r.stdout;
}
function json(args){
  try{return JSON.parse(wrangler(args));}
  catch{STOP('cloudflare_json_unverifiable');}
}
function readSchema(){
  return parseD1Schema(json(['d1','execute',DB,'--remote',
    '--config','./wrangler.canary.jsonc','--json','--command',
    "SELECT name,type FROM sqlite_master WHERE type='table' AND name GLOB 'jill_*' ORDER BY name"]));
}
function metadata({after=false}={}){
  parseD1AccountInventory(json(['d1','list','--config',
    './wrangler.canary.jsonc','--json']));
  const info=parseD1Info(json(['d1','info',DB,'--config',
    './wrangler.canary.jsonc','--json']));
  const schema=parseD1Schema(json(['d1','execute',DB,'--remote',
    '--config','./wrangler.canary.jsonc','--json','--command',
    "SELECT name,type FROM sqlite_master WHERE type='table' AND name GLOB 'jill_*' ORDER BY name"]),{after});
  return {...info,...schema};
}
function checkVersion(){
  // Narrow metadata read: never deploy, never fetch private request data.
  const stdout=wrangler(['deployments','status','--name',WORKER,
    '--config','./wrangler.canary.jsonc']);
  try{
    if(currentWorkerVersion(stdout)!==WORK_VERSION)
      STOP('work_version_unverified');
  }catch{STOP('work_version_unverified');}
}
function privateDirectory(){
  if(process.platform!=='win32'||!process.env.LOCALAPPDATA)
    STOP('owner_windows_required');
  const dir=resolve(process.env.LOCALAPPDATA,
    'JILL-WEB','private-d1-backups','work-quote');
  const resolved=resolve(ROOT);
  if(dir===resolved||dir.startsWith(resolved+sep))
    STOP('unsafe_backup_location');
  mkdirSync(dir,{recursive:true,mode:0o700});
  for(let p=dir;;p=resolve(p,'..')){
    if(existsSync(p)&&lstatSync(p).isSymbolicLink())
      STOP('backup_symlink_untrusted');
    if(p===resolve(p,'..'))break;
  }
  return dir;
}
function paths(){
  const dir=privateDirectory();
  return {backup:join(dir,'jill-work-before-quote-d1.sql'),
    manifest:join(dir,'jill-work-before-quote-d1.manifest.json')};
}
function ensureBackupFile({backup,manifest,gitHead,sqlSha}){
  if(!existsSync(backup)||!existsSync(manifest)||
     lstatSync(backup).isSymbolicLink()||
     lstatSync(manifest).isSymbolicLink())STOP('private_backup_missing');
  const size=statSync(backup).size;
  if(size<100||size>MAX_EXPORT)STOP('private_backup_invalid');
  const digest=sha(readFileSync(backup)); // no content printed
  const data=JSON.parse(readFileSync(manifest,'utf8'));
  inspectBackupManifest(data,{now:Date.now(),gitHead,
    sqlSha,bytes:size,digest});
  return {bytes:size,digest};
}
function requiredArgs(args){
  const commands={
    '--inspect':[],
    '--backup':[CONFIRM],
    '--apply':[CONFIRM],
    '--verify':[],
  };
  const cmd=args[0];
  if(!Object.hasOwn(commands,cmd)||
     args.length!==1+commands[cmd].length||
     args.slice(1).some((x,i)=>x!==commands[cmd][i]))
    STOP('unapproved_mode_or_missing_free_plan_review');
  return cmd;
}
const own=process.argv[1] &&
  resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(own){
  let phase='arguments';
  try{
    const mode=requiredArgs(process.argv.slice(2));
    phase='source_review';
    const source=checkWorkSource();
    phase='worker_version';
    checkVersion();
    phase='cloudflare_read_only_metadata';
    const before=metadata({after:mode==='--verify'});
    if(mode==='--inspect'){
      console.log('PASS WORK QUOTE D1 READ ONLY: exact WORK database identity, pinned Worker version and baseline schema.');
      console.log('WORK D1 bytes: '+before.database_bytes+
        '; core tables: '+before.core_tables_present+
        '; quote tables: 0; inbox index present: '+before.inbox_index_present+'.');
      console.log('HOLD COST GATE: Wrangler metadata cannot verify Workers Free billing tier, account-wide D1 usage or remaining daily rows. Check Cloudflare billing + D1 Metrics before backup/apply.');
      console.log('READ ONLY: No export, customer rows, schema change, paid service, Worker upload, LIVE or KEEP.');
    }else if(mode==='--backup'){
      phase='local_private_backup';
      const target=paths();
      if(existsSync(target.backup)||existsSync(target.manifest))
        STOP('backup_exists_no_overwrite');
      wrangler(['d1','export',DB,'--remote','--config',
        './wrangler.canary.jsonc','--skip-confirmation',
        '--output',target.backup],{timeout:180000,maxBuffer:64*1024});
      if(!existsSync(target.backup)||lstatSync(target.backup).isSymbolicLink())
        STOP('export_failed_or_unsafe');
      const size=statSync(target.backup).size;
      if(size<100||size>MAX_EXPORT)STOP('export_invalid_size');
      const digest=sha(readFileSync(target.backup));
      phase='post_backup_read_only_check';
      checkVersion();
      metadata();
      writeFileSync(target.manifest,JSON.stringify({
        version:1,database:DB,database_id:DB_ID,
        git_head:source.gitHead,proposal_sha256:source.proposal.sha256,
        backup_sha256:digest,backup_bytes:size,saved_at_ms:Date.now(),
        free_tier_review_required:true,
      },null,2),{encoding:'utf8',mode:0o600,flag:'wx'});
      console.log('PASS WORK QUOTE D1 PRIVATE BACKUP: '+size+
        ' bytes; SHA256 '+digest+'.');
      console.log('PRIVATE LOCAL ONLY: '+target.backup);
      console.log('HOLD: full SQL export may contain sensitive customer/session data. Never paste/upload/commit it; verify Windows file ACL and retain it privately.');
      console.log('NO D1 SCHEMA WRITE YET. Running --apply separately requires recent backup and confirmed Free billing tier/usage.');
    }else if(mode==='--apply'){
      phase='backup_integrity';
      const target=paths();
      const proof=ensureBackupFile({...target,
        gitHead:source.gitHead,sqlSha:source.proposal.sha256});
      if(before.quote_tables_present!==0)
        STOP('quote_schema_already_present');
      phase='one_approved_work_only_sql_file';
      wrangler(['d1','execute',DB,'--remote','--config',
        './wrangler.canary.jsonc','--file',
        '../quote-proposals/0008_work_quote_drafts.sql','--yes'],
        {timeout:120000,maxBuffer:64*1024});
      phase='post_apply_read_only_verification';
      checkVersion();
      metadata({after:true});
      parseEmptyQuotes(json(['d1','execute',DB,'--remote',
        '--config','./wrangler.canary.jsonc','--json','--command',
        'SELECT (SELECT COUNT(*) FROM jill_work_quote_drafts) AS drafts, (SELECT COUNT(*) FROM jill_work_quote_draft_operations) AS operations']));
      console.log('PASS WORK QUOTE D1 SCHEMA: precisely two empty WORK draft tables installed.');
      console.log('BACKUP VERIFIED: '+proof.bytes+' private local bytes, SHA256 '+proof.digest+'.');
      console.log('NO Worker deploy, traffic change, quote customer data, Google, Shopify, R2, LIVE/KEEP or plan upgrade.');
    }else{
      // Explicit independent read-only verification after one-shot apply.
      phase='schema_and_empty_counts';
      parseEmptyQuotes(json(['d1','execute',DB,'--remote',
        '--config','./wrangler.canary.jsonc','--json','--command',
        'SELECT (SELECT COUNT(*) FROM jill_work_quote_drafts) AS drafts, (SELECT COUNT(*) FROM jill_work_quote_draft_operations) AS operations']));
      console.log('PASS WORK QUOTE D1 READ ONLY: both new quote tables present and empty, original WORK baseline intact.');
      console.log('No source, customer, app, traffic or billing change.');
    }
  }catch(error){
    const msg=String(error?.message||'');
    const sanitized=/^jill_work_quote_d1_[a-z0-9_]+$/.test(msg)?msg:
      'jill_work_quote_d1_unverified';
    console.error('STOP WORK QUOTE D1: '+sanitized+
      ' at '+phase+'. No automatic retry or rollback.');
    process.exitCode=1;
  }
}
