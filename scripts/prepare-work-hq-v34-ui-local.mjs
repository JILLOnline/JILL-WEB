// JILL HQ Phase 30 — ONLY prepare a fresh LOCAL build manifest compatible
// with the audited, active WORK v34. NO uploads, NO version staging,
// NO deploy, NO provider reads, NO Google/Shopify/D1/R2 operations.
// Old WORK UI deployment scripts are pinned to obsolete versions;
// do not use them to "fix" a newer active v34.
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,lstatSync,renameSync,mkdirSync}
  from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {prepareOAuthManifest}
  from './prepare-work-canary-oauth-manifest.mjs';
import {prepareWorkDetailOnManifest}
  from './stage-work-hq-detail-v9-on.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const DIST=join(APP,'dist');
const BASE=join(DIST,'server/wrangler.json');
const OUT=join(DIST,'server/wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json');
const BRANCH='jill/rewards-work';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const VARS=Object.freeze({
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
  JILL_WORK_HQ_DETAIL_ENABLED:'true',
});
function stop(code){throw Error('work_hq_v34_local_ui_'+code);}
function json(x){return JSON.stringify(x);}
function identical(a,b){return json(a)===json(b);}
function object(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
const EMPTY_BINDING_ARRAYS=Object.freeze([
  'r2_buckets','kv_namespaces','queues','services','routes',
]);
// Wrangler/Vite generated manifests may serialize inert defaults as
// empty [] or {}. Never interpret an empty container as an active binding.
// Only exact known inert shapes are acceptable; unexpected sections and
// ANY real capability still fail closed.
function inertSection(key,value){
  if(value===undefined)return true;
  if(EMPTY_BINDING_ARRAYS.includes(key))
    return Array.isArray(value)&&value.length===0;
  if(key==='images')
    return object(value)&&Object.keys(value).length===0;
  if(key==='durable_objects'||key==='unsafe')
    return object(value)&&(
      Object.keys(value).length===0 ||
      (Object.keys(value).length===1 &&
       Object.hasOwn(value,'bindings')&&
       Array.isArray(value.bindings)&&value.bindings.length===0)
    );
  return false;
}
function requireNoNewBindings(o,tag){
  for(const key of [
    ...EMPTY_BINDING_ARRAYS,'images','durable_objects','unsafe',
  ])if(!inertSection(key,o[key]))
    stop(tag+'_active_'+key);
}
function requireWorkD1(o,tag){
  if(!object(o)||o.name!=='jill-order-desk-canary-work')
    stop(tag+'_worker');
  if(!Array.isArray(o.d1_databases)||
     o.d1_databases.length!==1||
     o.d1_databases[0]?.binding!=='JILL_ORDER_DESK_WORK_DB'||
     o.d1_databases[0]?.database_name!=='jill-order-desk-work'||
     o.d1_databases[0]?.database_id!==D1)
    stop(tag+'_d1');
}
/** STRICT LOCAL v34 shape preparation; no network or secrets read. */
export function prepareWorkHqV34LocalUi(source){
  requireWorkD1(source,'base');
  requireNoNewBindings(source,'base');
  // Use the already-certified manifest transforms. The base is OAuth
  // locked by design; build a LOCAL candidate with the same exact five
  // plaintext flags as the remotely audited active v34.
  let next;
  try{
    next=prepareWorkDetailOnManifest(prepareOAuthManifest(source));
  }catch{stop('transform_invalid');}
  requireWorkD1(next,'candidate');
  requireNoNewBindings(next,'candidate');
  if(!object(next.vars)||!identical(next.vars,VARS)||
     !identical(next.d1_databases,source.d1_databases))
    stop('candidate_invalid');
  if(!object(source.vars)||!object(next.vars)||
     Object.hasOwn(next.vars,'SHOPIFY_API_SECRET')||
     Object.hasOwn(next.vars,'JILL_HQ_MERCHANT_READ_SECRET')||
     Object.hasOwn(next.vars,'JILL_HQ_MERCHANT_WRITE_SECRET')||
     Object.hasOwn(next.vars,'JILL_WORK_SESSION_KEY_B64'))
    stop('secret_as_plaintext');
  // Only five flag values may differ from the source: no alternate
  // routes, runtime, compatibility flags or image assets synthesized.
  const reversed=structuredClone(next);
  reversed.vars=structuredClone(source.vars);
  if(!identical(reversed,source))stop('non_flag_change');
  return Object.freeze({
    candidate:next,active_version_expected:
      '4973b74d-d479-41da-897c-e36129303279',
    expected_fallback_version:
      '204d66c3-3296-430d-8288-39c354876600',
    local_manifest_only:true,
    provider_binding_parity_verified:false,
    deployed_code_equivalence_verified:false,
    rollback_simulated:false,
    actual_google_source_queried:false,
    cloudflare_version_uploaded:false,
    deployment_authorized:false,
    customer_mutation_authorized:false,
    storage_activation_authorized:false,
  });
}
const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8',windowsHide:true,timeout:15000,
}).trim();
function run(label,script,{canary=false,cwd=ROOT}={}){
  // Trusted, fixed repository-controlled commands; no shell interpolation
  // of environment variables, secrets, URLs, identifiers or customer data.
  const cmd=process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'npm';
  const args=process.platform==='win32'?
    ['/d','/s','/c','npm.cmd run '+script]:['run',script];
  const p=spawnSync(cmd,args,{
    cwd,encoding:'utf8',shell:false,windowsHide:true,
    timeout:180000,maxBuffer:4*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false',
      ...(canary?{JILL_BUILD_TARGET:'canary'}:{})},
  });
  // Show test/build failures, but never print provider stdout that may
  // include credentials: these steps are pre-reviewed local npm tests.
  if(p.error||p.status!==0||p.signal)
    stop('local_'+label+'_failed');
  console.log('PASS LOCAL '+label);
}
function verifySource(){
  if(git('branch','--show-current')!==BRANCH||
     git('rev-parse','HEAD')!==
       git('rev-parse','refs/remotes/origin/'+BRANCH)||
     git('status','--porcelain','--untracked-files=no'))
    stop('source_not_synced');
  const c=join(APP,'app/components/WorkOriginalRequestDetails.tsx');
  const p=join(ROOT,'services/jill-order-desk/work-reference-provenance.mjs');
  if(!readFileSync(c,'utf8').includes('describeWorkReference(id)')||
     !readFileSync(p,'utf8').includes("kind:'legacy_cloudinary_url'"))
    stop('legacy_url_ui_fix_missing');
  for(const filename of ['wrangler.jsonc','wrangler.canary.jsonc']){
    const w=JSON.parse(readFileSync(join(APP,filename),'utf8'));
    if(w.r2_buckets!==undefined||w.images!==undefined||
       w.vars?.JILL_WORK_HQ_DETAIL_ENABLED!==undefined||
       w.vars?.JILL_WORK_MERCHANT_WRITES_ENABLED!==undefined)
      stop('source_deploy_manifest_not_locked');
  }
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    if(process.argv.length!==3 ||
       !['--prepare-local','--inspect-existing-base'].includes(process.argv[2]))
      stop('invalid_cli');
    verifySource();
    if(process.argv[2]==='--inspect-existing-base'){
      if(!existsSync(BASE))stop('compiled_base_missing');
      const inspected=prepareWorkHqV34LocalUi(
        JSON.parse(readFileSync(BASE,'utf8')));
      if(!inspected.local_manifest_only ||
         inspected.deployment_authorized!==false)
        stop('inspection_not_safe');
      console.log('PASS LOCAL compiled WORK v34 canary manifest: exact D1 and five flags, no active R2/Images/Queues/other bindings.');
      console.log('READ ONLY: No build, upload, candidate write, deployment or provider calls.');
      process.exitCode=0;
    }else{
    for(const script of [
      'test:work-hq-reference-provenance',
      'test:work-hq-detail-view',
      'test:work-hq-full-request-projection',
      'test:work-hq-merchant-command',
    ])run(script.replace(/[^a-z0-9]/gi,'_'),script);
    if(existsSync(DIST)){
      if(lstatSync(DIST).isSymbolicLink())stop('symlink_dist');
      const backup=join(tmpdir(),'jill-hq-v34-local-prev-'+randomUUID());
      renameSync(DIST,backup);
      console.log('Existing local build moved out of the staging path.');
    }
    run('typescript','typecheck',{cwd:APP});
    run('fresh_work_canary_build','build',{cwd:APP,canary:true});
    if(!existsSync(BASE)||existsSync(OUT))
      stop('fresh_build_missing_or_candidate_exists');
    const raw=readFileSync(BASE,'utf8');
    const plan=prepareWorkHqV34LocalUi(JSON.parse(raw));
    writeFileSync(OUT,JSON.stringify(plan.candidate,null,2)+'\n',{
      encoding:'utf8',flag:'wx',mode:0o600,
    });
    if(readFileSync(BASE,'utf8')!==raw)
      stop('base_changed_while_preparing');
    console.log('PASS LOCAL JILL HQ v34 UI candidate manifest prepared.');
    console.log('WORK v34 five security flags retained, media R2/Images OFF.');
    console.log('HOLD: No Cloudflare upload or traffic change. Real v34/candidate binary/bindings parity NOT certified.');
    console.log('Candidate path: services/jill-order-desk/app-home/dist/server/wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json');
    }
  }catch(e){
    const code=String(e?.message||'work_hq_v34_local_ui_unknown');
    console.error('STOP LOCAL WORK HQ UI PREPARATION: '+
      (/^work_hq_v34_local_ui_[a-z0-9_]+$/.test(code)?
        code:'work_hq_v34_local_ui_unverified'));
    process.exitCode=1;
  }
}
