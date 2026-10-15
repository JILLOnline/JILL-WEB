// Stage the already verified Google WORK QA merchant read key on an
// INACTIVE Cloudflare Worker version. Never rotate, generate or print a key;
// never deploy any Worker version. Only jill-work.myshopify.com is in scope.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assertWorkHqInboxManifest,currentWorkerVersion,assertSecretNames}
  from './deploy-work-hq-inbox-shell.mjs';
import {validateCopiedExistingKey,testExistingMerchantSecret}
  from './probe-work-hq-existing-merchant-key.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const CONFIG=path.join(APP,'dist/server/wrangler.oauth-canary.json');
const WRANGLER_BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const WORKER='jill-order-desk-canary-work';
const ACTIVE='49b10c46-8e00-4ef3-8075-74eea29e9c9e';
const SECRET_NAME='JILL_HQ_MERCHANT_READ_SECRET';
const QA_SCRIPT='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
const QA_SHEET='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';

function ensure(condition,code) {
  if(!condition)throw Error(code);
}
export function assertStageReady({branch,head,remote,dirty,manifest,active,secretList}) {
  ensure(branch==='jill/rewards-work','wrong_work_branch');
  ensure(head && head===remote && !dirty,'work_source_not_synced');
  assertWorkHqInboxManifest(manifest);
  ensure(active===ACTIVE,'active_cloudflare_version_changed');
  assertSecretNames(secretList);
  return true;
}
export function assertActiveWorkerBinding(versionDetails) {
  const details=String(versionDetails||'');
  for(const expected of [
    'JILL_WORK_HOST_STAGE ("canary")',
    'JILL_WORK_OWNER_BOOTSTRAP_ENABLED ("false")',
    'JILL_WORK_OAUTH_ENABLED ("true")',
    '3f17c186-c794-4e00-8f20-017191373a19',
    'SHOPIFY_API_SECRET',
    'JILL_WORK_SESSION_KEY_B64',
  ]) ensure(details.includes(expected),'active_worker_binding_mismatch');
  return true;
}
function git(...args) {
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
// Run Wrangler's JS binary with Node directly, without cmd.exe, npx.cmd,
// or shell interpolation. A multiword --message MUST remain a single argv
// entry; the private key travels only by stdin, never argv/env/shell.
export function wranglerProcessSpec(args,{input}={}) {
  if(!Array.isArray(args) || args.some(arg=>typeof arg!=='string'))
    throw Error('wrangler_invalid_argv');
  return Object.freeze({
    executable:process.execPath,
    argv:Object.freeze([WRANGLER_BIN,...args]),
    options:Object.freeze({
      cwd:APP,
      input,
      encoding:'utf8',
      shell:false,
      windowsHide:true,
      maxBuffer:8*1024*1024,
      stdio:['pipe','pipe','pipe'],
    }),
  });
}
export function safeWranglerError(stderr) {
  const str=String(stderr||'');
  // Only print these constant labels, never Cloudflare stderr or the key.
  if(/unknown arguments?|too many non-option arguments|unknown command|invalid option/i.test(str))
    return 'wrangler_invalid_arguments';
  if(/403|unauthorized|not authorized|insufficient permissions|permission denied|access denied/i.test(str))
    return 'wrangler_access_denied';
  if(/cannot find module|module not found|could not read file|ENOENT/i.test(str))
    return 'wrangler_missing_dependency_or_config';
  if(/timeout|timed out|fetch failed|ECONN|ENOTFOUND|network error/i.test(str))
    return 'wrangler_network_failure';
  return 'wrangler_failed';
}
function cmd(args,{input}={}) {
  ensure(fs.existsSync(WRANGLER_BIN),'wrangler_local_binary_missing');
  const spec=wranglerProcessSpec(args,{input});
  const proc=spawnSync(spec.executable,spec.argv,spec.options);
  ensure(!proc.error && proc.status===0,
    proc.error?'wrangler_process_failed':safeWranglerError(proc.stderr));
  return String(proc.stdout||'');
}
function deployedVersion() {
  return currentWorkerVersion(cmd(['deployments','status','--name',WORKER,
    '--config','./wrangler.canary.jsonc']));
}
function currentSecrets() {
  return cmd(['secret','list','--name',WORKER,
    '--config','./wrangler.canary.jsonc']);
}
function clipboardText() {
  ensure(process.platform==='win32','windows_clipboard_required');
  const proc=spawnSync('powershell.exe',[
    '-NoProfile','-NonInteractive','-Command','Get-Clipboard -Raw',
  ],{encoding:'utf8',maxBuffer:4096,windowsHide:true});
  ensure(!proc.error && proc.status===0,'clipboard_unavailable');
  return validateCopiedExistingKey(proc.stdout);
}
function clearClipboardIfStillMatching(value) {
  try {
    if(clipboardText()!==value)return;
    spawnSync('clip.exe',[],{
      input:'',encoding:'utf8',windowsHide:true,
      stdio:['pipe','ignore','ignore'],
    });
  } catch {
    // Preserve another clipboard value if the user copied something else.
  }
}
function verifyGoogleProject() {
  const qa=path.join(ROOT,'.work-custom-orders');
  const project=JSON.parse(fs.readFileSync(path.join(qa,'.qa-project.json'),'utf8'));
  const clasp=JSON.parse(fs.readFileSync(path.join(qa,'.clasp.json'),'utf8'));
  ensure(project.scriptId===QA_SCRIPT && clasp.scriptId===QA_SCRIPT &&
    project.sheetId===QA_SHEET &&
    project.shop==='jill-work.myshopify.com' &&
    project.origin==='separate Custom Order QA clasp create-script',
    'google_work_project_identity_mismatch');
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked) {
  let key,io,stage='preflight';
  try {
    ensure(fs.existsSync(CONFIG),'missing_oauth_enabled_canary_manifest');
    const manifest=JSON.parse(fs.readFileSync(CONFIG,'utf8'));
    const active=deployedVersion();
    assertStageReady({
      branch:git('branch','--show-current'),
      head:git('rev-parse','HEAD'),
      remote:git('rev-parse','refs/remotes/origin/jill/rewards-work'),
      dirty:git('status','--porcelain','--untracked-files=no'),
      manifest,active,secretList:currentSecrets(),
    });
    assertActiveWorkerBinding(cmd(['versions','view',active,
      '--name',WORKER,'--config','./wrangler.canary.jsonc']));
    verifyGoogleProject();
    console.log('PASS WORK Worker, OAuth, D1, Owner OFF, and active version.');
    console.log('PASS merchant read secret absent from active Worker.');
    stage='clipboard';
    key=clipboardText();
    stage='signed_google';
    const signed=await testExistingMerchantSecret({secret:key});
    ensure(signed.ok && signed.requestCount===2,'signed_google_qa_not_ready');
    console.log('PASS existing key signed read: 2 real WORK QA requests.');
    // A second check closes the race window before creating a new version.
    stage='cloudflare_recheck';
    ensure(deployedVersion()===active,'cloudflare_version_changed_during_probe');
    assertSecretNames(currentSecrets());
    io=createInterface({input:process.stdin,output:process.stdout});
    const approved=await io.question(
      '\nType STAGE EXISTING WORK KEY to create an INACTIVE Cloudflare version: ');
    ensure(approved==='STAGE EXISTING WORK KEY','staging_not_authorized');
    ensure(deployedVersion()===active,'active_worker_changed_before_staging');
    assertSecretNames(currentSecrets());
    stage='cloudflare_stage';
    const receipt=cmd(['versions','secret','put',SECRET_NAME,
      '--name',WORKER,'--config',CONFIG,
      '--message','JILL HQ WORK existing Google QA read key; NOT released',
    ],{input:key+'\n'});
    stage='post_stage';
    ensure(deployedVersion()===active,'active_worker_changed_after_staging');
    // Version-secret updates create a candidate but never switch traffic.
    const candidate=String(receipt).match(
      /\b(?:Version ID|version ID|Version):\s*([0-9a-f]{8}-[0-9a-f-]{27})\b/);
    console.log('PASS existing verified secret staged in Cloudflare INACTIVE version.');
    if(candidate)console.log('Candidate version ID: '+candidate[1]);
    console.log('Active WORK Worker version remains: '+active);
    console.log('Next: inspect candidate bindings before a separate release.');
    console.log('Google QA, My JILL, Rewards and LIVE were not changed.');
  } catch(error) {
    // This string is always a locally-authored allowlisted constant.
    // Never print raw exceptions, Wrangler output, or customer details.
    const known=new Set([
      'wrangler_invalid_arguments','wrangler_access_denied',
      'wrangler_missing_dependency_or_config','wrangler_network_failure',
      'wrangler_failed','wrangler_local_binary_missing',
      'wrangler_process_failed',
    ]);
    const classification=known.has(error?.message)?error.message:'preflight_failed';
    console.error('WORK HQ existing-key staging STOPPED at '+stage+
      ' ('+classification+'). Do not retry or deploy without reviewing this checkpoint.');
    process.exitCode=1;
  } finally {
    if(io)io.close();
    if(key)clearClipboardIfStillMatching(key);
    key=undefined;
  }
}
