// WORK-only synthetic quote QA readiness: STRICTLY READ-ONLY.
// Never submits a Custom Order, quote, email, customer update or payment.
// Owner creates exactly one synthetic request via approved WORK storefront
// ONLY after this preflight; browsers route via temporary host-only pin.
import {spawnSync,execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {auditWorkQaReadOnly} from './audit-work-qa-script-readonly.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {inspectDeploymentState,ACTIVE,CANDIDATE,WORKER,ORIGIN,OVERRIDE,
  makeVersionOverride} from './work-quote-v35-zero-deployment-policy.mjs';
import {verifyInspectedQuoteVersions,MARKER,SOURCE}
  from './inspect-work-hq-quote-v35-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const BIN=join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const abort=code=>{throw Error('work_v35_synthetic_preflight_'+code);};
const check=(condition,reason)=>{if(!condition)abort(reason);};
function git(...a){
  try{return execFileSync('git',['-C',ROOT,...a],{
    encoding:'utf8',timeout:15000,maxBuffer:4096,windowsHide:true,
  }).trim();}catch{abort('git_unverified');}
}
function wrangler(args){
  check(existsSync(BIN),'wrangler_missing');
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',windowsHide:true,shell:false,
    timeout:45000,maxBuffer:5*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  check(!r.error&&!r.signal&&r.status===0,'remote_metadata_unavailable');
  return String(r.stdout||'');
}
function json(args){
  try{return JSON.parse(wrangler(args));}
  catch{abort('metadata_json_invalid');}
}
const scoped=(operation,...rest)=>[operation,...rest,
  '--name',WORKER,'--config',CONFIG];
async function anonymousPinnedProbe({backendFetch=fetch}={}){
  const path='/app/requests/quote-draft';
  const base=async(version)=>{
    const r=await backendFetch(ORIGIN+path,{
      method:'GET',redirect:'manual',credentials:'omit',
      headers:{
        Accept:'application/json',
        ...(version===null?{}:{[OVERRIDE]:makeVersionOverride(version)}),
      },
      signal:AbortSignal.timeout(15000),
    });
    check(r&&Number.isSafeInteger(r.status)&&r.headers,
      'anonymous_probe_unavailable');
    return r;
  };
  const ordinary=await base(null);
  check(ordinary.status===410&&
    ordinary.headers.get('location')===null&&
    (ordinary.headers.get('content-type')||'').toLowerCase()
      .startsWith('text/html'),
    'legacy_v34_response_changed');
  const pinned=await base(CANDIDATE);
  const mime=(pinned.headers.get('content-type')||'').toLowerCase();
  if(pinned.status===403&&mime.startsWith('application/json')){
    const body=await pinned.text();
    check(body.length<2048,'pinned_response_oversized');
    let parsed;
    try{parsed=JSON.parse(body);}catch{abort('pinned_json_unverified');}
    check(parsed?.ok===false&&parsed?.code==='access_denied'&&
      Object.keys(parsed).length===2,
      'pinned_unauthorized_not_denied');
  }else if(pinned.status===302){
    const raw=pinned.headers.get('location');
    let dest;
    try{dest=new URL(raw,ORIGIN);}catch{abort('unverified_auth_redirect');}
    const same=dest.origin===ORIGIN&&
      dest.pathname.startsWith('/auth/');
    const shop=dest.origin==='https://jill-work.myshopify.com';
    check(same||shop,'unverified_auth_redirect');
  }else abort('v35_override_not_at_owner_boundary');
  return true;
}
export async function syntheticQuotePreflight({
  qaAudit=auditWorkQaReadOnly,
  metadata={status:()=>wrangler(scoped('deployments','status')),
    deployments:()=>json(scoped('deployments','list','--json')),
    versions:()=>json(scoped('versions','list','--json')),
    version:(id)=>json(scoped('versions','view',id,'--json'))},
  probe=anonymousPinnedProbe,
  requireOwnerWindows=true,
}={}){
  if(requireOwnerWindows)check(process.platform==='win32','windows_owner_only');
  check(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'source_not_synced');
  const allocation=inspectDeploymentState(metadata.deployments(),'zero');
  check(currentWorkerVersion(metadata.status())===ACTIVE,
    'v34_not_100_percent_active');
  verifyInspectedQuoteVersions({
    current:ACTIVE,source:SOURCE,versions:metadata.versions(),
    active:metadata.version(ACTIVE),
    rollback:metadata.version('204d66c3-3296-430d-8288-39c354876600'),
    candidate:metadata.version(CANDIDATE),
  });
  const audit=await qaAudit({root:ROOT});
  check(audit?.deploymentFound===true&&
    audit?.headMatchesCertifiedGit===true&&
    audit?.publishedRevisionVerified===true&&
    Number.isSafeInteger(audit?.publishedVersion)&&
    audit.publishedVersion>=1&&
    /^[a-f0-9]{64}$/.test(audit.publishedDigest||''),
    'qa_sandbox_published_source_unverified');
  await probe();
  const after=inspectDeploymentState(metadata.deployments(),'zero');
  check(after.id===allocation.id&&
    currentWorkerVersion(metadata.status())===ACTIVE,
    'traffic_changed_during_preflight');
  return Object.freeze({
    work_v34_pct:100,work_v35_pct:0,
    v35_version:CANDIDATE,google_qa_sandbox_verified:true,
    qa_published_version:audit.publishedVersion,
    anonymous_version_override_owner_denial:true,
    permitted_synthetic_submissions:1,
    synthetic_submission_created:false,
    quote_draft_saved:false,existing_customers_affected:false,
  });
}
const called=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(called){
  try{
    check(process.argv.length===2,'arguments_not_allowed');
    const result=await syntheticQuotePreflight();
    console.log('PASS WORK v34 at 100% and v35 at 0%; unchanged deployment.');
    console.log('PASS exact inactive v35 version, original bindings and source marker.');
    console.log('PASS certified isolated Google Custom Orders QA sandbox published @'+
      result.qa_published_version+'; no LIVE/Rewards cross-target.');
    console.log('PASS anonymous pinned v35 request reaches Owner-denial boundary; ordinary v34 remains 410.');
    console.log('READY FOR OWNER: create exactly ONE synthetic WORK Custom Order through existing verified WORK form; then signed-in quote QA with temporary browser pin.');
    console.log('READ ONLY: NO Custom Order submitted, no D1 quote saved, no emails, no Worker traffic change, R2, LIVE/KEEP or paid plan changes.');
  }catch(err){
    const text=String(err?.message||'');
    console.error('STOP WORK synthetic quote QA preflight: '+
      (/^(work_v35_synthetic_preflight_|work_quote_stage_|quote_v35_readonly_)[a-z0-9_]+$/.test(text)?text:
        'work_v35_synthetic_preflight_unverified'));
    console.error('No request was created. Do not use v35 QA browser pin or write quotes until corrected.');
    process.exitCode=1;
  }
}
