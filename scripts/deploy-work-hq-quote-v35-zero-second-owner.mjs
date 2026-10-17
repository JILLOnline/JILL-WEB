// JILL WEB — SECOND owner-approved 0%-TRAFFIC WORK QA attempt.
// This is NOT GitHub CI, and needs existing Owner Wrangler auth.
// Existing v34 remains 100% normal traffic; v35 is ONLY version
// overridden for an anonymous GET smoke. Rollback to v34 is authorized
// if verification fails. No customer request payloads or status writes.
import {spawnSync,execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {ownerReceiptPath,reserveOneDeploymentAttempt}
  from './work-quote-v35-once-receipt.mjs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {
  ACTIVE,CANDIDATE,FALLBACK,SOURCE,WORKER,ORIGIN,OVERRIDE,
  splitTrafficArgs,inspectDeploymentState,makeVersionOverride,
  verifiedLegacyV34Baseline,anonymousSmokeContract,
} from './work-quote-v35-zero-deployment-policy.mjs';
import {
  verifyInspectedQuoteVersions,verifyQuoteTableReadback,MARKER,
} from './inspect-work-hq-quote-v35-readonly.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const BIN=join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const DB='jill-order-desk-work';
const D1ID='3f17c186-c794-4e00-8f20-017191373a19';
const FLAG='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED';
const abort=code=>{throw Error('quote_v35_zero_owner_'+code);};
const requireTrue=(x,code)=>{if(!x)abort(code);};
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',timeout:15000,windowsHide:true,maxBuffer:4096,
  }).trim();}
  catch{abort('git_unverifiable');}
}
function sourceCheck(){
  requireTrue(process.platform==='win32','windows_owner_required');
  requireTrue(git('branch','--show-current')==='jill/rewards-work'&&
    !git('status','--porcelain','--untracked-files=no')&&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work')&&
    git('cat-file','-t',SOURCE)==='commit',
    'work_source_not_synced');
  try{execFileSync('git',['-C',ROOT,'merge-base','--is-ancestor',
    SOURCE,'HEAD'],{stdio:'ignore',timeout:15000,windowsHide:true});}
  catch{abort('v35_upload_source_unverifiable');}
  const m=JSON.parse(readFileSync(join(APP,'wrangler.canary.jsonc'),'utf8'));
  requireTrue(m.name===WORKER&&m.d1_databases?.length===1&&
    m.d1_databases[0].database_name===DB&&
    m.d1_databases[0].database_id===D1ID&&
    m.d1_databases[0].binding==='JILL_ORDER_DESK_WORK_DB'&&
    m.vars?.JILL_WORK_HOST_STAGE==='canary'&&
    m.vars?.JILL_WORK_OAUTH_ENABLED==='false'&&
    m.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false'&&
    !Object.hasOwn(m.vars,FLAG)&&!m.r2_buckets?.length&&
    !m.services?.length&&!m.routes?.length,
    'WORK_manifest_or_paid_resource_drift');
  requireTrue(existsSync(BIN),'wrangler_binary_missing');
}
function cli(args,{timeout=65000}={}){
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,shell:false,windowsHide:true,encoding:'utf8',
    timeout,maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  requireTrue(!r.error&&!r.signal&&r.status===0,'wrangler_command_failed');
  return String(r.stdout||'');
}
function json(args){
  try{return JSON.parse(cli(args));}
  catch{abort('wrangler_json_unverifiable');}
}
function view(id){
  return json(['versions','view',id,'--name',WORKER,
    '--config',CONFIG,'--json']);
}
function versions(){
  return json(['versions','list','--name',WORKER,
    '--config',CONFIG,'--json']);
}
function deployments(){
  return json(['deployments','list','--name',WORKER,
    '--config',CONFIG,'--json']);
}
function current(){
  try{return currentWorkerVersion(cli(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));}
  catch{abort('active_status_unverifiable');}
}
function quoteTables(){
  const sql="SELECT name FROM sqlite_master WHERE type='table' "+
    "AND name IN ('jill_work_quote_drafts',"+
    "'jill_work_quote_draft_operations') ORDER BY name";
  verifyQuoteTableReadback(json(['d1','execute',DB,'--remote',
    '--config',CONFIG,'--json','--command',sql]));
}
function preflight(){
  sourceCheck();
  requireTrue(current()===ACTIVE,'v34_not_100pct_active');
  const before=inspectDeploymentState(deployments(),'baseline');
  const vs=versions();
  verifyInspectedQuoteVersions({
    current:ACTIVE,source:SOURCE,versions:vs,
    active:view(ACTIVE),rollback:view(FALLBACK),
    candidate:view(CANDIDATE),
  });
  quoteTables();
  requireTrue(current()===ACTIVE,'concurrent_traffic_change');
  requireTrue(inspectDeploymentState(deployments(),'baseline').id===
    before.id,'concurrent_deployment_change');
  return before;
}
async function probe({version=null,pathname='/app/requests/quote-draft'}={}){
  requireTrue(pathname==='/healthz'||
    pathname==='/app/requests/quote-draft',
    'unapproved_anonymous_route');
  const headers={Accept:'application/json',
    'Cache-Control':'no-store'};
  if(version!==null)headers[OVERRIDE]=makeVersionOverride(version);
  const r=await fetch(ORIGIN+pathname,{
    method:'GET',credentials:'omit',redirect:'manual',headers,
    signal:AbortSignal.timeout(15000),
  });
  const status=r.status,redirect=r.headers.get('location');
  const mime=(r.headers.get('content-type')||'')
    .split(';',1)[0].trim().toLowerCase();
  let j=null;
  if(mime==='application/json'){
    const body=await r.text();
    requireTrue(body.length<=2048,'unexpected_anonymous_response_size');
    try{j=JSON.parse(body);}catch{abort('response_json_unverifiable');}
  }
  return Object.freeze({status,redirect,json:j,mime});
}
async function originalBaseline(){
  // The v34 quote route predates v35. Known v34 GET returns 410 HTML
  // (NOT proof of a Shopify auth gate). Validate an independent health
  // endpoint and the precise unserved quote-route response.
  const health=await probe({pathname:'/healthz'});
  const quote=await probe();
  const proof=verifiedLegacyV34Baseline({health,quote});
  return {health,quote,proof};
}
async function smoke(){
  const baseline=await originalBaseline();
  // PROBE MUST NEVER SEND an Owner cookie, customer ID or POST payload.
  let c;
  for(let i=0;i<3;i++){
    c=await probe({version:CANDIDATE});
    if(c.status!==503||
      c.json?.error!=='quote_drafts_not_enabled')break;
    if(i<2)await new Promise(r=>setTimeout(r,2500));
  }
  const state=inspectDeploymentState(deployments(),'zero');
  requireTrue(current()===ACTIVE,'v34_no_longer_100pct');
  quoteTables();
  // A valid v34 410 HTML CANNOT satisfy this v35 Owner-auth check.
  const proof=anonymousSmokeContract({baseline,candidate:c,after:state});
  // An explicit v34 override must match independently observed v34,
  // not an invented v35-specific error response.
  const old=await probe({version:ACTIVE});
  verifiedLegacyV34Baseline({health:baseline.health,quote:old});
  requireTrue(old.status===baseline.quote.status&&
    old.mime===baseline.quote.mime&&
    old.redirect===baseline.quote.redirect&&
    JSON.stringify(old.json)===JSON.stringify(baseline.quote.json),
    'v34_override_does_not_match_ordinary_v34');
  requireTrue(inspectDeploymentState(deployments(),'zero').id===state.id&&
    current()===ACTIVE,'deployment_changed_during_smoke');
  return proof;
}
function recoverIfSafe(){
  // Approved rollback, but only if the exact known WORK versions
  // remain deployed. Never overwrite an unknown concurrent release.
  const currentState=inspectDeploymentState(deployments(),'known');
  if(currentState.state==='baseline'){
    requireTrue(current()===ACTIVE,'rollback_baseline_status_drift');
    return 'already_v34_100';
  }
  // If we cannot prove only approved versions, refuse to change traffic.
  cli(splitTrafficArgs({mode:'restore'}),{timeout:120000});
  const verified=inspectDeploymentState(deployments(),'baseline');
  requireTrue(verified.active_pct===100&&
    current()===ACTIVE,'rollback_unverified');
  return 'restored_v34_100';
}
const called=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(called){
  let phase='preflight',deployAttempted=false;
  try{
    const mode=process.argv[2];
    requireTrue(process.argv.length===3&&
      (mode==='--zero'||mode==='--recover'),
      'unsupported_owner_mode');
    if(mode==='--recover'){
      sourceCheck();
      phase='read_only_recovery_gate';
      const old=versions();
      const marker=old.find(v=>v?.id===CANDIDATE);
      requireTrue(marker?.annotations?.['workers/message']===MARKER,
        'candidate_source_marker_drift');
      quoteTables();
      phase='owner_approved_rollback';
      const result=recoverIfSafe();
      console.log('PASS WORK recovery: '+result+
        '; v34 at 100%. No customer record, LIVE/KEEP or paid resource affected.');
      process.exit(0);
    }
    // This NEW script carries one separate Owner approval for a second
    // zero-percent attempt. The original operator remains HARD STOPPED.
    const baseline=preflight();
    phase='pre_deployment_legacy_v34_http';
    const observed=await originalBaseline();
    console.log('PASS PRE-DEPLOY: v34 health 200 and legacy quote GET '+
      observed.quote.status+' '+observed.quote.mime+
      '; this is NOT an authorization gate or v35 test.');
    requireTrue(current()===ACTIVE&&
      inspectDeploymentState(deployments(),'baseline').id===baseline.id,
      'pre_deploy_traffic_changed');
    console.log('PASS PRE-DEPLOY: exact v34 100%, v35 inactive, v33 fallback, WORK quote D1 and secret bindings.');
    phase='wrangler_zero_dry_run';
    cli([...splitTrafficArgs(),'--dry-run'],{timeout:60000});
    // No new upload. A 0% deployment is a real configuration change.
    // Only these two pinned version IDs can be deployed here.
    phase='single_use_owner_approval_reservation';
    // Revalidate after dry run to avoid concurrent changes between
    // our checks and the Cloudflare deployment write. No remote mutation
    // happens unless the private one-use reservation persists first.
    sourceCheck();
    requireTrue(current()===ACTIVE&&
      inspectDeploymentState(deployments(),'baseline').id===baseline.id,
      'pre_deployment_traffic_or_source_drift');
    const receipt=reserveOneDeploymentAttempt({
      filepath:ownerReceiptPath(process.env.LOCALAPPDATA),
      worker:WORKER,active:ACTIVE,candidate:CANDIDATE,
      source:SOURCE,baselineDeployment:baseline.id,
    });
    requireTrue(receipt.reserved&&!receipt.canAutomaticallyRetry,
      'single_use_reservation_unverified');
    phase='owner_approved_second_zero_deployment';
    deployAttempted=true;
    cli([...splitTrafficArgs()],{timeout:120000});
    phase='zero_allocation_readback';
    const post=inspectDeploymentState(deployments(),'zero');
    requireTrue(post.id!==baseline.id,'deployment_receipt_not_advanced');
    requireTrue(current()===ACTIVE,'v34_not_100pct_after_deployment');
    console.log('PASS WORK ZERO ALLOCATION: v34 100%, v35 0%. New deployment '+post.id);
    phase='anonymous_override_smoke';
    await smoke();
    console.log('PASS v34 legacy route unavailable; v35 override reached the Owner-auth denial boundary with NO credentials.');
    console.log('PASS v34 remains at 100%, v35 0%; v33 rollback retained.');
    console.log('HOLD: No authenticated quote Save/Reload QA, full remote asset byte parity, ordinary v35 traffic or customer data writes authorized.');
    console.log('NO Worker upload, extra D1 changes, R2, LIVE/KEEP, customer messages, Shopify payments or paid capacity.');
    console.log('Second WORK 0% approval exercised exactly once. Do not rerun this command; further rollout requires fresh permission.');
  }catch(e){
    const message=String(e?.message||'');
    const safe=/^(quote_v35_zero_owner_|quote_v35_zero_|quote_v35_readonly_|work_quote_stage_)[a-z0-9_]+$/.test(message)?
      message:'quote_v35_zero_owner_unverified';
    console.error('STOP WORK v35 zero deployment: '+safe+' at '+phase);
    if(deployAttempted){
      console.error('Second approval is spent; deployment may have committed. NEVER rerun this command.');
      try{
        const result=recoverIfSafe();
        console.error('WORK ROLLBACK VERIFIED: '+result+'. v34 is 100%.');
      }catch{
        console.error('HOLD: automatic rollback unsafe/unverified. Inspect WORK deployments read-only; do not overwrite other versions.');
      }
    }else{
      console.error('No deployment request made by this run.');
    }
    console.error('No LIVE, KEEP, R2, Shopify payments or customer writes requested.');
    process.exitCode=1;
  }
}
