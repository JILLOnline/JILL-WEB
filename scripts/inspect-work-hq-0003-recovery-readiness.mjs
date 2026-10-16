// JILL HQ WORK 0003: recoverability INSPECTION ONLY, never a D1 mutation.
// The current bookmark is only checked in memory, NEVER printed/saved.
// A new owner-controlled recovery bookmark must be separately captured
// immediately before an expressly approved future schema change.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const WRANGLER=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const WORK_DB='jill-order-desk-work';
const WORK_UUID='3f17c186-c794-4e00-8f20-017191373a19';
const CONF='./wrangler.canary.jsonc';
const BASELINE='scripts/inspect-work-hq-media-d1-preflight.mjs';
const EXPECTED=[
  'PASS exact WORK canary v34 and exact D1 binding/Cloudflare account database identity.',
  'PASS remote WORK D1 schema recognized: 4 existing JILL tables; media registry ABSENT.',
  'HOLD: jill_work_verified_inbox_index is MISSING from remote D1.',
  'HOLD: D1 ledger contains 2 recognized migration name(s); 0003 not recorded.',
];
const deny=(reason)=>{throw Error(reason);};
export function work0003RecoveryReadArgs(step){
  switch(step){
    case 'database_info':
      return ['d1','info',WORK_DB,'--config',CONF,'--json'];
    case 'time_travel_current':
      return ['d1','time-travel','info',WORK_DB,'--config',CONF,'--json'];
    default:deny('unsafe_recovery_operation_refused');
  }
}
export function assertWork0003ReadOnlyBaseline(output){
  if(typeof output!=='string'||
    EXPECTED.some(line=>!output.includes(line))||
    output.includes('WORK MEDIA D1 PREFLIGHT STOPPED'))
    deny('work_0003_baseline_changed');
  return true;
}
export function assertWork0003D1Info(payload){
  const info=payload?.result&&typeof payload.result==='object'?
    payload.result:payload;
  if(!info||Array.isArray(info)||typeof info!=='object'||
    info.name!==WORK_DB ||
    (info.uuid!==WORK_UUID&&info.id!==WORK_UUID)||
    info.version!=='production')
    deny('work_0003_time_travel_backend_unverified');
  return Object.freeze({database:WORK_DB,backend:'production'});
}
export function assertWork0003Bookmark(payload){
  const b=payload?.result&&typeof payload.result==='object'?
    payload.result:payload;
  const value=b?.bookmark;
  // Do NOT return, log or persist the actual bookmark. A valid current
  // bookmark is a short-lived recovery checkpoint, NOT a backup by itself.
  if(typeof value!=='string'||value.length<15||value.length>180||
    !/^[a-zA-Z0-9-]+$/.test(value))
    deny('work_0003_bookmark_unverified');
  return Object.freeze({retrievable:true,bookmarkStored:false});
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8'}).trim();
}
function run(script,args,{cwd=ROOT}={}){
  const result=spawnSync(process.execPath,[script,...args],{
    cwd,shell:false,encoding:'utf8',windowsHide:true,
    timeout:60000,maxBuffer:8*1024*1024,
  });
  if(result.error||result.status!==0)deny('recovery_metadata_read_failed');
  return String(result.stdout||'');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='start';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      deny('read_only_inspection_required');
    phase='work_git_and_wrangler_integrity';
    if(git('branch','--show-current')!=='jill/rewards-work'||
      git('rev-parse','HEAD')!==git('rev-parse',
        'refs/remotes/origin/jill/rewards-work')||
      git('status','--porcelain','--untracked-files=no')||
      !fs.existsSync(WRANGLER))
      deny('work_source_or_wrangler_unverified');
    const db=JSON.parse(fs.readFileSync(path.join(APP,
      'wrangler.canary.jsonc'),'utf8'));
    if(db.name!=='jill-order-desk-canary-work'||
      db.d1_databases?.length!==1||
      db.d1_databases[0]?.database_id!==WORK_UUID||
      db.d1_databases[0]?.database_name!==WORK_DB||
      db.d1_databases[0]?.migrations_dir!=='../migrations')
      deny('work_0003_config_mismatch');
    phase='fresh_v34_work_d1_and_0003_baseline';
    const baseline=run(path.join(ROOT,BASELINE),['--inspect']);
    assertWork0003ReadOnlyBaseline(baseline);
    phase='time_travel_backend_info';
    const info=JSON.parse(run(WRANGLER,
      work0003RecoveryReadArgs('database_info'),{cwd:APP}));
    assertWork0003D1Info(info);
    phase='time_travel_current_bookmark';
    const current=JSON.parse(run(WRANGLER,
      work0003RecoveryReadArgs('time_travel_current'),{cwd:APP}));
    assertWork0003Bookmark(current);
    phase='concurrent_state_recheck';
    assertWork0003ReadOnlyBaseline(run(path.join(ROOT,BASELINE),
      ['--inspect']));
    console.log('PASS exact WORK v34, correct D1 and pending 0003 preflight rechecked.');
    console.log('PASS WORK D1 production storage backend supports Time Travel.');
    console.log('PASS CURRENT WORK D1 Time Travel bookmark retrieval; bookmark NOT printed or stored.');
    console.log('READ ONLY. No restore, migration, backup export, secret, database or Worker changes.');
    console.log('HOLD: bookmark must be captured privately immediately before a separately approved 0003 migration; point-in-time restoration is destructive to later writes.');
  }catch(e){
    const safe=new Set([
      'read_only_inspection_required','work_source_or_wrangler_unverified',
      'work_0003_config_mismatch','work_0003_baseline_changed',
      'recovery_metadata_read_failed',
      'work_0003_time_travel_backend_unverified',
      'work_0003_bookmark_unverified',
    ]);
    console.error('WORK 0003 RECOVERY INSPECTION STOPPED: '+
      (safe.has(e?.message)?e.message:'recovery_read_unverifiable'));
    console.error('READ ONLY FAILURE PHASE: '+phase);
    process.exitCode=1;
  }
}
