// Read-only reconciliation after an ambiguous Google clasp create-deployment.
// NEVER invokes create/push/update/delete; no user secrets or customer records.
// The original v7 merchant list/write and v8 HQ deployments must not drift.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parseDeployments,PINNED,PREVIOUS_HQ,MARKER,
  SCRIPT_ID,SHEET_ID}
  from './stage-work-hq-qa-detail-deployment.mjs';
import {verifyLocalWorkQaIdentity,runReadOnlyClasp}
  from './audit-work-qa-script-readonly.mjs';

export function reconcileWorkQaDetailVersions(deployments){
  if(!(deployments instanceof Map))throw Error('invalid_deployment_listing');
  if(deployments.get(PINNED)?.version!==7 ||
     deployments.get(PREVIOUS_HQ)?.version!==8)
    throw Error('protected_qa_deployment_drift');
  const matching=[...deployments].filter(([,info])=>info.description===MARKER);
  if(matching.length>1)throw Error('multiple_detail_deployments');
  if(matching.some(([id])=>id===PINNED||id===PREVIOUS_HQ))
    throw Error('protected_qa_deployment_repurposed');
  if(matching.length===0)return Object.freeze({
    state:'not_found',deploymentId:null,version:null,
  });
  const [deploymentId,info]=matching[0];
  if(!/^AKfycb[A-Za-z0-9_-]{20,}$/.test(deploymentId)||
     !Number.isSafeInteger(info.version)||info.version<=8)
    throw Error('unverified_detail_deployment');
  return Object.freeze({
    state:'present_unprobed',deploymentId,version:info.version,
  });
}
export async function reconcileWorkQaDetailRemote({
  root=process.cwd(),read=runReadOnlyClasp,
}={}){
  const known=verifyLocalWorkQaIdentity(root);
  if(known.scriptId!==SCRIPT_ID||known.sheetId!==SHEET_ID)
    throw Error('wrong_work_qa_identity');
  if(typeof read!=='function')throw Error('invalid_read_only_adapter');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jill-qa-detail-reconcile-'));
  try{
    fs.writeFileSync(path.join(dir,'.clasp.json'),
      JSON.stringify({scriptId:SCRIPT_ID})+'\n');
    // The only allowed remote action is list-deployments.
    return reconcileWorkQaDetailVersions(parseDeployments(
      read(dir,'list-deployments')));
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
async function main(){
  if(process.argv.length!==2)throw Error('unsupported_mode');
  const root=process.cwd();
  const branch=execFileSync('git',['branch','--show-current'],
    {cwd:root,encoding:'utf8'}).trim();
  if(branch!=='jill/rewards-work')throw Error('wrong_work_branch');
  const result=await reconcileWorkQaDetailRemote({root});
  console.log('PASS isolated WORK QA script identity and original /exec v7/v8 unchanged.');
  if(result.state==='present_unprobed'){
    console.log('FOUND ONE NEW QA detail deployment: '+result.deploymentId);
    console.log('VERSION: @'+result.version);
    console.log('STATE: CREATED, NOT YET HMAC-PROBED, NOT CONNECTED TO HQ.');
    console.log('DO NOT rerun create-deployment; next pin and test this exact ID.');
  }else{
    console.log('NO detail deployment with expected marker found in Google listing.');
    console.log('DO NOT automatically retry creation; inspect clasp error and versions.');
  }
  console.log('READ ONLY: no Google source, /exec, secrets, customer records, Cloudflare or LIVE changes.');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked)main().catch(error=>{
  const allowed=new Set(['wrong_work_branch','wrong_work_qa_identity',
    'invalid_deployment_listing','protected_qa_deployment_drift',
    'multiple_detail_deployments','protected_qa_deployment_repurposed',
    'unverified_detail_deployment','unsupported_mode']);
  console.error('WORK QA exact detail RECONCILIATION STOPPED: '+
    (allowed.has(error?.message)?error.message:'read_only_listing_failed'));
  process.exitCode=1;
});
