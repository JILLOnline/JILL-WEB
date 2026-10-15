// JILL HQ WORK: release only the exact inspected Cloudflare secret candidate.
// No secret read, generation, printing, transfer or rotation; this operation
// never touches Google QA, the Shopify app config, My JILL or LIVE.
// Operator approval is REQUIRED after all version/binding checks pass.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {
  currentWorkerVersion,assertAnonymousInboxDenied,
} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const WORKER='jill-order-desk-canary-work';
const CONFIG='./wrangler.canary.jsonc';
const BASE='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const ACTIVE='49b10c46-8e00-4ef3-8075-74eea29e9c9e';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const CANDIDATE_MESSAGE='JILL HQ WORK existing Google QA read key; NOT released';
const READ_SECRET='JILL_HQ_MERCHANT_READ_SECRET';
const EXISTING_SECRET_NAMES=Object.freeze(['JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET']);
const STAGE_VAR=Object.freeze({
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
});

function gate(ok,code){if(!ok)throw Error(code);}
// Stable JSON representation prevents a false Worker drift warning caused
// solely by Cloudflare reordering object keys. Arrays and all values remain
// strict: a real difference still blocks the release.
export function sameStructuredData(a,b){
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(value && typeof value==='object')
      return Object.fromEntries(Object.keys(value).sort()
        .map(k=>[k,canonical(value[k])]));
    return value;
  }
  return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
}
export function safeRuntimeDiffLabels(activeRuntime,candidateRuntime){
  // Exact Cloudflare Workers version `script_runtime` API members:
  // compatibility_date, compatibility_flags, exports, limits,
  // migration_tag and usage_model. In particular, exports and migration_tag
  // carry Durable Object/entrypoint lifecycle information and MUST never
  // be waved through as "unimportant" metadata.
  const known=[
    'compatibility_date','compatibility_flags','exports',
    'limits','migration_tag','usage_model',
  ];
  const safe=[];
  for(const key of known) {
    if(!sameStructuredData(activeRuntime?.[key],candidateRuntime?.[key]))
      safe.push(key);
  }
  const extraA=activeRuntime&&typeof activeRuntime==='object'?
    Object.fromEntries(Object.entries(activeRuntime)
      .filter(([k])=>!known.includes(k))):{};
  const extraC=candidateRuntime&&typeof candidateRuntime==='object'?
    Object.fromEntries(Object.entries(candidateRuntime)
      .filter(([k])=>!known.includes(k))):{};
  if(!sameStructuredData(extraA,extraC))safe.push('other_runtime_settings');
  return safe;
}
// Only reports field presence and shape. Never print runtime values,
// DO class/export names, HMAC material, Cloudflare JSON or request data.
export function safeRuntimeDiffShapes(activeRuntime,candidateRuntime){
  const differing=safeRuntimeDiffLabels(activeRuntime,candidateRuntime);
  function shape(value){
    if(value===undefined)return 'absent';
    if(value===null)return 'null';
    if(Array.isArray(value))return 'array';
    if(typeof value==='object')return 'object';
    return typeof value;
  }
  return differing.map(field=>{
    if(field==='other_runtime_settings')
      return 'other_runtime_settings (unknown API members; blocked)';
    const active=activeRuntime?.[field],candidate=candidateRuntime?.[field];
    return field+' (active='+shape(active)+', candidate='+shape(candidate)+')';
  });
}
// Identify only UNKNOWN top-level Cloudflare runtime setting NAMES and SHAPES.
// This is a read-only diagnosis; do not print metadata values, secret material
// or request data. Unknown runtime changes still fail closed.
export function safeUnknownRuntimeDifferences(activeRuntime,candidateRuntime){
  const documented=new Set([
    'compatibility_date','compatibility_flags','exports',
    'limits','migration_tag','usage_model',
  ]);
  const a=(activeRuntime && typeof activeRuntime==='object')?activeRuntime:{};
  const c=(candidateRuntime && typeof candidateRuntime==='object')?candidateRuntime:{};
  const names=[...new Set([...Object.keys(a),...Object.keys(c)])]
    .filter(k=>!documented.has(k))
    .filter(k=>!sameStructuredData(a[k],c[k]))
    .sort();
  function kind(obj,key){
    if(!Object.prototype.hasOwnProperty.call(obj,key))return 'absent';
    if(obj[key]===null)return 'null';
    if(Array.isArray(obj[key]))return 'array';
    return typeof obj[key];
  }
  // Untrusted keys are never logged unless they look like ordinary platform
  // metadata labels. Redact credential-like and private names by default.
  function label(k){
    return /^[a-z][a-z0-9_]{0,63}$/.test(k) &&
      !/(secret|credential|token|password|private|customer|email|authorization|api_key|hmac)/i.test(k)
      ?k:'redacted_field_name';
  }
  return names.slice(0,16).map(k=>
    label(k)+' (active='+kind(a,k)+', candidate='+kind(c,k)+')')
    .concat(names.length>16?['additional_fields_omitted']:[]);
}
// Cloudflare Wrangler documents omitted static-asset options as:
// html_handling: auto-trailing-slash; not_found_handling: none.
// Cloudflare's secret-version materialization may add these as explicit
// defaults to an existing asset configuration. Permit ONLY these exact
// implicit->explicit equivalents and require ALL OTHER metadata unchanged.
// No fallback for unknown asset options, dynamic routing or runtime state.
export function sameRuntimeWithDocumentedAssetDefaults(activeRuntime,candidateRuntime){
  if(!activeRuntime || !candidateRuntime ||
    typeof activeRuntime!=='object' || typeof candidateRuntime!=='object' ||
    Array.isArray(activeRuntime) || Array.isArray(candidateRuntime))return false;
  const aa=activeRuntime.assets,ca=candidateRuntime.assets;
  if(!aa || !ca || typeof aa!=='object' || typeof ca!=='object' ||
    Array.isArray(aa) || Array.isArray(ca))return false;
  const candidateAssets={...ca};
  const own=Object.prototype.hasOwnProperty;
  for(const [field,defaultValue] of [
    ['html_handling','auto-trailing-slash'],
    ['not_found_handling','none'],
  ]){
    if(!own.call(aa,field) && own.call(ca,field)){
      if(ca[field]!==defaultValue)return false;
      delete candidateAssets[field];
    }
  }
  return sameStructuredData(activeRuntime,{
    ...candidateRuntime,assets:candidateAssets,
  });
}
export function safeAssetDefaultAssessment(activeRuntime,candidateRuntime){
  const defaults={
    html_handling:'auto-trailing-slash',
    not_found_handling:'none',
  };
  const a=activeRuntime?.assets??{};
  const c=candidateRuntime?.assets??{};
  const own=Object.prototype.hasOwnProperty;
  return Object.keys(defaults).map(field=>{
    const wasMissing=!own.call(a,field);
    const nowExplicit=own.call(c,field);
    const allowed=wasMissing && nowExplicit && c[field]===defaults[field];
    return {field,active:wasMissing?'omitted':'specified',
      candidate:nowExplicit?'specified':'omitted',
      matchesDocumentedDefault:allowed};
  });
}
// Read-only static asset metadata inspection. Reveal ONLY short structural
// field paths and value types, never their values, hashes, filenames, JWTs,
// path-derived property names, complete Cloudflare JSON or customer data.
export function safeAssetDifferences(activeAssets,candidateAssets,{maxItems=20,maxDepth=5}={}){
  const out=[];
  function valueType(v){
    if(v===undefined)return 'absent';
    if(v===null)return 'null';
    if(Array.isArray(v))return 'array';
    return typeof v;
  }
  function segment(raw){
    if(typeof raw==='number')return '.[entry]';
    if(/^[a-z][a-z0-9_]{0,35}$/i.test(raw) &&
       !/(secret|token|password|credential|authorization|private|customer|email|jwt|hmac|key)/i.test(raw))
      return '.'+raw;
    return '.[redacted]';
  }
  function dive(a,b,path,depth){
    if(out.length>=maxItems || sameStructuredData(a,b))return;
    const ta=valueType(a),tb=valueType(b);
    if(depth>=maxDepth || ta!==tb || a===null || b===null ||
       (ta!=='object' && ta!=='array')){
      out.push(path+' (active='+ta+', candidate='+tb+', values=different)');
      return;
    }
    if(ta==='array'){
      if(a.length!==b.length)
        out.push(path+'.length (active=array, candidate=array, values=different)');
      const count=Math.min(a.length,b.length,12);
      for(let i=0;i<count && out.length<maxItems;i++)
        dive(a[i],b[i],path+segment(i),depth+1);
      if(Math.max(a.length,b.length)>12 && out.length<maxItems)
        out.push(path+'.[more entries omitted]');
      return;
    }
    const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
    for(let i=0;i<Math.min(keys.length,40) && out.length<maxItems;i++){
      const k=keys[i];
      dive(a[k],b[k],path+segment(k),depth+1);
    }
    if(keys.length>40 && out.length<maxItems)out.push(path+'.[more fields omitted]');
  }
  dive(activeAssets,candidateAssets,'assets',0);
  return out.slice(0,maxItems);
}
export function selectVerifiedCandidate(list,activeVersion,activeId=ACTIVE){
  gate(Array.isArray(list)&&list.length>=2&&list.length<=10,'invalid_version_list');
  gate(activeVersion?.id===activeId && activeId===ACTIVE,'active_version_changed');
  const available=list.filter(v=>v?.id && v?.metadata?.created_on);
  gate(available.length===list.length,'incomplete_version_list');
  const sorted=[...available].sort((a,b)=>
    Date.parse(a.metadata.created_on)-Date.parse(b.metadata.created_on));
  gate(sorted.every(v=>Number.isFinite(Date.parse(v.metadata.created_on))),
    'invalid_version_timestamps');
  const matches=sorted.filter(v=>v.id!==ACTIVE &&
    v.annotations?.['workers/message']===CANDIDATE_MESSAGE &&
    Date.parse(v.metadata.created_on)>
      Date.parse(activeVersion.metadata.created_on));
  gate(matches.length===1,'candidate_not_unique_or_missing');
  const candidate=matches[0];
  gate(sorted.at(-1)?.id===candidate.id,'candidate_not_latest');
  gate(/^[0-9a-f-]{36}$/.test(candidate.id),'invalid_candidate_id');
  return candidate.id;
}
function orderedBindings(bindings){
  gate(Array.isArray(bindings),'missing_bindings');
  const names=bindings.map(b=>b?.name);
  gate(names.every(n=>typeof n==='string')&&new Set(names).size===names.length,
    'duplicate_or_unnamed_binding');
  return [...bindings].sort((a,b)=>a.name.localeCompare(b.name));
}
function assertBinding(b,name,type,value){
  gate(b && b.name===name && b.type===type && b.text===value,
    'worker_stage_binding_invalid');
}
export function inspectVersions({active,candidate}){
  gate(active?.id===ACTIVE && candidate?.id &&
    candidate?.id!==ACTIVE,'wrong_worker_versions');
  gate(active?.metadata?.created_on && candidate?.metadata?.created_on &&
    Date.parse(candidate.metadata.created_on)>Date.parse(active.metadata.created_on),
    'candidate_not_newer');
  gate(candidate.annotations?.['workers/message']===CANDIDATE_MESSAGE,
    'candidate_message_mismatch');
  gate(active.resources?.script?.etag &&
    active.resources.script.etag===candidate.resources?.script?.etag,
    'worker_code_fingerprint_changed');
  gate(JSON.stringify(active.resources.script.handlers)===
    JSON.stringify(candidate.resources.script.handlers),
    'worker_handler_changed');
  gate(sameStructuredData(active.resources.script_runtime,
      candidate.resources.script_runtime) ||
    sameRuntimeWithDocumentedAssetDefaults(
      active.resources.script_runtime,candidate.resources.script_runtime),
    'worker_runtime_changed');
  const a=orderedBindings(active.resources.bindings);
  const c=orderedBindings(candidate.resources.bindings);
  const abc=new Map(a.map(b=>[b.name,b]));
  const cbc=new Map(c.map(b=>[b.name,b]));
  gate(a.length+1===c.length,'unexpected_binding_change');
  gate(!abc.has(READ_SECRET),'active_worker_already_connected');
  gate(cbc.get(READ_SECRET)?.type==='secret_text','candidate_secret_missing');
  for(const name of EXISTING_SECRET_NAMES)
    gate(abc.get(name)?.type==='secret_text' &&
      cbc.get(name)?.type==='secret_text','existing_shopify_secret_missing');
  for(const [name,value] of Object.entries(STAGE_VAR)){
    assertBinding(abc.get(name),name,'plain_text',value);
    assertBinding(cbc.get(name),name,'plain_text',value);
  }
  const raw=JSON.stringify(abc.get('JILL_ORDER_DESK_WORK_DB')||{});
  gate(abc.has('JILL_ORDER_DESK_WORK_DB') && raw.includes(D1),
    'work_d1_binding_drift');
  for(const b of a) {
    // Entire binding payload must remain identical, not merely the name.
    // For secret_text, Cloudflare returns metadata, not plaintext values.
    gate(sameStructuredData(b,cbc.get(b.name)),
      'binding_changed_'+b.name);
  }
  return Object.freeze({
    activeId:active.id,
    candidateId:candidate.id,
    secretNames:[...EXISTING_SECRET_NAMES,READ_SECRET].sort(),
    bindingCount:c.length,
  });
}
function cli(args){
  gate(fs.existsSync(BIN),'local_wrangler_not_installed');
  const processResult=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe'],
  });
  gate(!processResult.error && processResult.status===0,'wrangler_read_or_deploy_failed');
  return String(processResult.stdout||'');
}
function parseJSON(output){
  try {
    const result=JSON.parse(output.trim());
    gate(result!==null && typeof result==='object','unexpected_wrangler_json');
    return result;
  }catch{throw Error('invalid_wrangler_json');}
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function assertSource(){
  gate(git('branch','--show-current')==='jill/rewards-work','wrong_work_branch');
  gate(git('rev-parse','HEAD')===
    git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'unsynced_work_branch');
  gate(!git('status','--porcelain','--untracked-files=no'),
    'uncommitted_changes');
}
function activeStatus(){
  return currentWorkerVersion(cli(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));
}
function version(id){
  return parseJSON(cli(['versions','view',id,'--name',WORKER,
    '--config',CONFIG,'--json']));
}
function candidateList(){
  return parseJSON(cli(['versions','list','--name',WORKER,
    '--config',CONFIG,'--json']));
}
async function checkAnonymous(pathname,expect){
  const res=await fetch(BASE+pathname,{
    redirect:'manual',signal:AbortSignal.timeout(20000),
  });
  if(expect==='deny')assertAnonymousInboxDenied(res.status);
  else gate(res.status===expect,'unexpected_http_status');
}
export function rolloutArguments(candidateId){
  gate(/^[0-9a-f-]{36}$/.test(candidateId),'invalid_candidate_id');
  return [
    'versions','deploy',candidateId+'@100%',
    '--name',WORKER,'--config',CONFIG,'--yes',
    '--message','JILL HQ WORK owner-only read-only Google merchant feed',
  ];
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let step='source',io;
  try{
    const mode=process.argv.includes('--inspect')?'inspect':'release';
    assertSource();
    step='worker';
    gate(activeStatus()===ACTIVE,'active_version_changed');
    const active=version(ACTIVE);
    const id=selectVerifiedCandidate(candidateList(),active);
    step='candidate';
    const candidate=version(id);
    // Log only the names of well-defined runtime fields, NEVER their values.
    // A true change remains an absolute release blocker.
    const runtimeDifferences=safeRuntimeDiffLabels(
      active.resources?.script_runtime,candidate.resources?.script_runtime);
    if(runtimeDifferences.length) {
      console.error('WORK runtime differences (API fields only): '+
        runtimeDifferences.join(', '));
      for(const detail of safeRuntimeDiffShapes(
        active.resources?.script_runtime,candidate.resources?.script_runtime))
        console.error('WORK runtime field: '+detail);
      if(runtimeDifferences.includes('other_runtime_settings')) {
        for(const detail of safeUnknownRuntimeDifferences(
          active.resources?.script_runtime,candidate.resources?.script_runtime))
          console.error('WORK unknown runtime key (name/type only): '+detail);
      }
      if(!sameStructuredData(
        active.resources?.script_runtime?.assets,
        candidate.resources?.script_runtime?.assets)) {
        for(const assessment of safeAssetDefaultAssessment(
          active.resources?.script_runtime,
          candidate.resources?.script_runtime)) {
          if(assessment.active==='omitted' &&
            assessment.candidate==='specified')
            console.log('WORK static asset '+assessment.field+
              ' matches Cloudflare documented default: '+
              assessment.matchesDocumentedDefault);
        }
        const defaultParity=sameRuntimeWithDocumentedAssetDefaults(
          active.resources?.script_runtime,
          candidate.resources?.script_runtime);
        if(defaultParity)
          console.log('PASS only exact implicit-to-explicit Cloudflare static asset defaults.');
        else
          console.error('WORK asset metadata differs; release stays blocked.');
        for(const detail of safeAssetDifferences(
          active.resources?.script_runtime?.assets,
          candidate.resources?.script_runtime?.assets))
          console.error('WORK asset field (path/type only): '+detail);
      }
    }
    const match=inspectVersions({active,candidate});
    console.log('PASS WORK active version: '+match.activeId);
    console.log('PASS exact inactive key candidate: '+match.candidateId);
    console.log('PASS equivalent Worker code, runtime and static-asset defaults, same D1/Shopify secrets, OAuth ON, Owner setup OFF.');
    console.log('PASS only added binding: '+READ_SECRET+' (secret_text).');
    if(mode==='inspect') {
      console.log('READ-ONLY inspection complete. No traffic switched.');
    }else{
      step='pre_release';
      gate(activeStatus()===ACTIVE,'active_version_changed_before_release');
      // Re-read candidate to defend against independent mutations.
      inspectVersions({active:version(ACTIVE),candidate:version(id)});
      io=createInterface({input:process.stdin,output:process.stdout});
      const reply=await io.question(
        '\nType RELEASE JILL HQ WORK INBOX to deploy the inspected version at 100%: ');
      gate(reply==='RELEASE JILL HQ WORK INBOX','release_not_approved');
      gate(activeStatus()===ACTIVE,'active_version_changed_at_approval');
      inspectVersions({active:version(ACTIVE),candidate:version(id)});
      step='release';
      cli(rolloutArguments(id));
      step='post_release';
      gate(activeStatus()===id,'deployed_version_mismatch');
      await checkAnonymous('/healthz',200);
      await checkAnonymous('/auth/login',200);
      await checkAnonymous('/app/requests','deny');
      await checkAnonymous('/app/setup-owner',410);
      console.log('PASS WORK candidate deployed at 100%: '+id);
      console.log('PASS public health/login, anonymous inbox denied, Owner setup OFF.');
      console.log('Next: authenticate in Shopify WORK > JILL HQ > Custom Orders; expect 2 requests.');
    }
    console.log('LIVE/KEEP/Google QA/My JILL/Rewards: no changes performed by this command.');
  }catch(error){
    // Error is always a code authored above; avoid logging Cloudflare HTTP
    // responses or raw exception details which may carry sensitive data.
    const safe=typeof error?.message==='string' &&
      /^[a-z][a-z0-9_]{3,110}$/.test(error.message)
      ?error.message:'unexpected_failure';
    console.error('JILL HQ WORK '+step+' STOPPED: '+safe);
    if(step==='post_release')
      console.error('A deployment MAY be active; verify Cloudflare status before retrying.');
    process.exitCode=1;
  }finally{io?.close();}
}
