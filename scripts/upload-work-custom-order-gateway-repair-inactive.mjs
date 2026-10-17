// WORK Custom Order gateway REPAIR INACTIVE version (Owner approved).
// NO traffic switch, no secret put, no D1 or Google writes, no paid tier.
// The existing deployed SHOPIFY_WORK_APP_SECRET must remain unchanged.
// No Worker activity should depend on this inactive candidate.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {auditWorkQaReadOnly}
  from './audit-work-qa-script-readonly.mjs';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {readVerifiedWorkGatewayKey,checkIsolatedQaGatewaySecret}
  from './diagnose-work-custom-order-gateway-secret.mjs';
import {currentWorkerVersion}
  from './deploy-work-hq-inbox-shell.mjs';
import {
  WORKER,MARKER,inspectActiveGatewayVersion,
  inspectGatewayCandidate,inspectGatewayDeployment,
  gatewayConfigExactlyKnown,uploadArguments,stagedSecrets,
  getExactGatewayUploadVersion,
} from './work-custom-order-gateway-inactive-repair-policy.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.toml';
const RECEIPT='work-gateway-hmac-inactive-repair-once-20261017.json';
const fail=x=>{throw Error('gateway_inactive_upload_'+x);};
const guard=(ok,x)=>{if(!ok)fail(x);};
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:4096,
  }).trim();}catch{fail('git_unavailable');}
}
function ownerSource(){
  guard(process.platform==='win32','owner_windows_only');
  guard(git('branch','--show-current')==='jill/rewards-work'&&
    !git('status','--porcelain','--untracked-files=no')&&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_checkout_not_synced');
  guard(fs.existsSync(CLI),'local_wrangler_missing');
  guard(gatewayConfigExactlyKnown(
    fs.readFileSync(path.join(APP,'wrangler.toml'),'utf8')),
    'work_gateway_manifest_changed');
  const manifest=JSON.parse(fs.readFileSync(
    path.join(APP,'package.json'),'utf8'));
  guard(manifest?.name==='jill-work-custom-orders-cloudflare'&&
    manifest?.private===true,'gateway_package_drift');
  guard(fs.existsSync(path.join(APP,'worker.mjs')),
    'worker_entry_missing');
  return git('rev-parse','HEAD');
}
function cli(args,{timeout=65000}={}){
  const result=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    timeout,maxBuffer:8*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  // Deliberately do not print Wrangler stdout or stderr; they can
  // contain confidential account metadata or error arguments.
  guard(!result.error&&!result.signal&&result.status===0,
    'wrangler_command_failed');
  return String(result.stdout||'');
}
function parse(args){
  try{return JSON.parse(cli(args));}
  catch{fail('cloudflare_metadata_invalid');}
}
function status(){
  try{return currentWorkerVersion(cli([
    'deployments','status','--name',WORKER,'--config',CONFIG]));}
  catch{fail('gateway_active_status_invalid');}
}
function deployment(){
  return inspectGatewayDeployment(parse([
    'deployments','list','--name',WORKER,'--config',CONFIG,'--json']));
}
function view(id){
  return parse(['versions','view',id,'--name',WORKER,
    '--config',CONFIG,'--json']);
}
function history(){
  return parse(['versions','list','--name',WORKER,
    '--config',CONFIG,'--json']);
}
function preflight(){
  const curr=deployment();
  guard(status()===curr.active,'active_worker_version_drift');
  const active=view(curr.active);
  inspectActiveGatewayVersion(active);
  return {curr,active};
}
function privateLocation(){
  const local=process.env.LOCALAPPDATA;
  guard(typeof local==='string'&&path.isAbsolute(local)&&
    !/(^|[\/\\])(OneDrive|Dropbox|Google Drive)([\/\\]|$)/i.test(local),
    'private_localappdata_unverified');
  const base=path.join(local,'JILL-WEB');
  const receipts=path.join(base,'private-release-receipts');
  const temps=path.join(base,'private-release-tmp');
  for(const dir of [base,receipts,temps]){
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    guard(!fs.lstatSync(dir).isSymbolicLink(),
      'private_directory_is_symlink');
  }
  return {receipts,temps};
}
function reserveOnce(filepath,data){
  guard(!fs.existsSync(filepath),'approval_already_used');
  let fd;
  try{
    fd=fs.openSync(filepath,'wx',0o600);
    fs.writeFileSync(fd,JSON.stringify({
      operation:'WORK_GATEWAY_INACTIVE_REPAIR_ONCE',
      worker:WORKER,source_commit:data.commit,
      active_version:data.active,
      deployment_id:data.deployment,
      time:new Date().toISOString(),
      retry_allowed:false,
    })+'\n','utf8');
    fs.fsyncSync(fd);
  }catch{fail('approval_already_used_or_receipt_failed');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function run(){
  const commit=ownerSource();
  const {receipts,temps}=privateLocation();
  guard(!fs.existsSync(path.join(receipts,RECEIPT)),
    'approval_already_used');
  const before=preflight();
  const marker=MARKER+commit;
  guard(!history().some(v=>
    v?.annotations?.['workers/message']===marker),
    'matching_candidate_already_exists');
  // Certify the published isolated WORK project, NOT Rewards or LIVE.
  const qa=await auditWorkQaReadOnly({root:ROOT});
  guard(qa?.publishedRevisionVerified===true&&
    qa.headMatchesCertifiedGit===true&&qa.deploymentFound===true,
    'isolated_published_qa_not_verified');
  const {full,folder}=localFilePath({repo:ROOT});
  guard(fs.existsSync(full)&&
    !fs.lstatSync(full).isSymbolicLink()&&
    !fs.lstatSync(folder).isSymbolicLink(),
    'private_work_secret_vault_missing');
  const secret=readVerifiedWorkGatewayKey(fs.readFileSync(full,'utf8'));
  const proof=await checkIsolatedQaGatewaySecret({secret});
  guard(proof.googleQaSigningKeyMatches===true&&
    proof.cloudflareKeyCompared===false,
    'google_qa_signing_key_unverified');
  console.log('PASS certified isolated Google WORK QA and verified local signing secret.');
  const second=preflight();
  guard(second.curr.id===before.curr.id&&
    second.curr.active===before.curr.active,
    'gateway_deployment_changed_during_preflight');
  let tempdir=null,uploadAttempted=false,phase='dry_run';
  try{
    tempdir=fs.mkdtempSync(path.join(temps,'once-'),{mode:0o700});
    guard(!fs.lstatSync(tempdir).isSymbolicLink(),
      'temporary_secret_directory_symlink');
    const file=path.join(tempdir,'work-secrets-'+randomUUID()+'.json');
    fs.writeFileSync(file,JSON.stringify(stagedSecrets({secret}))+'\n',{
      flag:'wx',mode:0o600,
    });
    guard(fs.existsSync(file)&&!fs.lstatSync(file).isSymbolicLink(),
      'staged_file_unverified');
    const args=uploadArguments({file,commit});
    cli([...args,'--dry-run'],{timeout:120000});
    guard(git('rev-parse','HEAD')===commit&&
      git('rev-parse','refs/remotes/origin/jill/rewards-work')===commit,
      'source_changed_before_upload');
    const third=preflight();
    guard(third.curr.id===before.curr.id&&
      third.curr.active===before.curr.active,
      'remote_gateway_deployment_changed_before_upload');
    guard(!history().some(v=>
      v?.annotations?.['workers/message']===marker),
      'repair_marker_appeared_concurrently');
    phase='upload';
    reserveOnce(path.join(receipts,RECEIPT),{
      commit,active:before.curr.active,deployment:before.curr.id,
    });
    uploadAttempted=true;
    cli([...args],{timeout:180000});
    phase='post_upload_readback';
    const after=deployment();
    guard(after.id===before.curr.id&&
      after.active===before.curr.active&&
      status()===before.curr.active,
      'active_gateway_deployment_changed');
    const id=getExactGatewayUploadVersion({
      versions:history(),marker,active:before.curr.active,
    });
    const proofCandidate=inspectGatewayCandidate({
      active:view(before.curr.active),candidate:view(id),
    });
    const finalState=deployment();
    guard(finalState.id===before.curr.id&&
      finalState.active===before.curr.active,
      'gateway_deployment_changed_after_readback');
    console.log('PASS WORK Custom Order gateway repaired candidate INACTIVE: '+
      proofCandidate.candidate);
    console.log('PASS original deployed gateway still 100%: '+
      proofCandidate.active);
    console.log('PASS original Shopify secret binding, Durable Object limiter, Worker routing and handler/runtime metadata retained.');
    console.log('PASS only verified Google WORK gateway key and certified Google QA backend staged for this candidate.');
    console.log('HOLD: Cloudflare secret VALUES are not readable via version inspection; activation and functional browser QA NOT authorized.');
    console.log('NO traffic switch, LIVE/KEEP, R2, new paid service, Shopify customer changes, emails or order submissions.');
    console.log('This approval is spent. DO NOT run this upload again.');
  }catch(e){
    const code=String(e?.message||'');
    const safe=/^(gateway_inactive_upload_|gateway_inactive_policy_)[a-z0-9_]+$/.test(code)?
      code:'gateway_inactive_upload_unverified';
    console.error('STOP WORK Custom Order inactive upload: '+safe+
      ' at '+phase);
    if(uploadAttempted)console.error(
      'An inactive Cloudflare version MAY exist. DO NOT RETRY. Inspect versions and active deployment read-only.');
    else console.error('No version upload requested by this invocation.');
    process.exitCode=1;
  }finally{
    if(tempdir!==null){
      try{fs.rmSync(tempdir,{recursive:true,force:true});}
      catch{
        console.error('WARNING: local private temporary secret file cleanup unverified. Manually inspect private-release-tmp before proceeding.');
        process.exitCode=1;
      }
    }
  }
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  if(process.argv.length!==2){
    console.error('STOP: unsupported upload options.');
    process.exitCode=1;
  }else{
    try{await run();}
    catch(e){
      const code=String(e?.message||'');
      console.error('STOP WORK gateway preflight: '+
        (/^(gateway_inactive_upload_|gateway_inactive_policy_|work_gateway_diagnosis_)[a-z0-9_]+$/.test(code)?
          code:'gateway_inactive_upload_preflight_unverified'));
      console.error('No repeat submission or bypass. Do not change secrets, paid plan or traffic.');
      process.exitCode=1;
    }
  }
}
