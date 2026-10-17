// JILL HQ Phase 32 — LOCAL SOURCE DELTA and compiled asset INVENTORY.
// No Cloudflare / Shopify / Google / LIVE data reads, no uploads, traffic,
// database or billing actions. No compiled code or customer data is printed.
//
// IMPORTANT: pinned historical Git source below is a PRE-v34-release
// checkpoint, NOT verified byte provenance of deployed WORK v34.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join,relative,sep} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {prepareWorkHqV34LocalUi}
  from './prepare-work-hq-v34-ui-local.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const DIST=join(APP,'dist');
const BASELINE='f75336c6520f7dd75217cc6b6815fc828083a87d';
const APP_PREFIX='services/jill-order-desk/app-home/';
const FILES=Object.freeze({
  [APP_PREFIX+'app/components/WorkOriginalRequestDetails.tsx']:'M',
  [APP_PREFIX+'app/routes.ts']:'M',
  [APP_PREFIX+'app/routes/app.requests.media.inspect.tsx']:'A',
  [APP_PREFIX+'workers/app.ts']:'M',
});
const SCOPES=Object.freeze([
  APP_PREFIX+'app/',APP_PREFIX+'workers/',
  'backend/','services/custom-order-cloudflare/',
  APP_PREFIX+'wrangler.jsonc',
  APP_PREFIX+'wrangler.canary.jsonc',
]);
const STOP=code=>{throw Error('work_hq_v35_source_review_'+code);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:18000,
    maxBuffer:1024*1024,
  }).trim();}
  catch{STOP('git_unavailable');}
}
function diffChanges(binary){
  // -z emits STATUS\0PATH\0 for ordinary A/M/D entries. Rename
  // detection is disabled to avoid permissive old/new path handling.
  const parts=String(binary).split('\0');
  if(parts.at(-1)!=='')STOP('diff_not_null_terminated');
  parts.pop();
  if(parts.length%2!==0)STOP('diff_invalid');
  const changes=[];
  for(let i=0;i<parts.length;i+=2){
    const status=parts[i],path=parts[i+1];
    if(!/^[AMD]$/.test(status)||!path||path.includes('..')||
       path.includes('\\')||path.startsWith('/'))
      STOP('unexpected_diff_entry');
    changes.push({status,path});
  }
  return changes;
}
export function reviewWorkV35RuntimeDelta(changes){
  if(!Array.isArray(changes)||changes.length!==4)
    STOP('runtime_file_count_changed');
  const found=new Map();
  for(const c of changes){
    if(!plain(c)||Object.keys(c).length!==2||
       typeof c.path!=='string'||typeof c.status!=='string'||
       !Object.hasOwn(FILES,c.path)||FILES[c.path]!==c.status||
       found.has(c.path))STOP('unexpected_runtime_change');
    found.set(c.path,c.status);
  }
  if(found.size!==4)STOP('runtime_file_count_changed');
  return Object.freeze({
    status:'historical_git_source_delta_only',
    changed_runtime_files:Object.freeze(
      Object.keys(FILES).sort().map(p=>Object.freeze({
        path:p,status:FILES[p],
      }))),
    source_change_count:4,
    cloudflare_v34_source_commit_proven:false,
    actual_deployed_worker_bytes_compared:false,
    browser_asset_bytes_compared_to_v34:false,
    new_owner_media_route_present_but_flag_off:true,
    UI_only_change:false,
    deployment_authorized:false,
    version_upload_authorized:false,
    rollback_executed:false,
    real_status_mutation_verified:false,
  });
}
// Vite's Cloudflare adapter emits an extensionless root .assetsignore
// file in dist/client. Allow THAT single exact generated filename only,
// with a smaller size cap, not a general exception for dotfiles.
const EXT=/\.(?:js|mjs|css|html|json|map|svg|png|jpg|jpeg|webp|gif|avif|ico|woff2?|ttf|otf|eot|webmanifest|wasm|txt)$/i;
function safeTree(root,distRoot){
  if(!existsSync(root)||lstatSync(root).isSymbolicLink()||
     !lstatSync(root).isDirectory())
    STOP('build_tree_unavailable');
  const result=[];
  function walk(dir){
    const names=readdirSync(dir).sort();
    for(const n of names){
      const p=join(dir,n),stat=lstatSync(p);
      if(stat.isSymbolicLink()||
         (!stat.isFile()&&!stat.isDirectory()))
        STOP('build_tree_unsafe_type');
      if(stat.isDirectory())walk(p);
      else{
        const name=relative(distRoot,p).split(sep).join('/');
        // One exact generated root file, not all extensionless files.
        const isIgnore=name==='client/.assetsignore';
        if(!isIgnore&&!EXT.test(n))
          STOP('unexpected_build_extension');
        if(stat.size>(isIgnore?4096:16*1024*1024))
          STOP('compiled_file_size_exceeded');
        result.push({path:p,bytes:stat.size});
        if(result.length>500)STOP('build_tree_too_large');
      }
    }
  }
  walk(root);
  if(result.length===0)STOP('empty_build_tree');
  return result;
}
export function inventoryWorkHqLocalBuild(distRoot=DIST){
  if(typeof distRoot!=='string'||!distRoot)
    STOP('build_tree_unavailable');
  const dirs=[join(distRoot,'server'),join(distRoot,'client')];
  if(!dirs.every(existsSync))STOP('compiled_assets_not_found');
  const all=dirs.flatMap(dir=>safeTree(dir,distRoot));
  if(all.length>500)STOP('build_tree_too_large');
  if(!all.some(v=>v.path===join(distRoot,'server/index.js')))
    STOP('compiled_worker_not_found');
  let size=0;
  const fingerprint=createHash('sha256');
  for(const f of all){
    size+=f.bytes;
    if(size>200*1024*1024)STOP('build_tree_too_large');
    const name=relative(distRoot,f.path).split(sep).join('/');
    const hash=createHash('sha256').update(readFileSync(f.path)).digest('hex');
    fingerprint.update(name+'\0'+f.bytes+'\0'+hash+'\n');
  }
  return Object.freeze({
    compiled_file_count:all.length,compiled_total_bytes:size,
    local_artifact_inventory_sha256:fingerprint.digest('hex'),
    v34_comparison_possible:false,
  });
}
function checkSource(){
  if(git('branch','--show-current')!=='jill/rewards-work'||
     git('rev-parse','HEAD')!==
       git('rev-parse','refs/remotes/origin/jill/rewards-work')||
     git('status','--porcelain','--untracked-files=no'))
    STOP('source_not_synced');
  if(git('rev-parse',BASELINE+'^{commit}')!==BASELINE)
    STOP('historical_checkpoint_missing');
  if(git('merge-base',BASELINE,'HEAD')!==BASELINE)
    STOP('historical_checkpoint_not_ancestor');
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='args';
  try{
    if(process.argv.length!==3||
       !['--review-local','--inventory-compiled-ci'].includes(process.argv[2]))
      STOP('invalid_mode');
    // CI checkout has detached HEAD. Limit that mode to an inventory
    // only; it NEVER emits the full source-review PASS or skips source
    // validation for the operator's --review-local workflow.
    if(process.argv[2]==='--inventory-compiled-ci'){
      phase='local_build_inventory_ci';
      const built=inventoryWorkHqLocalBuild();
      console.log('PASS WORK Phase32 ACTUAL CI build inventory: '+
        built.compiled_file_count+' files, '+
        built.compiled_total_bytes+' bytes; no unexpected file types.');
      console.log('READ ONLY: CI local compiled assets only; no historical source or deployed-v34 binary parity claim.');
    }else{
    phase='git';
    checkSource();
    phase='runtime_source_delta';
    const raw=execFileSync('git',['-C',ROOT,
      'diff','--name-status','--no-renames','-z',BASELINE,'HEAD',
      '--',...SCOPES],{
      encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024,
    });
    const changes=diffChanges(raw);
    const scope=reviewWorkV35RuntimeDelta(changes);
    phase='inert_media_and_candidate';
    const worker=readFileSync(join(APP,'workers/app.ts'),'utf8');
    const component=readFileSync(join(APP,
      'app/components/WorkOriginalRequestDetails.tsx'),'utf8');
    const provenance=readFileSync(join(ROOT,
      'services/jill-order-desk/work-reference-provenance.mjs'),'utf8');
    if(!component.includes('describeWorkReference(id)')||
       !provenance.includes("kind:'legacy_cloudinary_url'")||
       !worker.includes('private_media_not_enabled')||
       !worker.includes('JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED'))
      STOP('expected_guard_not_present');
    const base=JSON.parse(readFileSync(join(DIST,'server/wrangler.json'),'utf8'));
    const local=JSON.parse(readFileSync(join(DIST,
      'server/wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json'),'utf8'));
    if(!isDeepStrictEqual(
      prepareWorkHqV34LocalUi(base).candidate,local))
      STOP('candidate_drift');
    phase='local_build_inventory';
    const build=inventoryWorkHqLocalBuild();
    console.log('PASS LOCAL source changes vs historic pre-v34 checkpoint: exactly '+scope.source_change_count+' reviewed runtime files.');
    console.log('PASS LOCAL unchanged existing authentication/gateway source and source Wrangler manifests.');
    console.log('PASS LOCAL reference classifier and disabled-by-default media inspection guard.');
    console.log('PASS LOCAL compiled Worker + client asset inventory: '+build.compiled_file_count+' files, '+build.compiled_total_bytes+' bytes.');
    console.log('LOCAL artifact inventory SHA-256: '+build.local_artifact_inventory_sha256);
    console.log('HOLD: historical Git checkpoint is NOT independently proven as actual deployed v34 source.');
    console.log('HOLD: Active v34 compiled Worker/asset bytes NOT compared; candidate also adds a disabled media route, so this is NOT UI-only.');
    console.log('READ ONLY: No Cloudflare calls, uploads, deployments, D1 writes, Shopify/Google calls or paid changes.');
    }
  }catch(e){
    const c=String(e?.message||'work_hq_v35_source_review_unverified');
    console.error('STOP WORK Phase32 SOURCE REVIEW: '+
      (/^work_hq_v35_source_review_[a-z0-9_]+$/.test(c)?
        c:'work_hq_v35_source_review_unverified'));
    console.error('READ ONLY PHASE: '+phase);
    process.exitCode=1;
  }
}
