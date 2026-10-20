import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';

// Existing, independent WORK Custom Orders QA project and /exec webapp.
// This command updates ONLY that existing Google deployment after all
// strict branch, project, spreadsheet and published endpoint checks.
const ROOT=process.cwd();
const WORK_SHEET='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
const WORK_SCRIPT='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
const WORK_DEPLOYMENT='AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V';
const DIR=path.join(ROOT,'.work-custom-orders');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();

if(git('branch','--show-current')!=='jill/rewards-work')
  throw Error('QA deployment restricted to jill/rewards-work.');
if(git('status','--porcelain','--untracked-files=no'))
  throw Error('Tracked source is dirty; refusing QA deployment.');
const sha=git('rev-parse','HEAD');
if(git('rev-parse','refs/remotes/origin/jill/rewards-work')!==sha)
  throw Error('Pull/sync origin/jill/rewards-work before QA deployment.');
if(process.env.JILL_CUSTOM_ORDER_WORK_SHEET_ID!==WORK_SHEET)
  throw Error('Specify the known isolated JILL QA sheet, not another spreadsheet.');
const project=JSON.parse(fs.readFileSync(path.join(DIR,'.qa-project.json'),'utf8'));
const clasp=JSON.parse(fs.readFileSync(path.join(DIR,'.clasp.json'),'utf8'));
if(project.scriptId!==WORK_SCRIPT||clasp.scriptId!==WORK_SCRIPT||
   project.sheetId!==WORK_SHEET||
   project.origin!=='separate Custom Order QA clasp create-script'||
   project.shop!=='jill-work.myshopify.com')
  throw Error('QA project identity failed; refusing push or deployment.');
function claspRun(...args) {
  if(args.some(x=>!/^[a-zA-Z0-9:_./-]+$/.test(x)))
    throw Error('Unsafe Google clasp argument');
  const windows=process.platform==='win32';
  const run=spawnSync(windows?'npx.cmd':'npx',
    ['--yes','@google/clasp@3.4.1',...args],{
      cwd:DIR,encoding:'utf8',shell:windows,
    });
  if(run.error||run.status!==0)
    throw Error('Google clasp '+args[0]+' failed: '+
      String(run.stderr||run.stdout||run.error||'').slice(0,700));
  return String(run.stdout||'');
}
const available=claspRun('list-deployments');
if(!available.includes(WORK_DEPLOYMENT))
  throw Error('Exact WORK Custom Orders QA deployed /exec not found; refusing.');
// Guarded historical remote-source audit and canonical QA bundle refresh.
// This NEVER touches Rewards' separate Apps Script project.
execFileSync(process.execPath,['scripts/bootstrap-custom-order-work-backend.mjs'],{
  cwd:ROOT,stdio:'inherit',
});
const latest=claspRun('update-deployment',WORK_DEPLOYMENT);
if(!latest.includes(WORK_DEPLOYMENT))
  throw Error('Google did not confirm an update to the exact QA deployment.');
console.log('Updated existing JILL WORK Custom Orders QA /exec from '+sha+'.');
console.log('Endpoint: https://script.google.com/macros/s/'+WORK_DEPLOYMENT+'/exec');
console.log('No LIVE/Rewards script, user coupon, minute worker or merchant command executed.');
console.log('Before Worker deployment: run jillCustomOrderQaPreflight in the isolated script editor.');
