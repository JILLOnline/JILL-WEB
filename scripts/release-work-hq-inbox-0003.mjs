// JILL HQ WORK: explicitly OWNER-INVOKED migration 0003 release, Windows only.
// --inspect is READ ONLY. --apply is an INTERACTIVE owner-directed D1 WRITE
// with fresh preflights, user confirmation, DPAPI-protected recovery bookmark,
// exactly one pending migration, and separate READ ONLY postflight.
// NEVER an automatic deploy, rollback, secret rotation, or media migration.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {
  assertWork0003ReadOnlyBaseline,
  assertWork0003Bookmark,
  work0003RecoveryReadArgs,
  assertWork0003D1Info,
} from './inspect-work-hq-0003-recovery-readiness.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const WRANGLER=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const BASELINE=path.join(ROOT,'scripts/inspect-work-hq-media-d1-preflight.mjs');
const CONF='./wrangler.canary.jsonc';
const DB='jill-order-desk-work';
const DB_ID='3f17c186-c794-4e00-8f20-017191373a19';
const WORKER='jill-order-desk-canary-work';
const MIGRATIONS=path.join(ROOT,'services/jill-order-desk/migrations');
const ONLY=[
  '0001_staff_authority.sql',
  '0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
];
const INDEX='jill_work_verified_inbox_index';
const REGISTRY='jill_work_private_media_registry';
export const WORK_0003_APPROVAL='APPLY JILL WORK D1 0003 ONLY';
export const WORK_0003_POST_SEED_SQL=
  'SELECT shop,generation,verified_payload_json,verified_at_ms,expires_at_ms '+
  'FROM jill_work_verified_inbox_index ORDER BY shop';
export const WORK_0003_POST_SCHEMA_SQL=
  "SELECT name FROM sqlite_master WHERE type='table' "+
  "AND name GLOB 'jill_*' ORDER BY name";
export const WORK_0003_POST_LEDGER_SQL=
  'SELECT name FROM d1_migrations ORDER BY name';
const fail=(code)=>{throw Error(code);};

