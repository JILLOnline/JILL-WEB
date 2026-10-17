import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {auditPulledCustomOrderQa,removeVerifiedStaleClaspJs} from './verify-custom-order-qa-remote.mjs';
import {spawnSync,execFileSync} from 'node:child_process';

const root=process.cwd();
const output=path.join(root,'.work-custom-orders');
const claspFile=path.join(output,'.clasp.json');
const recordFile=path.join(output,'.qa-project.json');
const sheetId=String(process.env.JILL_CUSTOM_ORDER_WORK_SHEET_ID||'').trim();
if(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim()!=='jill/rewards-work')
  throw new Error('Custom Order QA bootstrap requires the jill/rewards-work branch.');
const dirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim();
if(dirty)throw new Error('Custom Order QA bootstrap refuses uncommitted tracked changes.');
// An existing Google QA project must be verified and any canonical clasp
// .js duplicate reconciled BEFORE invoking the strict bundle builder.
const run=(cwd,...args)=>{
  if(args.some(x=>/[\r\n"&|<>^%!]/.test(x)))throw new Error('Unsafe clasp argument.');
  const windows=process.platform==='win32';
  const values=windows?args.map(x=>/\s/.test(x)?'"'+x+'"':x):args;
  const result=spawnSync(windows?'npx.cmd':'npx',
    ['--yes','@google/clasp@3.4.1',...values],{
      cwd,encoding:'utf8',shell:windows,stdio:'inherit'
    });
  if(result.status!==0)throw new Error('Google clasp '+args[0]+' failed. Check OAuth authorization.');
};
if(fs.existsSync(claspFile)!==fs.existsSync(recordFile))
  throw new Error('Incomplete QA project identity; refusing clasp write.');
const previouslyBootstrapped=fs.existsSync(claspFile);
if(!fs.existsSync(claspFile)){
  // A brand-new project has no remote source to reconcile; generate its
  // initial isolated WORK QA bundle before clasp create-script.
  execFileSync(process.execPath,['scripts/build-custom-order-work-backend.mjs'],
    {cwd:root,stdio:'inherit'});
  // Only a NEW independent QA Apps Script is ever created here. No source
  // can be pushed to the existing WORK Rewards or LIVE Apps Script project.
  run(output,'create-script','--type','standalone','--title','JILL WORK Custom Orders QA');
  if(!fs.existsSync(claspFile))throw new Error('Google did not create the QA Apps Script project.');
  for(const file of ['Code.gs','Code.js']){
    const starter=path.join(output,file);
    if(!fs.existsSync(starter))continue;
    const code=fs.readFileSync(starter,'utf8').replace(/\s+/g,'').replace(/;+/g,';');
    if(!['','functionmyFunction(){}','functionmyFunction(){;}'].includes(code))
      throw new Error('Unexpected Google starter code. Refusing to remove unknown source.');
    fs.rmSync(starter);
  }
  const clasp=JSON.parse(fs.readFileSync(claspFile,'utf8'));
  if(!clasp.scriptId)throw new Error('New QA Apps Script project has no scriptId.');
  fs.writeFileSync(recordFile,JSON.stringify({
    scriptId:clasp.scriptId,
    sheetId,
    shop:'jill-work.myshopify.com',
    origin:'separate Custom Order QA clasp create-script',
  },null,2)+'\n');
}
const clasp=JSON.parse(fs.readFileSync(claspFile,'utf8'));
const project=JSON.parse(fs.readFileSync(recordFile,'utf8'));
if(!project.scriptId || clasp.scriptId!==project.scriptId ||
    project.sheetId!==sheetId ||
    project.shop!=='jill-work.myshopify.com' ||
    project.origin!=='separate Custom Order QA clasp create-script')
  throw new Error('Custom Order QA Google project or WORK sheet identity changed; refusing upload.');
if(previouslyBootstrapped) {
  // clasp pull normalizes an uploaded .gs script to .js. Pull into an
  // isolated temporary project so it NEVER adds competing JS files to the
  // authoritative .gs bundle or overwrites our current manifest.
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-qa-clasp-audit-'));
  try {
    fs.writeFileSync(path.join(temp,'.clasp.json'),
      JSON.stringify({scriptId:clasp.scriptId},null,2)+'\n');
    run(temp,'pull');
    const verified=auditPulledCustomOrderQa({
      directory:temp,sheetId,
      gitReadAtSha:(sha)=>execFileSync('git',[
        'show',sha+':backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs'
      ],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024})
    });
    // Recover the .js left locally by the PREVIOUS failed bootstrap only
    // when its bytes match the independently verified remote QA script.
    if(removeVerifiedStaleClaspJs(output,verified)) {
      console.log('Removed only the verified stale clasp JS duplicate.');
    }
    console.log('QA Google remote matches historical certified source '+verified.commit.slice(0,12)+'.');
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
  // Restores the latest restricted manifest and exactly one canonical .gs.
  execFileSync(process.execPath,['scripts/build-custom-order-work-backend.mjs'],
    {cwd:root,stdio:'inherit'});
}
const sources=fs.readdirSync(output).filter(x=>/\.(gs|js|html)$/.test(x));
if(sources.length!==1 || sources[0]!=='JILL_Custom_Order_Automation_REWARDS.gs')
  throw new Error('Unexpected code source in Custom Order QA project; refusing upload.');
run(output,'push','--force');
console.log('WORK Custom Orders QA source pushed into an independent Google Apps Script project.');
console.log('NOT DEPLOYED. Configure the QA Script Property secret, then deploy/test explicitly.');
console.log('Do not run setupJillRewards or configure Rewards triggers in this project.');
