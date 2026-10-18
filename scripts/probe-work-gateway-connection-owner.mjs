// One-use WORK inactive version upload plus owner-signed, read-only receipt
// probe through that version's URL. No versions deploy, secrets file,
// Custom Order submission, customer read or notification.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gatewayDiagnosticSignature}
  from '../backend/custom-order-gateway.mjs';
import {readVerifiedWorkGatewayKey,checkIsolatedQaGatewaySecret}
  from './diagnose-work-custom-order-gateway-secret.mjs';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {auditWorkQaReadOnly,verifyLocalWorkQaIdentity}
  from './audit-work-qa-script-readonly.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {exactManifest}
  from './work-gateway-version-metadata-inactive-policy.mjs';
import {CANDIDATE,WORKER}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {auditGatewayForSynthetic}
  from './verify-work-gateway-synthetic-readiness.mjs';
import {
  baseline,uploadArgs,candidateIsLatest,inspectUploaded,
  uploadedVersionUrl,certifyProbe,SOURCE,
} from './work-gateway-diagnostic-release-policy.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CFG='./wrangler.toml';
const RECEIPT='work-gateway-diagnostic-inactive-once-20261018.json';
const PINNED={
  'services/custom-order-cloudflare/worker.mjs':'10ec7aef1b7339c1caeeadbb11b9700ed815f05b',
  'services/custom-order-cloudflare/handler.mjs':'9b6e0bf99ffb2800910e5b892f24555034c44182',
  'services/custom-order-cloudflare/limiter.mjs':'15d250dfb516c47807e14ca4a940eea39b155220',
  'services/custom-order-cloudflare/wrangler.toml':'2fbdde6af18d411affefcfe08b36fef300eae769',
  'backend/custom-order-gateway.mjs':'cb6e836e8a3b66709ddbea8aa91242b1a679c780',
  'backend/custom-order-work-proxy-route.mjs':'7cf7d2ea9b1648454afea7b8dd3b670fd8644e3c',
  'backend/shopify-work-app-proxy-auth.mjs':'16efd060d332efc95f9e2e26cd81c0ab36936627',
  'backend/custom-order-account-read.mjs':'06f692b497df6bcff30ff2b8db8171a65850b44e',
  'backend/customer-account-work-session.mjs':'62ae204af6b2ebf2844995a35e181f8a781342fa',
};
const stop=code=>{throw Error('work_gateway_diagnostic_'+code);};
const check=(v,code)=>{if(!v)stop(code);};
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:8192,
  }).trim();}catch{stop('git_unavailable');}
}
function sourceGuard(){
  check(process.platform==='win32','owner_windows_only');
  check(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/jill/rewards-work')&&
    git('cat-file','-t',SOURCE)==='commit',
    'work_source_unsynced');
  for(const [file,hash] of Object.entries(PINNED))
    check(git('hash-object',file)===hash,'unreviewed_gateway_source');
  exactManifest(fs.readFileSync(path.join(APP,'wrangler.toml'),'utf8'));
  check(fs.existsSync(CLI),'local_wrangler_missing');
  return git('rev-parse','HEAD');
}
function cli(args,timeout=60000){
  const r=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    timeout,maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  // Wrangler may print account details. Report only fixed stop codes.
  check(!r.error&&!r.signal&&r.status===0,'cloudflare_command_failed');
  return String(r.stdout||'');
}
function json(args){
  try{return JSON.parse(cli(args));}catch{stop('cloudflare_json_invalid');}
}
const commands={
  deployments:['deployments','list','--name',WORKER,'--config',CFG,'--json'],
  status:['deployments','status','--name',WORKER,'--config',CFG],
  versions:['versions','list','--name',WORKER,'--config',CFG,'--json'],
};
function version(id){
  return json(['versions','view',id,'--name',WORKER,'--config',CFG,'--json']);
}
function allocation(){
  return baseline(json(commands.deployments),currentWorkerVersion(cli(commands.status)));
}
function receiptPath(){
  const base=process.env.LOCALAPPDATA;
  check(typeof base==='string'&&path.isAbsolute(base)&&
    !/(?:^|[\\/])(OneDrive|Dropbox|Google Drive)(?:[\\/]|$)/i.test(base),
    'private_receipt_location_unavailable');
  const root=path.join(base,'JILL-WEB');
  const dir=path.join(root,'private-release-receipts');
  for(const item of [root,dir]){
    fs.mkdirSync(item,{recursive:true,mode:0o700});
    check(!fs.lstatSync(item).isSymbolicLink(),'private_receipt_symlink');
  }
  return path.join(dir,RECEIPT);
}
function recordOnce(file,data){
  let handle;
  try{
    handle=fs.openSync(file,'wx',0o600);
    fs.writeFileSync(handle,JSON.stringify(data)+'\n','utf8');
    fs.fsyncSync(handle);
  }catch{stop('upload_already_attempted_or_receipt_failed');}
  finally{if(handle!==undefined)fs.closeSync(handle);}
}
function replaceReceipt(file,data){
  check(!fs.lstatSync(file).isSymbolicLink(),'receipt_symlink');
  fs.writeFileSync(file,JSON.stringify(data)+'\n',{flag:'w',mode:0o600});
}
function ownerKey(){
  const {full,folder}=localFilePath({repo:ROOT});
  check(fs.existsSync(full)&&!fs.lstatSync(full).isSymbolicLink()&&
    !fs.lstatSync(folder).isSymbolicLink(),'private_key_unavailable');
  return readVerifiedWorkGatewayKey(fs.readFileSync(full,'utf8'));
}
async function verifyGoogle(secret){
  verifyLocalWorkQaIdentity(ROOT);
  const audit=await auditWorkQaReadOnly({root:ROOT});
  check(audit?.publishedRevisionVerified===true&&
    audit.headMatchesCertifiedGit===true&&audit.deploymentFound===true,
    'isolated_google_qa_unverified');
  const result=await checkIsolatedQaGatewaySecret({secret});
  check(result.googleQaSigningKeyMatches===true,
    'local_key_not_google_qa');
}
async function probe(url,secret){
  const timestamp=String(Date.now()),nonce=randomUUID();
  const signature=gatewayDiagnosticSignature({secret,timestamp,nonce});
  let response;
  try{response=await fetch(url+'/jill-work-gateway-diagnostic',{
    method:'POST',redirect:'manual',credentials:'omit',
    headers:{'x-jill-qa-diagnostic-ts':timestamp,
      'x-jill-qa-diagnostic-nonce':nonce,
      'x-jill-qa-diagnostic-signature':signature},
    signal:AbortSignal.timeout(20000),
  });}catch{stop('version_url_unreachable');}
  let body;
  try{
    const text=await response.text();
    check(text.length>0&&text.length<1024,'probe_response_size_invalid');
    body=JSON.parse(text);
  }catch{stop('probe_response_unreadable');}
  if(response.status===403&&body?.code==='diagnostic_denied')
    stop('worker_key_mismatch_or_challenge_denied');
  if(response.status===503&&body?.code==='diagnostic_unverified')
    stop('google_qa_connection_unverified');
  if(response.status===429&&body?.code==='diagnostic_rate_limited')
    stop('gateway_rate_limited');
  certifyProbe({status:response.status,body,
    cacheControl:response.headers.get('cache-control'),
    redirect:response.headers.get('location')});
}
async function execute(){
  const commit=sourceGuard();
  const file=receiptPath();
  check(!fs.existsSync(file),'upload_already_attempted');
  allocation();
  await auditGatewayForSynthetic();
  candidateIsLatest(json(commands.versions));
  const active=version(CANDIDATE);
  check(active?.id===CANDIDATE,'active_metadata_unverified');
  const secret=ownerKey();
  await verifyGoogle(secret);
  const args=uploadArgs();
  cli([...args,'--dry-run'],120000);
  check(sourceGuard()===commit,'source_changed_before_upload');
  allocation();
  candidateIsLatest(json(commands.versions));
  check(!fs.existsSync(file),'upload_already_attempted');
  console.log('PASS WORK source, 100/0 allocation, latest candidate, local Google QA key and upload dry run.');
  let attempted=false,phase='upload';
  try{
    recordOnce(file,{operation:'WORK_GATEWAY_DIAGNOSTIC_INACTIVE_ONCE',
      source:SOURCE,runner:commit,active:CANDIDATE,
      reserved_at:new Date().toISOString(),retry_allowed:false});
    attempted=true;
    const output=cli(args,180000);
    phase='version_readback';
    const versions=json(commands.versions);
    const match=(Array.isArray(versions)?versions:
      versions?.versions||versions?.result||[]).find(x=>
      x?.annotations?.['workers/message']===
      'JILL WORK gateway read-only diagnostic INACTIVE '+SOURCE);
    check(match?.id,'uploaded_version_not_found');
    const id=inspectUploaded({versions,active,uploaded:version(match.id)});
    const url=uploadedVersionUrl(output,id);
    replaceReceipt(file,{operation:'WORK_GATEWAY_DIAGNOSTIC_INACTIVE_ONCE',
      source:SOURCE,runner:commit,active:CANDIDATE,
      version:id,url,reserved_at:new Date().toISOString(),retry_allowed:false});
    allocation();
    phase='version_url_probe';
    await probe(url,secret);
    allocation();
    check(inspectUploaded({versions:json(commands.versions),
      active:version(CANDIDATE),uploaded:version(id)})===id,
      'version_changed_during_probe');
    console.log('PASS inactive WORK gateway version '+id+' signed Google QA nonexistent-receipt check.');
    console.log('PASS gateway active candidate stays 100%, original 0%; no order or secret change.');
  }catch(error){
    const msg=String(error?.message||'');
    const safe=/^work_gateway_diagnostic_[a-z0-9_]+$/.test(msg)?
      msg:'work_gateway_diagnostic_unverified';
    console.error('STOP '+safe+' at '+phase+'.');
    if(attempted)console.error('An inactive version may exist. Do not retry upload; inspect versions read-only.');
    process.exitCode=1;
  }
}
const called=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(called){
  try{
    check(process.argv.length===2,'arguments_not_allowed');
    await execute();
  }catch(error){
    const msg=String(error?.message||'');
    console.error('STOP '+(/^work_gateway_diagnostic_[a-z0-9_]+$/.test(msg)?
      msg:'work_gateway_diagnostic_preflight_unverified'));
    console.error('No retry, Custom Order submission, or WORK traffic change.');
    process.exitCode=1;
  }
}