export function work0003ReleaseCommand(step){
  const prefix=['d1','execute',DB,'--remote','--config',CONF];
  switch(step){
    case 'post_seed': return [...prefix,'--command',WORK_0003_POST_SEED_SQL,'--json'];
    case 'post_schema':return [...prefix,'--command',WORK_0003_POST_SCHEMA_SQL,'--json'];
    case 'post_ledger':return [...prefix,'--command',WORK_0003_POST_LEDGER_SQL,'--json'];
    // Only this specific action is permitted for the apply path. Never
    // accept arbitrary filenames, SQL, databases, Wrangler flags or args.
    case 'apply_0003':
      return ['d1','migrations','apply',DB,'--remote','--config',CONF];
    default:fail('work_0003_disallowed_operation');
  }
}
export function assertWork0003FileState({
  files,sql,config,fastFlagSource,
}={}){
  if(JSON.stringify(files)!==JSON.stringify(ONLY) ||
    !sql?.includes('CREATE TABLE IF NOT EXISTS '+INDEX) ||
    !sql?.includes('INSERT INTO '+INDEX) ||
    (sql.match(/\bCREATE TABLE\b/gi)||[]).length!==1 ||
    (sql.match(/\bINSERT INTO\b/gi)||[]).length!==1 ||
    !config||config.name!==WORKER ||
    config.d1_databases?.length!==1 ||
    config.d1_databases[0].database_id!==DB_ID ||
    config.d1_databases[0].database_name!==DB ||
    config.d1_databases[0].migrations_dir!=='../migrations' ||
    config.vars?.JILL_WORK_HOST_STAGE!=='canary' ||
    config.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED!=='false' ||
    Object.hasOwn(config.vars||{},'JILL_WORK_HQ_FAST_INBOX_ENABLED') ||
    typeof fastFlagSource!=='string'||
    !fastFlagSource.includes('if(!fast)return await readGoogle()'))
    fail('work_0003_migration_source_drift');
  return Object.freeze({
    only_pending:'0003_work_verified_inbox_index.sql',
    sha256:createHash('sha256').update(sql).digest('hex'),
    fast_inbox:'off',
  });
}
export function assertWork0003Postflight({schema,ledger,seed}={}){
  function rows(payload){
    const p=Array.isArray(payload)&&payload.length===1?payload[0]:
      !Array.isArray(payload)?payload:null;
    if(p?.success!==true||!Array.isArray(p.results)||
      p.meta?.changed_db!==false||p.meta?.rows_written!==0)
      fail('work_0003_postflight_read_invalid');
    return p.results;
  }
  const names=rows(schema).map(x=>{
    if(Object.keys(x||{}).length!==1||typeof x.name!=='string')
      fail('work_0003_postflight_schema_invalid');
    return x.name;
  });
  if(JSON.stringify(names)!==JSON.stringify([
    'jill_merchant_audit','jill_merchant_authority',
    'jill_merchant_grants','jill_shopify_sessions',INDEX,
  ]))fail('work_0003_postflight_schema_invalid');
  const migrations=rows(ledger).map(x=>{
    if(Object.keys(x||{}).length!==1||typeof x.name!=='string')
      fail('work_0003_postflight_ledger_invalid');
    return x.name;
  });
  if(JSON.stringify(migrations)!==JSON.stringify(ONLY))
    fail('work_0003_postflight_ledger_invalid');
  const seedRows=rows(seed);
  if(seedRows.length!==1)fail('work_0003_postflight_seed_invalid');
  const value=seedRows[0];
  if(!value||Object.keys(value).length!==5 ||
    value.shop!=='jill-work.myshopify.com' ||
    value.generation!==0 ||
    value.verified_payload_json!==null ||
    value.verified_at_ms!==0||
    value.expires_at_ms!==0)
    fail('work_0003_postflight_seed_invalid');
  return Object.freeze({
    tables_verified:5,migrations_verified:3,
    initial_index_rows:1,fast_inbox:'off',
  });
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function gitGuard(){
  if(git('branch','--show-current')!=='jill/rewards-work' ||
    git('rev-parse','HEAD')!==git('rev-parse',
      'refs/remotes/origin/jill/rewards-work') ||
    git('status','--porcelain','--untracked-files=no'))
    fail('work_0003_git_unverified');
  return git('rev-parse','HEAD');
}
function inspectLocal(){
  if(!fs.existsSync(WRANGLER))fail('work_0003_wrangler_missing');
  const config=JSON.parse(fs.readFileSync(path.join(APP,
    'wrangler.canary.jsonc'),'utf8'));
  const files=fs.readdirSync(MIGRATIONS).sort();
  const sql=fs.readFileSync(path.join(MIGRATIONS,ONLY[2]),'utf8');
  const fastFlagSource=fs.readFileSync(path.join(ROOT,
    'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts'),'utf8');
  return assertWork0003FileState({files,sql,config,fastFlagSource});
}
function call(program,args,{
  cwd=ROOT,stdio='pipe',input,timeout=60000,
}={}){
  const p=spawnSync(program,args,{
    cwd,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:8*1024*1024,stdio,input,timeout,
  });
  if(p.error||p.status!==0)
    fail('work_0003_command_failed');
  return String(p.stdout||'');
}
function readBaseline(){
  const s=call(process.execPath,[BASELINE,'--inspect']);
  assertWork0003ReadOnlyBaseline(s);
  return true;
}
function wranglerJson(args){
  let value;
  try{
    value=JSON.parse(call(process.execPath,[WRANGLER,...args],{cwd:APP}));
  }catch{fail('work_0003_remote_json_invalid');}
  return value;
}
function recoveryCapability(){
  const info=wranglerJson(work0003RecoveryReadArgs('database_info'));
  assertWork0003D1Info(info);
  const data=wranglerJson(work0003RecoveryReadArgs('time_travel_current'));
  assertWork0003Bookmark(data);
  // Pull the opaque bookmark into process memory ONLY, not args or logs.
  const bookmark=data?.result?.bookmark??data?.bookmark;
  if(typeof bookmark!=='string')fail('work_0003_bookmark_not_found');
  return bookmark;
}
export function encryptForCurrentWindowsUser(text){
  if(process.platform!=='win32')fail('work_0003_windows_dpapi_required');
  // Use native Windows .NET DPAPI. PowerShell's Microsoft.PowerShell.Security
  // module is not guaranteed to auto-load on the Windows CI runner.
  // Password/keys remain owned by the current user's Windows profile.
  const script=[
    '$ErrorActionPreference="Stop"',
    '$raw=[Console]::In.ReadToEnd()',
    '$bytes=[Text.Encoding]::UTF8.GetBytes($raw)',
    '$blob=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::Out.Write([Convert]::ToBase64String($blob))',
  ].join(';');
  const encrypted=call('powershell.exe',
    ['-NoProfile','-NonInteractive','-Command',script],
    {input:text,timeout:20000}).trim();
  if(!/^[A-Za-z0-9+/]{64,2048}={0,2}$/.test(encrypted))
    fail('work_0003_dpapi_encryption_unverified');
  return encrypted;
}
export function decryptForVerification(cipher){
  if(process.platform!=='win32')fail('work_0003_windows_dpapi_required');
  const script=[
    '$ErrorActionPreference="Stop"',
    '$encoded=[Console]::In.ReadToEnd()',
    '$blob=[Convert]::FromBase64String($encoded)',
    '$plain=[Security.Cryptography.ProtectedData]::Unprotect($blob,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))',
  ].join(';');
  return call('powershell.exe',
    ['-NoProfile','-NonInteractive','-Command',script],
    {input:cipher,timeout:20000});
}
function savePrivateCheckpoint(bookmark,head){
  if(!process.env.LOCALAPPDATA||
    !path.isAbsolute(process.env.LOCALAPPDATA))
    fail('work_0003_localappdata_missing');
  const base=path.resolve(process.env.LOCALAPPDATA);
  const dest=path.join(base,'JILL-WEB','recovery');
  if(dest===ROOT||dest.startsWith(ROOT+path.sep))
    fail('work_0003_checkpoint_inside_repo');
  fs.mkdirSync(dest,{recursive:true,mode:0o700});
  if(fs.lstatSync(dest).isSymbolicLink())
    fail('work_0003_checkpoint_symlink');
  const createdAt=new Date().toISOString();
  const plaintext=JSON.stringify({
    operation:'JILL_WORK_D1_0003_PRECHANGE',
    database_id:DB_ID,database_name:DB,
    git_head:head,created_at:createdAt,bookmark,
  });
  const cipher=encryptForCurrentWindowsUser(plaintext);
  if(decryptForVerification(cipher)!==plaintext)
    fail('work_0003_dpapi_roundtrip_failed');
  const filename='work-d1-0003-'+
    createdAt.replace(/[-:.]/g,'').replace('Z','Z')+'-'+
    randomUUID()+'.dpapi';
  const filepath=path.join(dest,filename);
  fs.writeFileSync(filepath,cipher,{flag:'wx',mode:0o600,
    encoding:'utf8',flush:true});
  if(!fs.statSync(filepath).isFile() ||
    fs.readFileSync(filepath,'utf8')!==cipher ||
    cipher.includes(bookmark))
    fail('work_0003_checkpoint_write_unverified');
  return filepath;
}
function verifyPostflight(){
  const receipt=assertWork0003Postflight({
    schema:wranglerJson(work0003ReleaseCommand('post_schema')),
    ledger:wranglerJson(work0003ReleaseCommand('post_ledger')),
    seed:wranglerJson(work0003ReleaseCommand('post_seed')),
  });
  // Reuse the independent proven v34/WORK-bound read-only inspection.
  // It accepts the 5-table state and proves 0003 is recorded in ledger.
  const output=call(process.execPath,[BASELINE,'--inspect']);
  if(!output.includes('PASS WORK inbox-index table is present.') ||
    !output.includes('PASS migration 0003 is recorded in D1 ledger.')||
    !output.includes('PASS exact WORK canary v34 and exact D1 binding/Cloudflare account database identity.'))
    fail('work_0003_postflight_worker_mismatch');
  return receipt;
}
async function runMain(){
  let phase='start',checkpointFile=null,writeStarted=false;
  try{
    const mode=process.argv[2];
    if(process.argv.length!==3||
      !['--inspect','--apply'].includes(mode))
      fail('work_0003_mode_invalid');
    phase='verify_git_and_exact_migration_source';
    const head=gitGuard(),local=inspectLocal();
    phase='verify_real_work_d1_prechange';
    readBaseline();
    if(mode==='--inspect'){
      phase='verify_bookmark_capability';
      recoveryCapability();
      readBaseline();
      console.log('PASS WORK v34, D1 pending 0003, and current Time Travel capability.');
      console.log('PASS only 0003 is eligible from the pinned WORK migration directory; fast inbox OFF.');
      console.log('READ ONLY. No checkpoint saved, no migration, restore, secret or traffic changes.');
      console.log('HOLD: use --apply ONLY with owner approval and interactive confirmation.');
      return;
    }
    // Explicit local Owner execution and interactive consent required.
    if(process.platform!=='win32'||!process.stdin.isTTY||
      !process.stdout.isTTY||Boolean(process.env.CI))
      fail('work_0003_interactive_windows_required');
    const ui=createInterface({input:process.stdin,output:process.stdout});
    let approved;
    try{approved=await ui.question(
      'Type "'+WORK_0003_APPROVAL+'" to begin guarded WORK-only D1 migration 0003: ');}
    finally{ui.close();}
    if(approved!==WORK_0003_APPROVAL)
      fail('work_0003_owner_not_approved');
    phase='revalidate_before_recovery_capture';
    if(gitGuard()!==head ||
      inspectLocal().sha256!==local.sha256)
      fail('work_0003_source_changed');
    readBaseline();
    phase='capture_private_time_travel_bookmark';
    const bookmark=recoveryCapability();
    checkpointFile=savePrivateCheckpoint(bookmark,head);
    // Validate live schema/history *again* after capturing the recovery
    // point. Never proceed if anything changed during this process.
    phase='final_prewrite_recheck';
    readBaseline();
    if(gitGuard()!==head||inspectLocal().sha256!==local.sha256)
      fail('work_0003_source_changed');
    console.log('PASS private Windows DPAPI recovery checkpoint recorded OUTSIDE Git.');
    console.log('STOP after any ambiguous migration outcome; NEVER auto-restore or reapply.');
    phase='apply_exact_pending_work_0003';
    writeStarted=true;
    call(process.execPath,[WRANGLER,
      ...work0003ReleaseCommand('apply_0003')],{
        cwd:APP,stdio:'inherit',timeout:180000,
      });
    phase='verify_live_0003_postflight';
    const receipt=verifyPostflight();
    console.log('PASS WORK D1 0003 applied: '+receipt.tables_verified+
      ' JILL tables, '+receipt.migrations_verified+
      ' ledger entries, '+receipt.initial_index_rows+' empty seed row.');
    console.log('PASS active v34 preserved; fast inbox still OFF; media 0004 not applied.');
    console.log('Recovery checkpoint protected at: '+checkpointFile);
    console.log('No automatic restore or schema rollback was attempted.');
  }catch(e){
    const allowed=new Set([
      'work_0003_mode_invalid','work_0003_git_unverified',
      'work_0003_wrangler_missing','work_0003_migration_source_drift',
      'work_0003_command_failed','work_0003_remote_json_invalid',
      'work_0003_bookmark_not_found','work_0003_windows_dpapi_required',
      'work_0003_localappdata_missing','work_0003_checkpoint_inside_repo',
      'work_0003_checkpoint_symlink','work_0003_dpapi_encryption_unverified',
      'work_0003_dpapi_roundtrip_failed',
      'work_0003_checkpoint_write_unverified',
      'work_0003_interactive_windows_required','work_0003_owner_not_approved',
      'work_0003_source_changed','work_0003_postflight_worker_mismatch',
      'work_0003_postflight_read_invalid',
      'work_0003_postflight_schema_invalid',
      'work_0003_postflight_ledger_invalid',
      'work_0003_postflight_seed_invalid',
      'work_0003_baseline_changed',
      'work_0003_time_travel_backend_unverified',
      'work_0003_bookmark_unverified',
    ]);
    console.error('WORK 0003 RELEASE STOPPED: '+
      (allowed.has(e?.message)?e.message:'work_0003_unverified_failure'));
    console.error('PHASE: '+phase);
    if(checkpointFile)
      console.error('Encrypted local recovery checkpoint: '+checkpointFile);
    if(writeStarted)
      console.error('REMOTE WRITE MAY HAVE OCCURRED. Inspect real D1 state before retry; no automatic rollback/reapply.');
    else
      console.error('No remote write initiated by this command.');
    process.exitCode=1;
  }
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked)await runMain();
