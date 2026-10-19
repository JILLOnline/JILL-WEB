// Existing WORK HQ only: one NEW inactive source upload, then read-back.
// Never attaches/deploys, opens old receipts, changes secrets, migrates D1,
// activates quote/conversation/media, or touches the gateway/LIVE/KEEP.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {prepareWorkHqV34LocalUi} from './prepare-work-hq-v34-ui-local.mjs';
import {currentAllocation} from './collect-work-runtime-readonly.mjs';
import {receiptPath} from './probe-work-gateway-connection-owner.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
export const HQ_WORKER='jill-order-desk-canary-work';
export const HQ_ACTIVE='4973b74d-d479-41da-897c-e36129303279';
export const HQ_QUOTE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
export const HQ_DEPLOYMENT='d10596df-fb98-4e6d-8b3d-a3bd0e4deaf0';
export const HQ_MARKER='JILL HQ WORK connected catalog/access v1 INACTIVE source ';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const BASE_FLAGS={JILL_WORK_HOST_STAGE:'canary',JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',JILL_WORK_MERCHANT_WRITES_ENABLED:'true',JILL_WORK_HQ_DETAIL_ENABLED:'true'};
const NEW_FLAGS={JILL_WORK_CATALOG_ENABLED:'true',JILL_WORK_CONVERSATION_ENABLED:'false',
  JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false'};
const SECRETS=['JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET'];
const fail=code=>{throw Error('work_hq_connected_'+code);};
const check=(ok,code)=>{if(!ok)fail(code);};
export function connectedBaseline(state){
  check(state?.deployment===HQ_DEPLOYMENT&&state.versions?.length===2&&
    state.versions.some(x=>x.id===HQ_ACTIVE&&x.percentage===100)&&
    state.versions.some(x=>x.id===HQ_QUOTE&&x.percentage===0),'allocation_changed');
}
function bindings(version){
  const entries=version?.resources?.bindings;
  check(Array.isArray(entries)&&entries.length<30,'bindings_unavailable');
  const out=new Map(entries.map(x=>[x.name,x]));check(out.size===entries.length,'duplicate_bindings');return out;
}
export function verifyConnectedActive(active){
  check(active?.id===HQ_ACTIVE,'active_version_changed');
  const b=bindings(active);
  check(b.size===10,'active_binding_drift');
  for(const key of SECRETS)check(b.get(key)?.type==='secret_text','missing_secret_binding');
  for(const [key,value] of Object.entries(BASE_FLAGS))
    check(b.get(key)?.type==='plain_text'&&b.get(key).text===value,'active_flag_drift');
  const db=b.get('JILL_ORDER_DESK_WORK_DB');
  check(db?.type==='d1'&&(db.id===D1||db.database_id===D1),'database_changed');
  return b;
}
export function prepareConnectedManifest(compiled){
  const manifest=structuredClone(prepareWorkHqV34LocalUi(compiled).candidate);
  check(!manifest.version_metadata,'unexpected_version_metadata');
  Object.assign(manifest.vars,NEW_FLAGS);
  manifest.version_metadata={binding:'CF_VERSION_METADATA'};
  return manifest;
}
export function inspectConnectedVersion({active,candidate,source}={}){
  const prior=verifyConnectedActive(active),next=bindings(candidate);
  check(/^[0-9a-f]{40}$/.test(source||'')&&UUID.test(candidate?.id||'')&&
    ![HQ_ACTIVE,HQ_QUOTE].includes(candidate.id)&&
    candidate.annotations?.['workers/message']===HQ_MARKER+source,'candidate_identity_unverified');
  check(next.size===prior.size+4,'candidate_binding_drift');
  for(const [key,value] of prior)check(isDeepStrictEqual(value,next.get(key)),'existing_binding_changed');
  for(const [key,value] of Object.entries(NEW_FLAGS))
    check(next.get(key)?.type==='plain_text'&&next.get(key).text===value,'candidate_flag_drift');
  check(next.get('CF_VERSION_METADATA')?.type==='version_metadata','version_metadata_missing');
  const a=active.resources,c=candidate.resources;
  check(a.script?.etag&&c.script?.etag&&a.script.etag!==c.script.etag&&
    isDeepStrictEqual(a.script.handlers,c.script.handlers),'new_code_or_handler_unverified');
  const runtime=x=>{check(x&&typeof x==='object','runtime_unavailable');const copy={...x};delete copy.assets;return copy;};
  check(isDeepStrictEqual(runtime(a.script_runtime),runtime(c.script_runtime)),'runtime_changed');
  const aa=a.script_runtime.assets,ca=c.script_runtime.assets;
  check(Boolean(aa)===Boolean(ca),'asset_routing_changed');
  if(aa)for(const [key,defaultValue] of [['html_handling','auto-trailing-slash'],['not_found_handling','none'],['run_worker_first',undefined]])
    check(isDeepStrictEqual(aa[key]??defaultValue,ca[key]??defaultValue),'asset_routing_changed');
  return {id:candidate.id,source,existing_bindings_preserved:true,
    catalog_enabled:true,quote_drafts_enabled:false,conversation_enabled:false};
}
export function git(...args){return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trim();}
export function sourceGuard(){
  check(process.platform==='win32','owner_windows_required');
  check(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===git('rev-parse','origin/jill/rewards-work'),'source_not_clean_and_synced');
  check(fs.existsSync(CLI),'local_wrangler_missing');return git('rev-parse','HEAD');
}
export function cloud(args){
  const r=spawnSync(process.execPath,[CLI,...args],{cwd:APP,encoding:'utf8',shell:false,
    timeout:120000,maxBuffer:12*1024*1024,windowsHide:true,
    env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'}});
  check(!r.error&&!r.signal&&r.status===0,'cloudflare_command_unverified');return r.stdout;
}
export function read(args){try{return JSON.parse(cloud([...args,'--name',HQ_WORKER,'--config','./wrangler.canary.jsonc','--json']));}catch{fail('cloudflare_read_unverified');}}
export const view=id=>read(['versions','view',id]);
export const allocation=()=>currentAllocation(read(['deployments','list']));
export const connectedUploadReceipt=()=>path.join(path.dirname(receiptPath()),'work-hq-connected-read-v1-upload-once-20261019.json');
function findVersion(value,source){
  const list=Array.isArray(value)?value:value?.versions||value?.result;
  check(Array.isArray(list)&&list.length<101,'versions_unavailable');
  const matches=list.filter(x=>x.annotations?.['workers/message']===HQ_MARKER+source);
  check(matches.length<=1,'candidate_not_unique');return matches[0]?.id||null;
}
function runNpm(script,cwd,{canary=false}={}){
  const r=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c','npm.cmd run '+script],{
    cwd,shell:false,stdio:'inherit',windowsHide:true,timeout:180000,
    env:{...process.env,WRANGLER_SEND_METRICS:'false',...(canary?{JILL_BUILD_TARGET:'canary'}:{})}});
  check(!r.error&&!r.signal&&r.status===0,'local_check_failed');
}
function bundleDigest(directory){
  const hash=createHash('sha256');
  function walk(folder){for(const name of fs.readdirSync(folder).sort()){
    const file=path.join(folder,name),stat=fs.lstatSync(file);check(!stat.isSymbolicLink(),'symlinked_bundle');
    if(stat.isDirectory())walk(file);else if(stat.isFile())hash.update(path.relative(directory,file).split(path.sep).join('/')+'\n').update(fs.readFileSync(file));
  }}walk(directory);return hash.digest('hex');
}
export function reserveConnectedAttempt(file,data){
  let fd;try{fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({...data,retry_allowed:false})+'\n');fs.fsyncSync(fd);}
  catch{fail('upload_attempt_spent_or_receipt_failed');}finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function execute(mode){
  let attempted=false,phase='preflight';
  try{
    const source=sourceGuard();
    const receipt=connectedUploadReceipt();
    let previous=null;
    if(fs.existsSync(receipt)){check(!fs.lstatSync(receipt).isSymbolicLink(),'symlinked_receipt');previous=JSON.parse(fs.readFileSync(receipt,'utf8'));}
    if(mode==='--stage-once')check(previous===null,'upload_attempt_spent_inspect_only');
    const before=allocation();connectedBaseline(before);
    const active=view(HQ_ACTIVE);verifyConnectedActive(active);
    const runner=mode==='--inspect'&&previous?previous.source:source;
    check(/^[0-9a-f]{40}$/.test(runner),'invalid_receipt_source');
    const id=findVersion(read(['versions','list']),runner);
    if(mode==='--inspect'){
      const candidate=id?inspectConnectedVersion({active,candidate:view(id),source:runner}):null;
      check(isDeepStrictEqual(before,allocation()),'allocation_changed_during_inspection');
      console.log(JSON.stringify({environment:'WORK',mode:'read_only',allocation:before,candidate,
        upload_receipt_present:previous!==null,no_upload_or_deployment:true,no_signed_post:true},null,2));return;
    }
    check(id===null,'candidate_already_uploaded');
    phase='local_checks';
    for(const name of ['test:work-connected-source','test:jill-order-desk-home','test:work-hq-connected-stage'])runNpm(name,ROOT);
    runNpm('typecheck',APP);runNpm('build',APP,{canary:true});
    runNpm('test:workerd-connected-read-local',APP);
    const base=path.join(APP,'dist/server/wrangler.json');
    const target=path.join(APP,'dist/server/wrangler.hq-connected-read.json');
    fs.writeFileSync(target,JSON.stringify(prepareConnectedManifest(JSON.parse(fs.readFileSync(base,'utf8'))),null,2)+'\n',{mode:0o600});
    const args=['versions','upload','--config',target,'--keep-vars','--message',HQ_MARKER+source];
    phase='dry_run';cloud([...args,'--dry-run']);
    check(sourceGuard()===source,'source_changed');connectedBaseline(allocation());
    verifyConnectedActive(view(HQ_ACTIVE));
    check(findVersion(read(['versions','list']),source)===null,'candidate_appeared_during_preflight');
    const digest=bundleDigest(path.join(APP,'dist'));
    phase='inactive_upload';reserveConnectedAttempt(receipt,{operation:'HQ_CONNECTED_READ_V1_INACTIVE_UPLOAD',source,
      package_sha256:digest,baseline:before,reserved_at:new Date().toISOString()});attempted=true;
    cloud(args);
    phase='inactive_readback';const after=allocation();check(isDeepStrictEqual(before,after),'allocation_changed_after_upload');
    const uploaded=findVersion(read(['versions','list']),source);check(uploaded!==null,'uploaded_version_unverified');
    const checked=inspectConnectedVersion({active:view(HQ_ACTIVE),candidate:view(uploaded),source});
    console.log(JSON.stringify({environment:'WORK',source,package_sha256:digest,candidate:checked,
      allocation:after,ordinary_traffic_unchanged:true,existing_quote_canary_unchanged:true,
      upload_receipt_spent:true,deployment_performed:false,secret_changes:false,
      customer_data_or_schema_changes:false,new_billable_services:false},null,2));
  }catch(error){
    const message=/^work_hq_connected_[a-z_]+$/.test(error?.message)?error.message:'work_hq_connected_unverified';
    console.error('STOP '+message+' at '+phase+'.');
    console.error(attempted?'An inactive upload MAY exist. Do not retry; use work:hq:connected:inspect.':'No upload or deployment requested.');process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||!['--stage-once','--inspect'].includes(process.argv[2])){
    console.error('STOP work_hq_connected_explicit_mode_required');process.exitCode=1;
  }else await execute(process.argv[2]);
}
