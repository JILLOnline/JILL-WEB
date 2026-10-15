// JILL HQ WORK merchant bridge: authorize Google QA then STAGE the Cloudflare
// secret, never release a Cloudflare version automatically.
// The generated key lives only in process memory + temporary Windows clipboard.
// It must never be printed, written to disk, committed or sent through chat.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readWorkGoogleQaMerchantList} from '../services/jill-order-desk/work-google-merchant-read.mjs';
import {projectWorkMerchantInbox} from '../services/jill-order-desk/merchant-inbox-read.mjs';
import {
  assertWorkHqInboxManifest,currentWorkerVersion,assertSecretNames,
} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const WORKER='jill-order-desk-canary-work';
const EXPECTED_ACTIVE='49b10c46-8e00-4ef3-8075-74eea29e9c9e';
const SHEET='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
const SCRIPT='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
const KNOWN_REQUEST='jill:92b32355-900e-47ba-8946-ccd93190a3b7';
const NAME='JILL_HQ_MERCHANT_READ_SECRET';
const OAuth=path.join(APP,'dist/server/wrangler.oauth-canary.json');

function requireSafe(ok,reason) {
  if(!ok)throw Error('WORK HQ merchant activation STOPPED: '+reason);
}
export function verifyCanonicalQaList(model) {
  requireSafe(model?.state==='ready' && model.requestsConnected===true,
    'canonical merchant source not ready');
  requireSafe(model.records?.length>=1 && model.records?.length<=50,
    'no verified bounded requests');
  requireSafe(model.records.some(r=>r.submission_id===KNOWN_REQUEST),
    'expected existing WORK QA request missing');
  return model.records.length;
}
export function verifyWorkCanaryBeforeStaging({
  branch,localSha,remoteSha,dirty,manifest,secretNames,workerVersion,
}={}) {
  requireSafe(branch==='jill/rewards-work','wrong Git branch');
  requireSafe(localSha && localSha===remoteSha,'WORK source not synced');
  requireSafe(!dirty,'tracked source changed');
  assertWorkHqInboxManifest(manifest);
  assertSecretNames(JSON.stringify(secretNames));
  requireSafe(workerVersion===EXPECTED_ACTIVE,'active Worker changed; review before staging');
  return true;
}
function exec(program,args,{cwd=ROOT,input,quiet=false}={}) {
  // Program and args are fixed repository-owned literals, never supplied by
  // the merchant or derived from clipboard or a remote endpoint.
  const win=process.platform==='win32';
  const res=spawnSync(win?program+'.cmd':program,args,{
    cwd,encoding:'utf8',shell:win,windowsHide:true,
    maxBuffer:8*1024*1024,input,
    stdio:['pipe','pipe','pipe'],
  });
  requireSafe(!res.error&&res.status===0,
    program+' '+args[0]+' failed. No further changes attempted.');
  return String(res.stdout||'');
}
function git(...args) {
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function wrangler(args) {
  return exec('npx',['--no-install','wrangler',...args],{cwd:APP});
}
function secretList() {
  const output=wrangler(['secret','list','--name',WORKER,
    '--config','./wrangler.canary.jsonc']);
  // Wrangler can print non-JSON banners before the actual array.
  const start=output.indexOf('[');
  requireSafe(start>=0,'Cloudflare secret list missing');
  const data=JSON.parse(output.slice(start));
  requireSafe(Array.isArray(data),'Cloudflare secret list invalid');
  return data;
}
function workerVersion() {
  return currentWorkerVersion(wrangler(['deployments','status',
    '--name',WORKER,'--config','./wrangler.canary.jsonc']));
}
function checkActiveSettings(version) {
  const detail=wrangler(['versions','view',version,'--name',WORKER,
    '--config','./wrangler.canary.jsonc']);
  requireSafe(detail.includes('JILL_WORK_HOST_STAGE ("canary")') &&
    detail.includes('JILL_WORK_OAUTH_ENABLED ("true")') &&
    detail.includes('JILL_WORK_OWNER_BOOTSTRAP_ENABLED ("false")') &&
    detail.includes('3f17c186-c794-4e00-8f20-017191373a19'),
    'deployed canary bindings changed');
  requireSafe(detail.includes('JILL_WORK_SESSION_KEY_B64') &&
    detail.includes('SHOPIFY_API_SECRET'),
    'Shopify secrets missing from active Worker');
}
function copySecretToClipboard(secret) {
  requireSafe(process.platform==='win32','this guided clipboard workflow requires Windows');
  const copied=spawnSync('clip.exe',[],{
    input:secret,encoding:'utf8',windowsHide:true,
    stdio:['pipe','ignore','pipe'],
  });
  requireSafe(!copied.error&&copied.status===0,
    'clipboard unavailable; no secret persisted');
}
function clearClipboard() {
  if(process.platform!=='win32')return;
  // Only clear if the clipboard still equals this tool's secret: we cannot
  // inspect clipboard here, so explicitly clear after the guided operation.
  spawnSync('clip.exe',[],{
    input:'',encoding:'utf8',windowsHide:true,
    stdio:['pipe','ignore','ignore'],
  });
}
const run=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(run) {
  let secret=null, ui=null, copied=false;
  try {
    const version=workerVersion();
    requireSafe(fs.existsSync(OAuth),
      'OAuth-enabled canary build manifest is missing');
    const manifest=JSON.parse(fs.readFileSync(OAuth,'utf8'));
    const names=secretList();
    verifyWorkCanaryBeforeStaging({
      branch:git('branch','--show-current'),
      localSha:git('rev-parse','HEAD'),
      remoteSha:git('rev-parse','refs/remotes/origin/jill/rewards-work'),
      dirty:git('status','--porcelain','--untracked-files=no'),
      manifest,secretNames:names,workerVersion:version,
    });
    const qa=path.join(ROOT,'.work-custom-orders');
    const project=JSON.parse(fs.readFileSync(path.join(qa,'.qa-project.json'),'utf8'));
    const clasp=JSON.parse(fs.readFileSync(path.join(qa,'.clasp.json'),'utf8'));
    requireSafe(project.scriptId===SCRIPT && clasp.scriptId===SCRIPT &&
      project.sheetId===SHEET && project.shop==='jill-work.myshopify.com' &&
      project.origin==='separate Custom Order QA clasp create-script',
      'Google WORK QA project identity drift');
    checkActiveSettings(version);
    console.log('PASS WORK scope, active Worker, D1, OAuth and bootstrap OFF.');
    console.log('PASS new merchant key is absent from active Cloudflare Worker.');
    secret=randomBytes(48).toString('base64url');
    copySecretToClipboard(secret);
    copied=true;
    console.log('\nGenerated one-time merchant-read secret; copied to Windows clipboard.');
    console.log('Secret was NOT printed and no file was created.');
    console.log('Open isolated Google WORK QA Apps Script project:');
    console.log('https://script.google.com/home/projects/'+SCRIPT+'/edit');
    console.log('Project Settings > Script properties > Add script property.');
    console.log('Name: '+NAME);
    console.log('Value: paste from clipboard (Ctrl+V) and click Save.');
    console.log('If the property already exists, STOP rather than overwriting it.');
    console.log('Do not paste the secret into chat, PowerShell, or source files.');
    ui=createInterface({input:process.stdin,output:process.stdout});
    const answer=await ui.question('\nAfter SAVING the Google Script property, type GOOGLE SAVED: ');
    requireSafe(answer.trim()==='GOOGLE SAVED','Google Script property not confirmed');
    const bad=await readWorkGoogleQaMerchantList({
      secret:randomBytes(48).toString('base64url'),
    });
    requireSafe(bad?.ok===false && bad?.error?.code==='unauthorized',
      'Google QA did not deny the invalid signature');
    const result=await readWorkGoogleQaMerchantList({secret});
    const projected=projectWorkMerchantInbox(result);
    const count=verifyCanonicalQaList(projected);
    console.log('PASS invalid HMAC rejected by Google QA.');
    console.log('PASS signed canonical Google QA merchant feed: '+count+
      ' bounded request(s); known My JILL request present.');
    console.log('PASS projection excludes customer contact details and raw payload.');
    // Cloudflare is still completely unchanged at this point.
    requireSafe(workerVersion()===version,
      'Worker changed during Google authorization; do not stage');
    assertSecretNames(JSON.stringify(secretList()));
    const approve=await ui.question(
      '\nType STAGE WORK READ SECRET (creates an INACTIVE Cloudflare version only): ');
    requireSafe(approve.trim()==='STAGE WORK READ SECRET','staging cancelled');
    // Cloudflare versions secret put is INACTIVE by design, unlike secret put.
    // The *OAuth-enabled* manifest ensures the canary does not lose auth vars.
    const staged=exec('npx',[
      '--no-install','wrangler','versions','secret','put',NAME,
      '--name',WORKER,'--config',OAuth,
      '--message','WORK HQ signed read-only Google QA candidate; not deployed',
    ],{cwd:APP,input:secret+'\n'});
    // Fail-closed: no automatic release ever, even if staged is incomplete.
    requireSafe(workerVersion()===version,
      'active Worker unexpectedly changed during version staging');
    console.log('PASS Cloudflare secret staged in an INACTIVE version.');
    console.log('Active Worker remains: '+version);
    console.log('Next: inspect Cloudflare version binding and approve release separately.');
    console.log('Google key is present only as Google QA property and inactive Cloudflare secret.');
    console.log('JILL HQ active page, Shopify customer account and LIVE: unchanged.');
  } catch(error) {
    console.error(String(error?.message||error));
    console.error('If you saved a new Google QA Script Property but the signed probe failed, remove that new property before retrying.');
    console.error('Cloudflare must NOT be released unless the staged version is verified.');
    process.exitCode=1;
  } finally {
    if(ui)ui.close();
    if(copied)clearClipboard();
    secret=null;
  }
}
