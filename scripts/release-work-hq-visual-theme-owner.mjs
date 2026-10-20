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
export function visualBaseline(state,{base=VISUAL_BASE,deployment=VISUAL_DEPLOYMENT}={}){
  check(state?.deployment===deployment&&state.versions?.length===2&&
    state.versions.some(x=>x.id===base&&x.percentage===100)&&
    state.versions.some(x=>x.id===HQ_QUOTE&&x.percentage===0),'baseline_changed');
}
export function inspectVisualCandidate({original,base,candidate,source,baseId=VISUAL_BASE,baseSource=CONNECTED_SOURCE}){
  inspectConnectedVersion({active:original,candidate:base,source:baseSource});
  check(base.id===baseId,'base_version_changed');
  const result=inspectConnectedVersion({active:original,candidate,source});
  check(candidate.id!==baseId&&candidate.resources.script.etag!==base.resources.script.etag,'visual_code_unverified');
  const ordered=x=>[...x.resources.bindings].sort((a,b)=>a.name.localeCompare(b.name));
  check(isDeepStrictEqual(ordered(base),ordered(candidate)),'current_bindings_changed');
  return {...result,visual_only:true,current_flags_and_bindings_preserved:true};
}
export function ownedVisualAllocation(state,attempt,{restored=false,base=VISUAL_BASE,deployment=VISUAL_DEPLOYMENT,activate=ACTIVATE,restore=RESTORE}={}){
  check(UUID.test(attempt?.candidate||'')&&![base,HQ_ACTIVE,HQ_QUOTE].includes(attempt.candidate)&&
    UUID.test(attempt?.nonce||'')&&UUID.test(state?.deployment||'')&&state.deployment!==deployment&&
    state.message===(restored?restore:activate)+attempt.nonce&&state.versions?.length===2&&
    state.versions.some(x=>x.id===(restored?base:attempt.candidate)&&x.percentage===100)&&
    state.versions.some(x=>x.id===HQ_QUOTE&&x.percentage===0),'deployment_not_owned');
}
function metadata(candidate,source,profile){
  const baseId=profile?.base||VISUAL_BASE,baseSource=profile?.baseSource||CONNECTED_SOURCE;
  const original=view(HQ_ACTIVE),base=view(baseId);
  check(base.id===baseId,'base_version_changed');
  verifyQuoteCanary(original,view(HQ_QUOTE));
  inspectConnectedVersion({active:original,candidate:base,source:baseSource});
  return candidate?{...inspectVisualCandidate({original,base,candidate:view(candidate),source,baseId,baseSource}),
    visual_only:profile?.visualOnly??true,...(profile?.changeScope?{change_scope:profile.changeScope}:{})}:null;
}
function deploy(id,message){cloud(['versions','deploy',id+'@100',HQ_QUOTE+'@0',
  '--name',HQ_WORKER,'--config','./wrangler.canary.jsonc','--message',message,'--yes']);}
