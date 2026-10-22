// READ ONLY: exact already-uploaded JILL HQ connected-content WORK candidate.
// Source-locked recovery after one-use upload succeeded, but the previous
// --inspect hit a transient/ambiguous 5-read provider preflight HOLD.
// No versions list/pagination, upload, deployment, D1, R2 or customer writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {certifyM1M2SourceEdition} from './certify-work-hq-m1-m2-source-edition.mjs';
import {receiptPath} from './probe-work-gateway-connection-owner.mjs';
import {read,view,bundleDigest} from './stage-work-hq-connected-read-owner.mjs';
import {currentAllocation} from './collect-work-runtime-readonly.mjs';
import {readConnectedHealth} from './release-work-hq-connected-read-owner.mjs';
import {BASELINE,assertBaseline,assertCandidate,
 planM1M2StageManifest} from './stage-work-hq-connected-content-owner.mjs';
import {evaluateConnectedContentInventory} from './inspect-work-hq-connected-content-owner.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BRANCH='jill/m1-work-queue-preview-20261021';
export const UPLOADED=Object.freeze({
 source:'0f768ff6ffb4ca6000d9d113f5e3fd5977947783',
 candidate:'44ad4a81-55ad-4f49-9965-61260cc2294d',
 package:'ac1c63b53cb90d131996fa6320e02e0581d7687669827f14272ef06e6261f435',
});
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const HEADER='JILL HQ WORK CONNECTED-CONTENT source-locked INACTIVE ';
const fail=code=>{throw Error('connected_content_recovery_'+code);};
const gate=(ok,reason)=>{if(!ok)fail(reason);};
const same=(a,b)=>isDeepStrictEqual(a,b);
export function verifyUploadedConnectedContentReceipt(p){
 gate(p?.operation==='HQ_CONNECTED_CONTENT_WORK_INACTIVE_UPLOAD'&&
  p.source===UPLOADED.source&&p.package_sha256===UPLOADED.package&&
  p.retry_allowed===false&&UUID.test(p.nonce||''),
  'exact_upload_receipt_missing');
 assertBaseline(p.baseline);
 return HEADER+UPLOADED.source+' '+p.nonce;
}
export function evaluateUploadedConnectedContentProof({before,after,active,quote,candidate,
  health,receipt,compiled,digest}={}){
 const marker=verifyUploadedConnectedContentReceipt(receipt);
 gate(same(before,receipt.baseline)&&same(before,after),
  'original_allocation_changed');
 const baseline=evaluateConnectedContentInventory({before,after,active,quote,health});
 gate(baseline.status==='READ_ONLY_CONNECTED_CONTENT_BASELINE_VERIFIED',
  'baseline_'+(baseline.reason||'unverified'));
 gate(digest===UPLOADED.package,'original_uploaded_package_changed');
 const planned=planM1M2StageManifest({baseline:before,active,quote},compiled);
 gate(planned.state==='LOCAL_DRY_RUN_MANIFEST_PREPARED',
  'original_manifest_unverified');
 const checked=assertCandidate({active,quote,candidate,
  marker,planned,baseline:before});
 gate(checked.candidate_id===UPLOADED.candidate,
  'wrong_uploaded_candidate');
 return Object.freeze({
  status:'CONNECTED_CONTENT_INACTIVE_WORK_CANDIDATE_VERIFIED',
  environment:'WORK',source:UPLOADED.source,
  candidate_id:UPLOADED.candidate,package_sha256:UPLOADED.package,
  active_version:BASELINE.active,active_percentage:100,
  preserved_quote_canary:BASELINE.quote,quote_percentage:0,
  deployment:BASELINE.deployment,
  source_and_receipt_verified:true,bindings_preserved:true,
  runtime_preserved:true,source_code_changed:true,
  database_ready:true,upload_receipt_spent:true,
  upload_requested:false,deployment_requested:false,
  traffic_changed:false,new_paid_resources:false,
  activation_authorized:false
 });
}
function git(...args){
 return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trim();
}
function sourceGuard(){
 gate(process.platform==='win32','owner_windows_only');
 const root=fs.realpathSync(ROOT).toLowerCase();
 const temp=fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep;
 gate(root.startsWith(temp)&&path.basename(root).startsWith('jill_m1_m2_qa_'),
  'isolated_checkout_required');
 gate(git('branch','--show-current')===BRANCH&&
  git('status','--porcelain','--untracked-files=no')===''&&
  git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/'+BRANCH)&&
  certifyM1M2SourceEdition().ok===true,
  'current_source_certification_failed');
 try{git('merge-base','--is-ancestor',UPLOADED.source,'HEAD');}
 catch{fail('uploaded_source_not_ancestor');}
}
function uploadedReceipt(){
 const file=path.join(path.dirname(receiptPath()),
  'work-hq-connected-content-inactive-upload-once-'+UPLOADED.source+'.json');
 gate(fs.existsSync(file)&&!fs.lstatSync(file).isSymbolicLink(),
  'upload_receipt_unavailable');
 const raw=fs.readFileSync(file,'utf8');
 gate(raw.length>0&&raw.length<4096,'unsafe_receipt_size');
 let data;try{data=JSON.parse(raw);}catch{fail('invalid_receipt_json');}
 verifyUploadedConnectedContentReceipt(data);
 return data;
}
async function inspect(){
 sourceGuard();
 const receipt=uploadedReceipt();
 // Versions list is advisory/paginated; use direct exact version view.
 const before=currentAllocation(read(['deployments','list']));
 assertBaseline(before);
 const active=view(BASELINE.active);
 const quote=view(BASELINE.quote);
 const candidate=view(UPLOADED.candidate);
 const health=await readConnectedHealth(BASELINE.active);
 const after=currentAllocation(read(['deployments','list']));
 const dir=path.join(APP,'dist');
 gate(fs.existsSync(dir)&&!fs.lstatSync(dir).isSymbolicLink(),
  'original_compiled_package_missing');
 const compiledPath=path.join(dir,'server/wrangler.json');
 gate(fs.existsSync(compiledPath)&&!fs.lstatSync(compiledPath).isSymbolicLink(),
  'original_compiled_manifest_missing');
 const compiled=JSON.parse(fs.readFileSync(compiledPath,'utf8'));
 return evaluateUploadedConnectedContentProof({
  before,after,active,quote,candidate,health,
  receipt,compiled,digest:bundleDigest(dir)
 });
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||process.argv[2]!=='--inspect'){
  console.error('STOP ONLY --inspect IS SUPPORTED; NO UPLOAD/DEPLOY.');
  process.exitCode=1;
 }else{
  try{console.log(JSON.stringify(await inspect(),null,2));}
  catch(e){
   const code=/^connected_content_recovery_[a-z_]+$/.test(e?.message||'')?
    e.message:'connected_content_recovery_unverified';
   console.error('HOLD '+code+
    ' — READ ONLY. DO NOT rerun the spent five-tab upload.');
   process.exitCode=1;
  }
 }
}
