// JILL WORK — READ-ONLY two-source Cloudflare release preflight.
// Consolidates genuine private-bucket + account-analytics inspectors,
// but NEVER authorizes an upload, deployment, bill, migration or preview.
// No user/customer data, API response or credential is written to disk.
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {existsSync} from 'node:fs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const BRANCH='jill/rewards-work';
const files=Object.freeze({
  privacy:join(ROOT,'scripts/inspect-work-hq-r2-private-preflight.mjs'),
  account:join(ROOT,'scripts/inspect-work-hq-r2-account-usage.mjs'),
});
const STOP=(code='work_hq_media_read_only_not_certified')=>{
  throw Error(code);
};
function capture(log,prefix){
  const hits=String(log||'').split(/\r?\n/)
    .filter(line=>line.startsWith(prefix));
  if(hits.length!==1)STOP('work_hq_media_read_only_receipt_missing');
  return hits[0].slice(prefix.length);
}
function integer(log,prefix){
  const value=capture(log,prefix);
  if(!/^(?:0|[1-9]\d{0,15})$/.test(value))
    STOP('work_hq_media_read_only_receipt_invalid');
  const n=Number(value);
  if(!Number.isSafeInteger(n))STOP('work_hq_media_read_only_receipt_invalid');
  return n;
}
const requiredPrivacy=Object.freeze([
  'PASS: Correct WORK Cloudflare account, WORK D1 and Standard R2 bucket.',
  'PASS: Bucket is empty (0 objects, 0 B) with no public r2.dev URL or custom domains.',
  'PASS: Local-only R2 binding is remote:false; WORK/canary deploy configs have no R2 binding.',
  'HOLD: No account-wide storage/operation quota, customer storage or previews authorized.',
  'READ ONLY: No Cloudflare mutations, object reads, D1 writes, deployments or billing changes.',
]);
const requiredUsage=Object.freeze([
  'PASS Cloudflare R2 read-only account analytics fetched (NOT billing certification).',
  'HOLD: Analytics may be delayed/sampled and are not an authoritative account billing cap.',
  'READ ONLY: No secrets printed, deployments, D1/R2 object writes, uploads or previews.',
]);
export function summarizeWorkMediaReadOnlyPreflight({
  privacyOutput,accountOutput,
}={}){
  if(typeof privacyOutput!=='string'||privacyOutput.length>8192||
     typeof accountOutput!=='string'||accountOutput.length>8192)
    STOP('work_hq_media_read_only_receipt_invalid');
  const p=new Set(privacyOutput.split(/\r?\n/));
  const a=new Set(accountOutput.split(/\r?\n/));
  for(const line of requiredPrivacy)
    if(!p.has(line))STOP('work_hq_media_read_only_privacy_incomplete');
  for(const line of requiredUsage)
    if(!a.has(line))STOP('work_hq_media_read_only_usage_incomplete');
  if(privacyOutput.includes('STOP')||accountOutput.includes('STOP'))
    STOP('work_hq_media_read_only_receipt_invalid');
  const month=capture(accountOutput,'Observed UTC month: ');
  if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))
    STOP('work_hq_media_read_only_month_invalid');
  const storage=integer(accountOutput,'Observed Standard storage bytes: ');
  const objects=integer(accountOutput,'Observed Standard objects: ');
  const other=integer(accountOutput,'Observed other-class bytes: ');
  const requests=integer(accountOutput,'Observed R2 requests in current UTC month: ');
  const kinds=integer(accountOutput,'Observed operation types: ');
  // Bucket inspector already enforces the target bucket is empty. Account
  // metrics may include other buckets, so do NOT mandate account zero.
  if(kinds>1000)STOP('work_hq_media_read_only_receipt_invalid');
  return Object.freeze({
    state:'read_only_work_privacy_and_account_analytics_observed',
    target_work_bucket_private_and_empty:true,
    target_work_bucket_standard:true,
    target_work_bucket_public_domain_count:0,
    account_storage_bytes_observed:storage,
    account_objects_observed:objects,
    other_class_bytes_observed:other,
    account_requests_month_observed:requests,
    operation_types_observed:kinds,
    observed_month_utc:month,
    media_activation_flag_state_verified:false,
    remote_r2_binding_enabled:false,
    completeness_and_billing_guaranteed:false,
    account_usage_may_be_delayed:true,
    can_authorize_r2_upload:false,
    can_authorize_d1_migrations:false,
    can_authorize_deployment:false,
    customer_preview_enabled:false,
  });
}
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:15000,
  }).trim();}catch{STOP('work_hq_media_git_unverified');}
}
function attestCheckout(){
  if(git('branch','--show-current')!==BRANCH||
     git('rev-parse','HEAD')!==
       git('rev-parse','refs/remotes/origin/'+BRANCH)||
     git('status','--porcelain','--untracked-files=no'))
    STOP('work_hq_media_git_unverified');
}
function invokeReadonly(label,script){
  if(!Object.values(files).includes(script)||!existsSync(script))
    STOP('work_hq_media_inspector_unavailable');
  const proc=spawnSync(process.execPath,[script,'--inspect'],{
    cwd:ROOT,encoding:'utf8',shell:false,windowsHide:true,
    timeout:150000,maxBuffer:32*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  // Child output is never blindly echoed to avoid unexpected leakage.
  if(proc.error||proc.status!==0)STOP(
    label==='privacy'?'work_hq_media_private_bucket_unverified':
      'work_hq_media_account_analytics_unverified');
  if(typeof proc.stdout!=='string')STOP('work_hq_media_read_only_invalid');
  return proc.stdout;
}
const called=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(called){
  let step='arguments';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      STOP('work_hq_media_read_only_only');
    step='clean_branch';
    attestCheckout();
    step='read_only_private_bucket';
    const privacyOutput=invokeReadonly('privacy',files.privacy);
    step='read_only_account_analytics';
    const accountOutput=invokeReadonly('account',files.account);
    step='receipt';
    const receipt=summarizeWorkMediaReadOnlyPreflight({
      privacyOutput,accountOutput,
    });
    if(receipt.observed_month_utc!==new Date().toISOString().slice(0,7))
      STOP('work_hq_media_read_only_stale_month');
    console.log('PASS JILL WORK private R2 bucket: Standard, empty, no public URLs or domains.');
    console.log('PASS JILL WORK deploy manifests: R2 binding absent (READ ONLY).');
    console.log('Observed UTC month: '+receipt.observed_month_utc);
    console.log('Observed all-account Standard bytes: '+
      receipt.account_storage_bytes_observed);
    console.log('Observed all-account R2 objects: '+
      receipt.account_objects_observed);
    console.log('Observed all-account R2 operations this month: '+
      receipt.account_requests_month_observed);
    console.log('HOLD: Account analytics may lag, and no hard Cloudflare spending cap or customer upload authority exists.');
    console.log('READ ONLY: No deployments, customer media access, R2 object PUT/GET, D1 mutations or paid activation.');
  }catch(error){
    const c=String(error?.message||'work_hq_media_read_only_unverified');
    const safe=/^work_hq_media_[a-z0-9_]+$/.test(c)?c:
      'work_hq_media_read_only_unverified';
    console.error('STOP WORK MEDIA PREFLIGHT: '+safe);
    console.error('READ ONLY PHASE: '+step);
    process.exitCode=1;
  }
}
