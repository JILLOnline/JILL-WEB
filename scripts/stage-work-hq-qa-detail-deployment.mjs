// WORK-only Google QA detail deployment. Default INSPECT is READ-ONLY.
// --stage creates a NEW /exec deployment with immutable new script version.
// NEVER updates the existing v7 list/write deployment or v8 HQ deployment.
// Requires explicit typed local owner consent. Secrets remain in Script
// Properties; nothing in here reads/prints their values.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {verifyLocalWorkQaIdentity,runReadOnlyClasp,
  auditWorkQaReadOnly} from './audit-work-qa-script-readonly.mjs';

const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
export const SCRIPT_ID='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
export const SHEET_ID='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
export const PINNED='AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V';
export const PREVIOUS_HQ='AKfycby6C2Y2HMZB-vHyAikK-X8hrHhoXFSx-iU0o3w2qj4iO9J1jzo4P1rBJ7z3uqXkEvCN';
export const MARKER='JILL_HQ_WORK_EXACT_DETAIL_V1';
export const APPROVAL='CREATE JILL HQ WORK DETAIL QA DEPLOYMENT';
const DEPLOYMENT=/^AKfycb[A-Za-z0-9_-]{20,}$/;

function stop(code){throw Error(code);}
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function parseDeployments(source) {
  if(typeof source!=='string'||source.length>16384)
    stop('invalid_deployments');
  const out=new Map();
  for(const line of source.split(/\r?\n/)){
    const found=line.match(/(AKfycb[A-Za-z0-9_-]{20,})\s+@([1-9][0-9]*)\s+-?\s*(.*)$/);
    if(!found)continue;
    if(out.has(found[1]))stop('duplicate_deployment');
    const n=Number(found[2]);
    if(!Number.isSafeInteger(n))stop('invalid_deployments');
    out.set(found[1],{version:n,description:found[3].trim()});
  }
  if(!out.size)stop('missing_deployments');
  return out;
}
export function certifyDetailQaGate({head,remote,branch,dirty,identity,
  audit,deployments,canonicalSource}={}) {
  if(branch!=='jill/rewards-work'||dirty!==''||
    !/^[a-f0-9]{40}$/.test(head||'')||head!==remote)
    stop('git_not_synced');
  if(identity?.scriptId!==SCRIPT_ID||identity?.sheetId!==SHEET_ID)
    stop('wrong_work_qa_identity');
  if(audit?.historicalCommit!==head||
    audit?.headMatchesCertifiedGit!==true||
    audit?.publishedRevisionVerified!==true||
    !Number.isSafeInteger(audit?.publishedVersion))
    stop('uncertified_google_qa_head');
  const p=deployments;
  if(!(p instanceof Map)||!p.has(PINNED)||!p.has(PREVIOUS_HQ))
    stop('protected_qa_deployment_missing');
  if(p.get(PINNED).version!==audit.publishedVersion)
    stop('protected_pinned_version_drift');
  if(typeof canonicalSource!=='string' ||
    !canonicalSource.includes('function jillWorkHqMerchantDetailVerified_(') ||
    !canonicalSource.includes('function jillWorkHqCanonicalDetail_(') ||
    !canonicalSource.includes('function jillWorkHqMerchantDetail_(') ||
    !canonicalSource.includes('jill_order_merchant_detail') ||
    !canonicalSource.includes('const JILL_CUSTOM_ORDER_SANDBOX = false;'))
    stop('detail_source_incomplete');
  if([...p.values()].some(x=>x.description===MARKER))
    stop('detail_qa_already_staged');
  return Object.freeze({head,pinnedVersion:p.get(PINNED).version,
    otherVersion:p.get(PREVIOUS_HQ).version,deployments:p.size});
}
function git(...args){
  return execFileSync('git',['-C',process.cwd(),...args],
    {encoding:'utf8'}).trim();
}
async function inspect() {
  const root=process.cwd();
  const head=git('rev-parse','HEAD');
  const branch=git('branch','--show-current');
  const remote=git('rev-parse','refs/remotes/origin/jill/rewards-work');
  const dirty=git('status','--porcelain','--untracked-files=no');
  const identity=verifyLocalWorkQaIdentity(root);
  const audit=await auditWorkQaReadOnly({root});
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-qa-detail-read-'));
  try {
    fs.writeFileSync(path.join(temp,'.clasp.json'),
      JSON.stringify({scriptId:SCRIPT_ID})+'\n');
    const deployments=parseDeployments(runReadOnlyClasp(temp,'list-deployments'));
    const source=fs.readFileSync(
      path.join(root,'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs'),
      'utf8');
    const result=certifyDetailQaGate({
      head,remote,branch,dirty,identity,audit,deployments,
      canonicalSource:source,
    });
    return {...result,previous:deployments};
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
function createNewDeployment(){
  // NEVER pass --deploymentId: that would update an existing /exec.
  const args=['--yes','@google/clasp@3.4.1','create-deployment',
    '--description',MARKER];
  const win=process.platform==='win32';
  const result=spawnSync(win?'npx.cmd':'npx',args,{
    cwd:path.join(process.cwd(),'.work-custom-orders'),
    encoding:'utf8',shell:win,maxBuffer:512*1024,
  });
  if(result.error||result.status!==0)stop('qa_detail_creation_unconfirmed');
  return String(result.stdout||'');
}
async function main() {
  const mode=process.argv[2]||'--inspect';
  if(!['--inspect','--stage'].includes(mode)||process.argv.length>3)
    stop('unsupported_mode');
  const before=await inspect();
  console.log('PASS isolated WORK Google QA identity, HEAD matched Git '+before.head.slice(0,12));
  console.log('PASS existing pinned /exec @'+before.pinnedVersion+
    ' and separate HQ /exec @'+before.otherVersion+' unchanged.');
  console.log('PASS exact detail endpoint functions in canonical WORK QA build.');
  if(mode==='--inspect'){
    console.log('READ ONLY. Google editor HEAD, deployments, secrets and records unchanged.');
    return;
  }
  const rl=createInterface({input:process.stdin,output:process.stdout});
  let answer;
  try{answer=(await rl.question('Type '+APPROVAL+' to create NEW QA /exec: ')).trim();}
  finally{rl.close();}
  if(answer!==APPROVAL)stop('approval_not_given');
  // Revalidate source/deployment state immediately before creating a new
  // published endpoint. Never automatically update existing web apps.
  await inspect();
  let emitted;
  try{emitted=createNewDeployment();}
  catch{stop('qa_detail_creation_unconfirmed_inspect_before_retry');}
  const seen=emitted.match(/AKfycb[A-Za-z0-9_-]{20,}/g)||[];
  if(seen.length!==1||!DEPLOYMENT.test(seen[0])||
    [PINNED,PREVIOUS_HQ].includes(seen[0]))
    stop('qa_detail_creation_unconfirmed_inspect_before_retry');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-qa-detail-verify-'));
  try{
    fs.writeFileSync(path.join(temp,'.clasp.json'),
      JSON.stringify({scriptId:SCRIPT_ID})+'\n');
    const after=parseDeployments(runReadOnlyClasp(temp,'list-deployments'));
    const unexpected=[...after.keys()].filter(id=>!before.previous.has(id));
    const verified=after.get(seen[0]);
    if(unexpected.length!==1||unexpected[0]!==seen[0]||
      !verified||verified.description!==MARKER||
      ![...before.previous].every(([id,item])=>
        after.get(id)?.version===item.version))
      stop('qa_detail_creation_unconfirmed_inspect_before_retry');
    console.log('PASS NEW QA detail /exec DEPLOYMENT ID: '+seen[0]);
    console.log('PASS new immutable Google QA version @'+verified.version);
    console.log('PASS both previous QA deployments still on original versions.');
    console.log('NO Cloudflare, LIVE, KEEP, Rewards, Sheets records or status-write changes.');
    console.log('NEXT: pin this detail-only endpoint in a reviewed WORK Worker change; do not use it for inbox/status writes.');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked)main().catch(e=>{
  const allowed=new Set([
    'git_not_synced','wrong_work_qa_identity','uncertified_google_qa_head',
    'protected_qa_deployment_missing','protected_pinned_version_drift',
    'detail_source_incomplete','detail_qa_already_staged','approval_not_given',
    'qa_detail_creation_unconfirmed_inspect_before_retry','unsupported_mode',
  ]);
  console.error('WORK QA exact detail STOPPED: '+
    (allowed.has(e?.message)?e.message:'read_only_audit_failed'));
  process.exitCode=1;
});
