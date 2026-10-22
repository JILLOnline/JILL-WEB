// Exact staged WORK M1/M2 Version URL probe (NO deployment, upload or POST).
// Version URL supplied by Owner from Cloudflare Deployments page, not
// guessed from Worker version ID or from versions-view JSON structure.
// Probes only public /healthz of exact existing Worker version, checks
// current WORK allocation and all original bindings / code integrity.
// Does not authorize version activation or any paid resources.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {certifyM1M2SourceEdition} from './certify-work-hq-m1-m2-source-edition.mjs';
import {readConnectedHealth} from './release-work-hq-connected-read-owner.mjs';
import {receiptPath} from './probe-work-gateway-connection-owner.mjs';
import {read,view,allocation,bundleDigest} from './stage-work-hq-connected-read-owner.mjs';
import {inspectM1M2WorkRuntime} from './inspect-work-hq-m1-m2-owner.mjs';
import {BASELINE,assertBaseline,assertCandidate,planM1M2StageManifest}
 from './stage-work-hq-m1-m2-owner.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BRANCH='jill/m1-work-queue-preview-20261021';
export const STAGED=Object.freeze({
 source:'3d525437fb7c3ffc89a9974a00d4a4fa1deb907b',
 candidate:'cd233caa-0128-4b22-bf68-002caf2ecf65',
 package:'6f22f2cfe432f26126c5d793f858a0722b06bb79910ca9c3f4ff5747e95b71f8',
});
const WORKER='jill-order-desk-canary-work';
const fail=reason=>{throw Error('m1m2_probe_'+reason);};
const gate=(ok,reason)=>{if(!ok)fail(reason);};
const equal=(a,b)=>isDeepStrictEqual(a,b);
function git(...args){
 return execFileSync('git',['-C',ROOT,...args],{
  timeout:15000,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
export function approvedVersionUrl(input){
 gate(typeof input==='string'&&input.length<300,'url_invalid');
 let url;
 try{url=new URL(input);}catch{fail('url_invalid');}
 // Do not make a network request to an unapproved address or an impostor.
 gate(url.protocol==='https:'&&url.port===''&&url.username===''&&
  url.password===''&&url.pathname==='/'&&url.search===''&&url.hash==='',
  'url_invalid');
 const re=/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?-jill-order-desk-canary-work\.[a-z0-9-]+\.workers\.dev$/;
 gate(re.test(url.hostname),'url_host_unapproved');
 return url;
}
export function certifyCandidateHealth({status,mime,location,body,version,
 cache}={}){
 gate(status===200&&location===null&&mime==='application/json'&&
  typeof cache==='string'&&/(?:^|,)\s*no-store(?:,|$)/i.test(cache)&&
  version===STAGED.candidate&&
  equal(body,{ok:true,environment:'JILL_ORDER_DESK_WORK',
   database_ready:true,admin_ready:false}),
  'candidate_health_unverified');
 return Object.freeze({health:200,exact_version:version,
  database_ready:true,no_redirects:true,cache_disabled:true});
}
function sourceGuard(){
 gate(process.platform==='win32','owner_windows_only');
 const root=fs.realpathSync(ROOT).toLowerCase();
 const temp=fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep;
 gate(root.startsWith(temp)&&
  path.basename(root).startsWith('jill_m1_m2_qa_')&&
  git('branch','--show-current')===BRANCH&&
  git('status','--porcelain','--untracked-files=no')===''&&
  git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/'+BRANCH)&&
  git('merge-base','--is-ancestor',STAGED.source,'HEAD')===''&&
  certifyM1M2SourceEdition().ok===true,'preview_source_unverified');
}
function stagedReceipt(){
 const file=path.join(path.dirname(receiptPath()),
  'work-hq-m1-m2-inactive-upload-once-'+STAGED.source+'.json');
 gate(fs.existsSync(file)&&!fs.lstatSync(file).isSymbolicLink(),
  'upload_receipt_missing');
 const raw=fs.readFileSync(file,'utf8');
 gate(raw.length<4096,'upload_receipt_invalid');
 let value;
 try{value=JSON.parse(raw);}catch{fail('upload_receipt_invalid');}
 gate(value?.operation==='HQ_M1_M2_WORK_INACTIVE_UPLOAD'&&
  value.source===STAGED.source&&
  value.package_sha256===STAGED.package&&
  value.retry_allowed===false&&
  /^[a-f0-9-]{36}$/.test(value.nonce||''),
  'upload_receipt_invalid');
 assertBaseline(value.baseline);
 return value;
}
async function metadata(){
 const inventory=await inspectM1M2WorkRuntime({
  readMetadata:args=>read(args),readHealth:readConnectedHealth});
 gate(inventory.status==='READ_ONLY_RUNTIME_VERIFIED'&&
  inventory.observed_deployment===BASELINE.deployment&&
  inventory.active_version===BASELINE.active&&
  inventory.quote_canary===BASELINE.quote,
  'runtime_inventory_unverified');
 const deployed=allocation();assertBaseline(deployed);
 const proof=stagedReceipt();
 gate(equal(proof.baseline,deployed),'deployment_changed_since_upload');
 const active=view(BASELINE.active),quote=view(BASELINE.quote);
 const candidate=view(STAGED.candidate);
 const dir=path.join(APP,'dist');
 gate(fs.existsSync(dir)&&!fs.lstatSync(dir).isSymbolicLink()&&
  bundleDigest(dir)===STAGED.package,'staged_package_changed');
 const compiled=JSON.parse(fs.readFileSync(
  path.join(dir,'server/wrangler.json'),'utf8'));
 const planned=planM1M2StageManifest({
  baseline:deployed,active,quote},compiled);
 gate(planned.state==='LOCAL_DRY_RUN_MANIFEST_PREPARED',
  'local_manifest_invalid');
 const marker='JILL HQ WORK M1+M2 source-locked INACTIVE '+
  STAGED.source+' '+proof.nonce;
 const result=assertCandidate({
  active,quote,candidate,marker,planned,baseline:deployed});
 gate(result.candidate_id===STAGED.candidate,'wrong_uploaded_candidate');
 return {deployed,candidate:result};
}
async function request(url){
 const endpoint=new URL('/healthz',url);
 endpoint.searchParams.set('jill_work_hq_read_only_version_check','1');
 const response=await fetch(endpoint,{
  method:'GET',redirect:'manual',headers:{
   Accept:'application/json','Cache-Control':'no-store'},
  signal:AbortSignal.timeout(15000),
 });
 const content=await response.text();
 gate(content.length<=1024,'health_response_oversized');
 let body;
 try{body=JSON.parse(content);}catch{fail('health_json_invalid');}
 return certifyCandidateHealth({
  status:response.status,
  mime:(response.headers.get('content-type')||'').split(';')[0],
  location:response.headers.get('location'),body,
  version:response.headers.get('x-jill-work-hq-version'),
  cache:response.headers.get('cache-control'),
 });
}
export async function runProbe(mode,input){
 let phase='source';
 try{
  sourceGuard();
  // The default mode is a full zero-write provider inspection.
  phase='metadata';
  const before=await metadata();
  if(mode==='--inspect'){
   gate(equal(before.deployed,allocation()),
    'allocation_changed_during_inspection');
   console.log(JSON.stringify({
    status:'INACTIVE_M1_M2_CANDIDATE_STILL_VERIFIED',
    candidate_id:STAGED.candidate,environment:'WORK',
    current_deployment:BASELINE.deployment,
    old_active_100_percent:true,quote_canary_0_percent:true,
    new_version_0_percent:true,version_url_not_tested:true,
    read_only:true,uploads:false,deployments:false,
    new_billable_services:false},null,2));
   return;
  }
  gate(mode==='--url','mode_not_allowed');
  const url=approvedVersionUrl(input);
  phase='version_health';
  const healthy=await request(url);
  phase='allocation_after';
  const after=allocation();
  gate(equal(before.deployed,after),'deployment_changed_after_health');
  console.log(JSON.stringify({
   status:'EXACT_INACTIVE_M1_M2_VERSION_HEALTH_VERIFIED',
   ...healthy,environment:'WORK',candidate_id:STAGED.candidate,
   old_active_100_percent:true,quote_canary_0_percent:true,
   new_version_0_percent:true,no_upload_or_deployment:true,
   operational_owner_ui_verified:false,activation_authorized:false},null,2));
 }catch(error){
  const code=/^m1m2_(?:probe|stage)_[a-z_]+$/.test(error?.message||'')?
   error.message:'m1m2_probe_unverified';
  console.error('HOLD '+code+' at '+phase+
   '. No upload, deployment, configuration change or new paid service requested.');
  process.exitCode=1;
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if((process.argv.length===3&&process.argv[2]==='--inspect')){
  await runProbe('--inspect');
 }else if(process.argv.length===4&&process.argv[2]==='--url'){
  await runProbe('--url',process.argv[3]);
 }else{
  console.error('STOP explicit --inspect or --url <existing Cloudflare Version URL> required.');
  process.exitCode=1;
 }
}
