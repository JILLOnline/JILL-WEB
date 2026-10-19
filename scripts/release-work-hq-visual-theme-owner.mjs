// A NEW one-use WORK visual release. Existing deployment receipts stay spent.
// Only presentation source may differ; every current binding/flag is retained.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {isDeepStrictEqual} from 'node:util';
import {HQ_ACTIVE,HQ_QUOTE,HQ_WORKER,HQ_MARKER,sourceGuard,cloud,read,view,
  findVersion,runNpm,bundleDigest,prepareConnectedManifest,inspectConnectedVersion,
  reserveConnectedAttempt,connectedUploadReceipt} from './stage-work-hq-connected-read-owner.mjs';
import {CONNECTED_CANDIDATE,CONNECTED_SOURCE,verifyQuoteCanary,
  readConnectedDeployment,readConnectedHealth,readConnectedReceipt} from './release-work-hq-connected-read-owner.mjs';
import {checkWorkHqVisualOnly} from './check-work-hq-visual-only.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
export const VISUAL_BASE=CONNECTED_CANDIDATE;
export const VISUAL_DEPLOYMENT='d5d1f522-fcc0-4fbb-9052-dc9d951e6029';
const ACTIVATE='JILL HQ WORK visual theme v1 activate ';
const RESTORE='JILL HQ WORK visual theme v1 restore ';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const check=(ok,code)=>{if(!ok)throw Error('work_hq_visual_'+code);};
export function visualBaseline(state){
  check(state?.deployment===VISUAL_DEPLOYMENT&&state.versions?.length===2&&
    state.versions.some(x=>x.id===VISUAL_BASE&&x.percentage===100)&&
    state.versions.some(x=>x.id===HQ_QUOTE&&x.percentage===0),'baseline_changed');
}
export function inspectVisualCandidate({original,base,candidate,source}){
  inspectConnectedVersion({active:original,candidate:base,source:CONNECTED_SOURCE});
  check(base.id===VISUAL_BASE,'base_version_changed');
  const result=inspectConnectedVersion({active:original,candidate,source});
  check(candidate.id!==VISUAL_BASE&&candidate.resources.script.etag!==base.resources.script.etag,'visual_code_unverified');
  const ordered=x=>[...x.resources.bindings].sort((a,b)=>a.name.localeCompare(b.name));
  check(isDeepStrictEqual(ordered(base),ordered(candidate)),'current_bindings_changed');
  return {...result,visual_only:true,current_flags_and_bindings_preserved:true};
}
export function ownedVisualAllocation(state,attempt,{restored=false}={}){
  check(UUID.test(attempt?.candidate||'')&&![VISUAL_BASE,HQ_ACTIVE,HQ_QUOTE].includes(attempt.candidate)&&
    UUID.test(attempt?.nonce||'')&&UUID.test(state?.deployment||'')&&state.deployment!==VISUAL_DEPLOYMENT&&
    state.message===(restored?RESTORE:ACTIVATE)+attempt.nonce&&state.versions?.length===2&&
    state.versions.some(x=>x.id===(restored?VISUAL_BASE:attempt.candidate)&&x.percentage===100)&&
    state.versions.some(x=>x.id===HQ_QUOTE&&x.percentage===0),'deployment_not_owned');
}
function metadata(candidate,source){
  const original=view(HQ_ACTIVE),base=view(VISUAL_BASE);
  check(base.id===VISUAL_BASE,'base_version_changed');
  verifyQuoteCanary(original,view(HQ_QUOTE));
  inspectConnectedVersion({active:original,candidate:base,source:CONNECTED_SOURCE});
  return candidate?inspectVisualCandidate({original,base,candidate:view(candidate),source}):null;
}
function deploy(id,message){cloud(['versions','deploy',id+'@100',HQ_QUOTE+'@0',
  '--name',HQ_WORKER,'--config','./wrangler.canary.jsonc','--message',message,'--yes']);}
