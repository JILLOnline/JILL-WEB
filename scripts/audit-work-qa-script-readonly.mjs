import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {
  auditPulledCustomOrderQa,
} from './verify-custom-order-qa-remote.mjs';

const WORK_SCRIPT='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
const WORK_SHEET='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
const WORK_DEPLOYMENT='AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V';
const EXPECTED_SHOP='jill-work.myshopify.com';

export function verifyLocalWorkQaIdentity(root) {
  const qa=path.join(root,'.work-custom-orders');
  const project=JSON.parse(fs.readFileSync(path.join(qa,'.qa-project.json'),'utf8'));
  const clasp=JSON.parse(fs.readFileSync(path.join(qa,'.clasp.json'),'utf8'));
  if(project.scriptId!==WORK_SCRIPT || clasp.scriptId!==WORK_SCRIPT ||
      project.sheetId!==WORK_SHEET || project.shop!==EXPECTED_SHOP ||
      project.origin!=='separate Custom Order QA clasp create-script') {
    throw Error('WORK QA project identity mismatch: refusing remote audit.');
  }
  return {scriptId:WORK_SCRIPT,sheetId:WORK_SHEET};
}

export function runReadOnlyClasp(directory,command) {
  if(!['list-deployments','pull'].includes(command))
    throw Error('Only read-only Google clasp commands permitted.');
  const win=process.platform==='win32';
  const result=spawnSync(win?'npx.cmd':'npx',[
    '--yes','@google/clasp@3.4.1',command,
  ],{cwd:directory,encoding:'utf8',shell:win,maxBuffer:8*1024*1024});
  if(result.error || result.status!==0)
    throw Error('Google clasp '+command+' failed. Check clasp login; no changes were made.');
  return String(result.stdout||'');
}

export async function auditWorkQaReadOnly({
  root=process.cwd(),invokeClasp=runReadOnlyClasp,
  readHistorical=(sha)=>execFileSync('git',[
    '-C',root,'show',sha+':backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs',
  ],{encoding:'utf8',maxBuffer:8*1024*1024}),
}={}) {
  if(typeof invokeClasp!=='function'||typeof readHistorical!=='function')
    throw Error('Invalid WORK QA audit adapters.');
  const qa=path.join(root,'.work-custom-orders');
  verifyLocalWorkQaIdentity(root);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-work-qa-read-'));
  try {
    // Never pull into the existing local source bundle.
    fs.writeFileSync(path.join(temp,'.clasp.json'),
      JSON.stringify({scriptId:WORK_SCRIPT})+'\n');
    const deployments=invokeClasp(temp,'list-deployments');
    if(typeof deployments!=='string'||!deployments.includes(WORK_DEPLOYMENT))
      throw Error('Expected WORK QA deployment ID absent; STOP.');
    invokeClasp(temp,'pull');
    const result=auditPulledCustomOrderQa({
      directory:temp,sheetId:WORK_SHEET,gitReadAtSha:readHistorical,
    });
    return Object.freeze({
      project:'WORK Custom Orders QA',
      deploymentFound:true,
      headMatchesCertifiedGit:true,
      historicalCommit:result.commit,
      sourceDigest:result.digest,
      publishedRevisionVerified:false,
      // clasp pull audits project HEAD, NOT the version pinned to /exec.
    });
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
}

const invoked=process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked) {
  try {
    const root=process.cwd();
    const branch=execFileSync('git',['-C',root,'branch','--show-current'],
      {encoding:'utf8'}).trim();
    if(branch!=='jill/rewards-work')
      throw Error('Run from JILL-WEB on the jill/rewards-work branch.');
    const result=await auditWorkQaReadOnly({root});
    console.log('PASS isolated WORK Google QA script identity.');
    console.log('PASS expected WORK /exec deployment ID exists.');
    console.log('PASS remote project HEAD matches certified historical Git source.');
    console.log('Historical Git commit: '+result.historicalCommit);
    console.log('Remote project HEAD SHA-256: '+result.sourceDigest);
    console.log('NEXT GATE: published /exec revision not yet source-attested.');
    console.log('Google deployments, sheet data, secrets and LIVE: UNCHANGED.');
  } catch(error) {
    console.error('WORK QA read-only audit STOPPED: '+error.message);
    process.exitCode=1;
  }
}
