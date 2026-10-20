// ONE *FUTURE OWNER-APPROVED* inactive Worker version upload.
// This code is only PREPARED in Git. Do not execute before scoped approval.
// No normal traffic change, Worker deployment, customer/order write, R2 or paid tier.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {auditWorkQaReadOnly} from './audit-work-qa-script-readonly.mjs';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {readVerifiedWorkGatewayKey,checkIsolatedQaGatewaySecret}
  from './diagnose-work-custom-order-gateway-secret.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {inspectGatewayCandidate}
  from './work-custom-order-gateway-inactive-repair-policy.mjs';
import {
  WORKER,ACTIVE,PREVIOUS,DEPLOYMENT,MARKER,
  exactManifest,exactAllocation,inspectNewInactiveVersion,exactNewVersion,
  inactiveUploadArgs,stagedSecrets,
} from './work-gateway-version-metadata-inactive-policy.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.toml';
const RECEIPT='work-custom-order-version-metadata-inactive-once-20261017.json';
const PINNED_FILES=Object.freeze({
  'services/custom-order-cloudflare/worker.mjs':'10ec7aef1b7339c1caeeadbb11b9700ed815f05b',
  'services/custom-order-cloudflare/limiter.mjs':'15d250dfb516c47807e14ca4a940eea39b155220',
  'services/custom-order-cloudflare/handler.mjs':'c596633b040654d1a474a22c683cacf46b492eaa',
  'services/custom-order-cloudflare/wrangler.toml':'2fbdde6af18d411affefcfe08b36fef300eae769',
  'backend/custom-order-gateway.mjs':'b67f20e639e9fcde58ef073c14c4a4ccc5685561',
  'backend/custom-order-work-proxy-route.mjs':'7cf7d2ea9b1648454afea7b8dd3b670fd8644e3c',
  'backend/shopify-work-app-proxy-auth.mjs':'16efd060d332efc95f9e2e26cd81c0ab36936627',
  'backend/custom-order-account-read.mjs':'06f692b497df6bcff30ff2b8db8171a65850b44e',
  'backend/customer-account-work-session.mjs':'62ae204af6b2ebf2844995a35e181f8a781342fa',
});
const stop=code=>{throw Error('gateway_metadata_upload_'+code);};
const check=(condition,code)=>{if(!condition)stop(code);};
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:4096,
  }).trim();}catch{stop('git_unavailable');}
}
function ownerCheck(){
  check(process.platform==='win32','windows_only');
  check(git('branch','--show-current')==='jill/rewards-work' &&
    git('status','--porcelain','--untracked-files=no')==='' &&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'source_unsynced');
  for(const [file,sha] of Object.entries(PINNED_FILES))
    check(git('hash-object',file)===sha,'unreviewed_source_drift');
  exactManifest(fs.readFileSync(path.join(APP,'wrangler.toml'),'utf8'));
  const packageJson=JSON.parse(fs.readFileSync(
    path.join(APP,'package.json'),'utf8'));
  check(packageJson?.private===true&&
    packageJson?.name==='jill-work-custom-orders-cloudflare',
    'wrong_worker_package');
  check(fs.existsSync(CLI),'wrangler_missing');
  return git('rev-parse','HEAD');
}
function cli(args,timeout=60000){
  const out=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    timeout,maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  // Wrangler stdout/stderr may contain account metadata; never print them.
  check(!out.error&&!out.signal&&out.status===0,'wrangler_failed');
  return String(out.stdout||'');
}
function json(args){
  try{return JSON.parse(cli(args));}
  catch{stop('wrangler_json_unverified');}
}
const args={
  allocations:['deployments','list','--name',WORKER,'--config',CONFIG,'--json'],
  current:['deployments','status','--name',WORKER,'--config',CONFIG],
  versions:['versions','list','--name',WORKER,'--config',CONFIG,'--json'],
};
function view(id){
  return json(['versions','view',id,'--name',WORKER,'--config',CONFIG,'--json']);
}
function baseline(){
  const allocation=exactAllocation(json(args.allocations));
  check(currentWorkerVersion(cli(args.current))===ACTIVE,
    'normal_traffic_not_original');
  const original=view(ACTIVE),previous=view(PREVIOUS);
  inspectGatewayCandidate({active:original,candidate:previous});
  return {allocation,original,previous};
}
function privateDirs(){
  const root=process.env.LOCALAPPDATA;
  check(typeof root==='string'&&path.isAbsolute(root)&&
    !/(?:^|[\\/])(OneDrive|Dropbox|Google Drive)(?:[\\/]|$)/i.test(root),
    'private_location_unverified');
  const top=path.join(root,'JILL-WEB');
  const receipts=path.join(top,'private-release-receipts');
  const temps=path.join(top,'private-release-tmp');
  for(const dir of [top,receipts,temps]){
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    check(!fs.lstatSync(dir).isSymbolicLink(),'private_symlink_refused');
  }
  return {receipts,temps};
}
function reserveOnce(file,commit){
  let handle;
  try {
    handle=fs.openSync(file,'wx',0o600);
    fs.writeFileSync(handle,JSON.stringify({
      operation:'WORK_GATEWAY_VERSION_METADATA_INACTIVE_ONCE',
      source_commit:commit,original:ACTIVE,previous_zero:PREVIOUS,
      baseline_deployment:DEPLOYMENT,
      reserved_at:new Date().toISOString(),retry_allowed:false,
    })+'\n','utf8');
    fs.fsyncSync(handle);
  }catch{stop('approval_spent_or_receipt_failed');}
  finally{if(handle!==undefined)fs.closeSync(handle);}
}
async function execute(){
  const commit=ownerCheck();
  const {receipts,temps}=privateDirs();
  const receipt=path.join(receipts,RECEIPT);
  check(!fs.existsSync(receipt),'approval_already_used');
  const first=baseline();
  check(first.allocation.deployment_id===DEPLOYMENT,
    'baseline_deployment_changed');
  check(!json(args.versions).some(v=>
    v?.annotations?.['workers/message']===MARKER+commit),
    'already_uploaded');
  // Read-only proof of isolated Google WORK QA, not LIVE/KEEP or Rewards.
  const qa=await auditWorkQaReadOnly({root:ROOT});
  check(qa?.publishedRevisionVerified===true&&
    qa.headMatchesCertifiedGit===true&&qa.deploymentFound===true,
    'google_qa_not_certified');
  const {full,folder}=localFilePath({repo:ROOT});
  check(fs.existsSync(full)&&
    !fs.lstatSync(full).isSymbolicLink()&&
    !fs.lstatSync(folder).isSymbolicLink(),
    'private_vault_unavailable');
  const secret=readVerifiedWorkGatewayKey(fs.readFileSync(full,'utf8'));
  const proof=await checkIsolatedQaGatewaySecret({secret});
  check(proof.googleQaSigningKeyMatches===true&&
    proof.cloudflareKeyCompared===false,
    'google_qa_secret_unverified');
  let temp=null,attempted=false,phase='preflight';
  try{
    temp=fs.mkdtempSync(path.join(temps,'metadata-inactive-'),{mode:0o700});
    check(!fs.lstatSync(temp).isSymbolicLink(),'temp_symlink_refused');
    const secretsFile=path.join(temp,'work-verified-'+randomUUID()+'.json');
    fs.writeFileSync(secretsFile,JSON.stringify(stagedSecrets({secret}))+'\n',
      {mode:0o600,flag:'wx'});
    check(!fs.lstatSync(secretsFile).isSymbolicLink(),
      'secret_file_symlink_refused');
    const command=inactiveUploadArgs({file:secretsFile,commit});
    // Dry-run compiler performs no version upload and no deployment.
    cli([...command,'--dry-run'],120000);
    check(ownerCheck()===commit,'source_changed_during_preflight');
    const second=baseline();
    check(second.allocation.deployment_id===first.allocation.deployment_id,
      'deployment_changed_before_upload');
    check(!json(args.versions).some(v=>
      v?.annotations?.['workers/message']===MARKER+commit),
      'concurrent_candidate_upload');
    console.log('PASS exact WORK 100/0 split, reviewed source hashes, isolated QA signing proof, and inactive-upload dry run.');
    phase='upload';
    // One-use authorization is consumed BEFORE the single remote write.
    reserveOnce(receipt,commit);
    attempted=true;
    cli(command,180000);
    phase='readback';
    const after=baseline();
    check(after.allocation.deployment_id===first.allocation.deployment_id,
      'normal_deployment_changed');
    const version=exactNewVersion({versions:json(args.versions),commit});
    const report=inspectNewInactiveVersion({
      original:after.original,previous:after.previous,candidate:view(version),
    });
    check(baseline().allocation.deployment_id===DEPLOYMENT,
      'late_deployment_change');
    console.log('PASS new WORK metadata candidate INACTIVE: '+report.new_inactive_version);
    console.log('PASS original remains 100%, previous repair remains 0%, exact original deployment unchanged.');
    console.log('PASS existing Shopify secret and Durable Object bindings preserved; only metadata binding added.');
    console.log('HOLD: no customer request or Google receipt proven; metadata probe and any new 0% deployment require separate approval.');
    console.log('ONE-TIME APPROVAL SPENT. DO NOT RUN THIS UPLOAD AGAIN.');
  }catch(error){
    const msg=String(error?.message||'');
    const safe=/^(gateway_metadata_upload_|gateway_inactive_policy_|work_gateway_diagnosis_)[a-z0-9_]+$/.test(msg)?
      msg:'gateway_metadata_upload_unverified';
    console.error('STOP WORK metadata inactive upload: '+safe+' at '+phase);
    console.error(attempted?
      'An inactive version MAY exist. DO NOT RETRY; inspect Cloudflare versions and deployment READ ONLY.':
      'No remote version upload was requested by this invocation.');
    process.exitCode=1;
  }finally{
    if(temp!==null)try{fs.rmSync(temp,{recursive:true,force:true});}
    catch{
      console.error('WARNING private ephemeral file cleanup unverified. Owner must inspect local release temporary directory.');
      process.exitCode=1;
    }
  }
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try {
    check(process.argv.length===2,'extra_arguments_refused');
    await execute();
  }catch(error){
    const msg=String(error?.message||'');
    console.error('STOP WORK metadata inactive upload preflight: '+
      (/^(gateway_metadata_upload_|gateway_inactive_policy_|work_gateway_diagnosis_)[a-z0-9_]+$/.test(msg)?
        msg:'gateway_metadata_upload_preflight_unverified'));
    console.error('No deployment retry, secret change or customer submission authorized.');
    process.exitCode=1;
  }
}
