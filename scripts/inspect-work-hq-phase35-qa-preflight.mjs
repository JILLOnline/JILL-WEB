// JILL HQ Phase 35: operator-only read-only WORK QA acceptance preflight.
// Reuses the *existing*, audited v34 parity + Google QA @9/Cloudflare v34
// post-release inspectors. No mutation path, secrets, customer reads or deploy.
// This is NOT deployed v34 byte parity or authorization for a status write.
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {existsSync} from 'node:fs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SCRIPTS=Object.freeze({
  live:join(ROOT,'scripts/audit-work-hq-detail-v9-live.mjs'),
  parity:join(ROOT,'scripts/inspect-work-hq-v34-ui-readiness.mjs'),
});
const ACTIVE='4973b74d-d479-41da-897c-e36129303279';
const FALLBACK='204d66c3-3296-430d-8288-39c354876600';
const REQUIRED=Object.freeze({
  live:Object.freeze([
    'PASS WORK active Cloudflare exact v34 '+ACTIVE,
    'PASS rollback v33 preserved '+FALLBACK,
    'PASS all four secrets, WORK D1, OAuth ON, Owner setup OFF, writes ON; only detail flag added.',
    'PASS Google QA @9 source pin, original @7 inbox/status isolation.',
    'PASS live anonymous /healthz, /auth/login and Owner-only route denial.',
    'READ ONLY. No customer data read, Google/Shopify/D1 writes, traffic changes, secrets or LIVE/KEEP changes.',
  ]),
  parity:Object.freeze([
    'PASS WORK active v34 and preserved v33 rollback metadata.',
    'PASS WORK v34 live secret-binding names/types, D1, OAuth, Owner OFF, writes ON and detail ON match LOCAL UI candidate.',
    'PASS WORK canary compatibility date and fetch handler match.',
    'HOLD: Live Worker binary and client asset parity NOT proven; staging and deployment NOT approved.',
    'READ ONLY: Local manifest + Cloudflare metadata only, no customer reads or remote writes.',
  ]),
});
const STOP=code=>{throw Error('work_hq_phase35_preflight_'+code);};
function checkLines(value,required){
  if(typeof value!=='string'||value.length>16384||
     /(?:^|\r?\n)(?:STOP|ERROR|FATAL|FAIL)(?:\b|:)/i.test(value))
    STOP('invalid_provider_receipt');
  const lines=value.split(/\r?\n/);
  for(const line of required)
    if(lines.filter(entry=>entry===line).length!==1)
      STOP('incomplete_provider_receipt');
}
export function verifyPhase35ReadOnlyReceipts({liveOutput,parityOutput}={}){
  checkLines(liveOutput,REQUIRED.live);
  checkLines(parityOutput,REQUIRED.parity);
  return Object.freeze({
    active_work_version:ACTIVE,
    preserved_v33_fallback:FALLBACK,
    exact_google_qa_v9_pin_checked:true,
    google_qa_v7_list_status_separation_checked:true,
    live_anonymous_owner_route_denial_checked:true,
    work_security_binding_metadata_matches:true,
    deployed_v34_binary_provenance_verified:false,
    current_work_signed_in_owner_verified:false,
    real_status_command_executed:false,
    real_status_mutation_verified:false,
    customer_timeline_persistence_verified:false,
    v35_upload_authorized:false,
    v35_traffic_switch_authorized:false,
    billing_or_storage_authorized:false,
  });
}
function git(...args){
  try{
    return execFileSync('git',['-C',ROOT,...args],{
      encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:4096,
    }).trim();
  }catch{STOP('git_unavailable');}
}
function verifyCheckout(){
  if(git('branch','--show-current')!=='jill/rewards-work'||
     git('rev-parse','HEAD')!==
       git('rev-parse','refs/remotes/origin/jill/rewards-work')||
     git('status','--porcelain','--untracked-files=no'))
    STOP('work_checkout_not_clean_and_synced');
}
function readOnly(name,args){
  const script=SCRIPTS[name];
  if(!script||!existsSync(script))STOP('script_unavailable');
  const result=spawnSync(process.execPath,[script,...args],{
    cwd:ROOT,encoding:'utf8',shell:false,windowsHide:true,
    timeout:180000,maxBuffer:64*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  // Never echo a provider response. Child inspectors only print
  // fixed status labels, but still treat all stdout as untrusted.
  if(result.error||result.signal||result.status!==0)
    STOP(name==='live'?'live_work_evidence_not_verified':
      'v34_binding_parity_not_verified');
  return result.stdout;
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let stage='arguments';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      STOP('readonly_mode_required');
    stage='clean_work_checkout';
    verifyCheckout();
    stage='live_deployment_google_pin_and_anonymous_boundary';
    const liveOutput=readOnly('live',[]);
    stage='v34_metadata_parity';
    const parityOutput=readOnly('parity',['--inspect']);
    stage='receipt_contract';
    const receipt=verifyPhase35ReadOnlyReceipts({liveOutput,parityOutput});
    if(receipt.v35_upload_authorized!==false||
       receipt.real_status_mutation_verified!==false)
      STOP('permission_violation');
    console.log('PASS WORK Phase35 READ ONLY: exact active v34 '+ACTIVE+' with v33 fallback retained.');
    console.log('PASS WORK Phase35 READ ONLY: Google QA @9 pin, @7 inbox/status isolation and anonymous Owner-only route denial.');
    console.log('PASS WORK Phase35 READ ONLY: preserved WORK secrets/D1/OAuth/security flags metadata.');
    console.log('HOLD: This did NOT prove deployed v34 Worker/client bytes or a signed-in Owner, and did NOT execute or authorize a real QA status mutation.');
    console.log('READ ONLY: No status writes, customer data, version upload, traffic change, D1/R2, billing, LIVE or KEEP operations.');
  }catch(error){
    const reason=String(error?.message||'work_hq_phase35_preflight_unverified');
    const code=/^work_hq_phase35_preflight_[a-z0-9_]+$/.test(reason)?
      reason:'work_hq_phase35_preflight_unverified';
    console.error('STOP WORK Phase35 READ-ONLY PREFLIGHT: '+code);
    console.error('READ ONLY PHASE: '+stage);
    process.exitCode=1;
  }
}