async function restore(attempt,file,profile){
  const base=profile?.base||VISUAL_BASE,restoreMessage=profile?.restore||RESTORE;
  const before=readConnectedDeployment();ownedVisualAllocation(before,attempt,profile);
  metadata(attempt.candidate,attempt.source,profile);sourceGuard();
  check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_before_restore');
  reserveConnectedAttempt(file,{operation:profile?.restoreOperation||'HQ_VISUAL_V1_RESTORE',activation:before.deployment,nonce:attempt.nonce});
  let acknowledged=true;try{deploy(base,restoreMessage+attempt.nonce);}catch{acknowledged=false;}
  const after=readConnectedDeployment();ownedVisualAllocation(after,attempt,{...profile,restored:true});
  check(after.deployment!==before.deployment,'restore_deployment_unverified');
  const health=await readConnectedHealth(base);
  check(isDeepStrictEqual(after,readConnectedDeployment()),'changed_after_restore');
  return {allocation:after,health,baseline_restored:true,restore_acknowledged:acknowledged,restore_receipt_spent:true};
}
export async function executeVisualRelease(mode,profile){
  const base=profile?.base||VISUAL_BASE;
  const guard=profile?.guard||checkWorkHqVisualOnly;
  const stem=profile?.receiptStem||'work-hq-visual-theme-v1';
  const activationOperation=profile?.activationOperation||'HQ_VISUAL_V1_ACTIVATE';
  let uploadReserved=false,activationReserved=false,attempt=null,restoreFile=null,phase='preflight';
  try{
    const runner=sourceGuard();guard();
    const directory=path.dirname(connectedUploadReceipt()); // Directory only; never opens any old receipt.
    const uploadFile=path.join(directory,stem+'-upload-once-20261019.json');
    const activationFile=path.join(directory,stem+'-activate-once-20261019.json');
    restoreFile=path.join(directory,stem+'-restore-once-20261019.json');
    const upload=readConnectedReceipt(uploadFile,{optional:true});
    attempt=readConnectedReceipt(activationFile,{optional:true});
    if(mode==='--inspect'){
      const before=readConnectedDeployment(),source=upload?.source||runner;
      const id=findVersion(read(['versions','list']),source);
      const candidate=metadata(id,source,profile);
      let health;try{health=await readConnectedHealth(before.versions.some(x=>x.id===id&&x.percentage===100)?id:base);}
      catch{health={state:'unverified'};}
      check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_during_inspection');
      console.log(JSON.stringify({environment:'WORK',mode:'read_only',allocation:before,candidate,health,
        upload_receipt_present:upload!==null,activation_receipt_present:attempt!==null,
        restore_receipt_present:fs.existsSync(restoreFile),no_upload_or_deployment:true,no_signed_post:true},null,2));return;
    }
    if(mode==='--restore-once'){
      check(attempt!==null&&attempt.operation===activationOperation&&attempt.retry_allowed===false,'activation_receipt_unverified');
      console.log(JSON.stringify({environment:'WORK',...await restore(attempt,restoreFile,profile),operational_acceptance:false},null,2));return;
    }
    check(upload===null&&attempt===null&&!fs.existsSync(restoreFile),'release_receipt_spent_inspect_only');
    const before=readConnectedDeployment();visualBaseline(before,profile);metadata(undefined,undefined,profile);await readConnectedHealth(base);
    check(findVersion(read(['versions','list']),runner)===null,'source_already_uploaded');
    phase='local_source_checks';
    runNpm(profile?.checkCommand||'work:hq:visuals:check',ROOT);runNpm('test:work-hq-visual-release',ROOT);
    if(profile?.testCommand)runNpm(profile.testCommand,ROOT);
    // Optional isolated source composition for a NEW reviewed profile. Older
    // profiles retain their original build directory and spent receipts.
    const buildApp=profile?.prepareBuild?profile.prepareBuild({runner}):APP;
    runNpm('typecheck',buildApp);
    const dist=path.join(buildApp,'dist');
    if(fs.existsSync(dist)){
      check(!fs.lstatSync(dist).isSymbolicLink(),'symlinked_build_directory');
      fs.renameSync(dist,path.join(tmpdir(),'jill-hq-visual-previous-'+randomUUID()));
    }
    runNpm('build',buildApp,{canary:true});runNpm('test:workerd-connected-read-local',buildApp);
    for(const test of profile?.compiledTests||[])runNpm(test,buildApp);
    const target=path.join(buildApp,'dist/server/wrangler.hq-visual-theme.json');
    fs.writeFileSync(target,JSON.stringify(prepareConnectedManifest(JSON.parse(fs.readFileSync(path.join(buildApp,'dist/server/wrangler.json'),'utf8'))),null,2)+'\n',{mode:0o600});
    const args=['versions','upload','--config',target,'--keep-vars','--message',HQ_MARKER+runner];
    cloud([...args,'--dry-run']);check(sourceGuard()===runner,'source_changed');guard();
    metadata(undefined,undefined,profile);check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_before_upload');
    const digest=bundleDigest(dist);phase='inactive_upload';
    reserveConnectedAttempt(uploadFile,{operation:profile?.uploadOperation||'HQ_VISUAL_V1_INACTIVE_UPLOAD',source:runner,package_sha256:digest,baseline:before});uploadReserved=true;
    cloud(args);check(isDeepStrictEqual(before,readConnectedDeployment()),'changed_after_upload');
    const id=findVersion(read(['versions','list']),runner);check(id!==null,'upload_unverified');
    const candidate=metadata(id,runner,profile);
    check(sourceGuard()===runner&&isDeepStrictEqual(before,readConnectedDeployment()),'changed_before_activation');
    attempt={operation:activationOperation,source:runner,package_sha256:digest,candidate:id,nonce:randomUUID(),retry_allowed:false};
    phase='activation';reserveConnectedAttempt(activationFile,attempt);activationReserved=true;
    let acknowledged=true;try{deploy(id,(profile?.activate||ACTIVATE)+attempt.nonce);}catch{acknowledged=false;}
    const after=readConnectedDeployment();ownedVisualAllocation(after,attempt,profile);
    metadata(id,runner,profile);const health=await readConnectedHealth(id);
    check(isDeepStrictEqual(after,readConnectedDeployment()),'changed_after_activation');
    console.log(JSON.stringify({environment:'WORK',runner,package_sha256:digest,candidate,allocation:after,health,
      command_acknowledged:acknowledged,upload_receipt_spent:true,activation_receipt_spent:true,
      current_flags_and_bindings_preserved:true,quote_canary_preserved:true,visual_only:profile?.visualOnly??true,
      ...(profile?.changeScope?{change_scope:profile.changeScope}:{}),
      secret_changes:false,data_or_schema_changes:false,new_billable_services:false,
      authenticated_visual_acceptance:false,operational_acceptance:false},null,2));
  }catch(error){
    const code=/^work_hq_[a-z_]+$/.test(error?.message)?error.message:'work_hq_visual_unverified';
    console.error('STOP '+code+' at '+phase+'.');
    if(error?.safeCliDiagnostic)console.error(JSON.stringify(error.safeCliDiagnostic));
    if(activationReserved){try{console.log(JSON.stringify({environment:'WORK',activation_verified:false,
      ...await restore(attempt,restoreFile,profile),operational_acceptance:false},null,2));}
      catch{console.error('HOLD: state/restoration unverified. Do not repeat; use '+(profile?.inspectCommand||'work:hq:visuals:inspect')+'.');}}
    else console.error(uploadReserved||mode==='--restore-once'?
      'Outcome may be uncertain. Do not repeat; use '+(profile?.inspectCommand||'work:hq:visuals:inspect')+'.':'No upload or activation requested.');
    process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||!['--release-once','--inspect','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_visual_explicit_mode_required');process.exitCode=1;
  }else await executeVisualRelease(process.argv[2]);
}