async function restore(attempt,file){
  const before=readConnectedDeployment();ownedVisualAllocation(before,attempt);
  metadata(attempt.candidate,attempt.source);sourceGuard();
  check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_before_restore');
  reserveConnectedAttempt(file,{operation:'HQ_VISUAL_V1_RESTORE',activation:before.deployment,nonce:attempt.nonce});
  let acknowledged=true;try{deploy(VISUAL_BASE,RESTORE+attempt.nonce);}catch{acknowledged=false;}
  const after=readConnectedDeployment();ownedVisualAllocation(after,attempt,{restored:true});
  check(after.deployment!==before.deployment,'restore_deployment_unverified');
  const health=await readConnectedHealth(VISUAL_BASE);
  check(isDeepStrictEqual(after,readConnectedDeployment()),'changed_after_restore');
  return {allocation:after,health,baseline_restored:true,restore_acknowledged:acknowledged,restore_receipt_spent:true};
}
async function execute(mode){
  let uploadReserved=false,activationReserved=false,attempt=null,restoreFile=null,phase='preflight';
  try{
    const runner=sourceGuard();checkWorkHqVisualOnly();
    const directory=path.dirname(connectedUploadReceipt()); // Directory only; never opens any old receipt.
    const uploadFile=path.join(directory,'work-hq-visual-theme-v1-upload-once-20261019.json');
    const activationFile=path.join(directory,'work-hq-visual-theme-v1-activate-once-20261019.json');
    restoreFile=path.join(directory,'work-hq-visual-theme-v1-restore-once-20261019.json');
    const upload=readConnectedReceipt(uploadFile,{optional:true});
    attempt=readConnectedReceipt(activationFile,{optional:true});
    if(mode==='--inspect'){
      const before=readConnectedDeployment(),source=upload?.source||runner;
      const id=findVersion(read(['versions','list']),source);
      const candidate=metadata(id,source);
      let health;try{health=await readConnectedHealth(before.versions.some(x=>x.id===id&&x.percentage===100)?id:VISUAL_BASE);}
      catch{health={state:'unverified'};}
      check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_during_inspection');
      console.log(JSON.stringify({environment:'WORK',mode:'read_only',allocation:before,candidate,health,
        upload_receipt_present:upload!==null,activation_receipt_present:attempt!==null,
        restore_receipt_present:fs.existsSync(restoreFile),no_upload_or_deployment:true,no_signed_post:true},null,2));return;
    }
    if(mode==='--restore-once'){
      check(attempt!==null&&attempt.operation==='HQ_VISUAL_V1_ACTIVATE'&&attempt.retry_allowed===false,'activation_receipt_unverified');
      console.log(JSON.stringify({environment:'WORK',...await restore(attempt,restoreFile),operational_acceptance:false},null,2));return;
    }
    check(upload===null&&attempt===null&&!fs.existsSync(restoreFile),'release_receipt_spent_inspect_only');
    const before=readConnectedDeployment();visualBaseline(before);metadata();await readConnectedHealth(VISUAL_BASE);
    check(findVersion(read(['versions','list']),runner)===null,'source_already_uploaded');
    phase='local_visual_checks';
    runNpm('work:hq:visuals:check',ROOT);runNpm('test:work-hq-visual-release',ROOT);
    runNpm('typecheck',APP);
    const dist=path.join(APP,'dist');
    if(fs.existsSync(dist)){
      check(!fs.lstatSync(dist).isSymbolicLink(),'symlinked_build_directory');
      fs.renameSync(dist,path.join(tmpdir(),'jill-hq-visual-previous-'+randomUUID()));
    }
    runNpm('build',APP,{canary:true});runNpm('test:workerd-connected-read-local',APP);
    const target=path.join(APP,'dist/server/wrangler.hq-visual-theme.json');
    fs.writeFileSync(target,JSON.stringify(prepareConnectedManifest(JSON.parse(fs.readFileSync(path.join(APP,'dist/server/wrangler.json'),'utf8'))),null,2)+'\n',{mode:0o600});
    const args=['versions','upload','--config',target,'--keep-vars','--message',HQ_MARKER+runner];
    cloud([...args,'--dry-run']);check(sourceGuard()===runner,'source_changed');checkWorkHqVisualOnly();
    metadata();check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_before_upload');
    const digest=bundleDigest(path.join(APP,'dist'));phase='inactive_upload';
    reserveConnectedAttempt(uploadFile,{operation:'HQ_VISUAL_V1_INACTIVE_UPLOAD',source:runner,package_sha256:digest,baseline:before});uploadReserved=true;
    cloud(args);check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_after_upload');
    const id=findVersion(read(['versions','list']),runner);check(id!==null,'upload_unverified');
    const candidate=metadata(id,runner);
    check(sourceGuard()===runner&&isDeepStrictEqual(before,readConnectedDeployment()),'changed_before_activation');
    attempt={operation:'HQ_VISUAL_V1_ACTIVATE',source:runner,package_sha256:digest,candidate:id,nonce:randomUUID(),retry_allowed:false};
    phase='activation';reserveConnectedAttempt(activationFile,attempt);activationReserved=true;
    let acknowledged=true;try{deploy(id,ACTIVATE+attempt.nonce);}catch{acknowledged=false;}
    const after=readConnectedDeployment();ownedVisualAllocation(after,attempt);
    metadata(id,runner);const health=await readConnectedHealth(id);
    check(isDeepStrictEqual(after,readConnectedDeployment()),'changed_after_activation');
    console.log(JSON.stringify({environment:'WORK',runner,package_sha256:digest,candidate,allocation:after,health,
      command_acknowledged:acknowledged,upload_receipt_spent:true,activation_receipt_spent:true,
      current_flags_and_bindings_preserved:true,quote_canary_preserved:true,visual_only:true,
      secret_changes:false,data_or_schema_changes:false,new_billable_services:false,
      authenticated_visual_acceptance:false,operational_acceptance:false},null,2));
  }catch(error){
    const code=/^work_hq_[a-z_]+$/.test(error?.message)?error.message:'work_hq_visual_unverified';
    console.error('STOP '+code+' at '+phase+'.');
    if(error?.safeCliDiagnostic)console.error(JSON.stringify(error.safeCliDiagnostic));
    if(activationReserved){try{console.log(JSON.stringify({environment:'WORK',activation_verified:false,
      ...await restore(attempt,restoreFile),operational_acceptance:false},null,2));}
      catch{console.error('HOLD: state/restoration unverified. Do not repeat; use work:hq:visuals:inspect.');}}
    else console.error(uploadReserved||mode==='--restore-once'?
      'Outcome may be uncertain. Do not repeat; use work:hq:visuals:inspect.':'No upload or activation requested.');
    process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||!['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_visual_explicit_mode_required');process.exitCode=1;
  }else await execute(process.argv[2]);
}
