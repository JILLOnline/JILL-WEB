// Pure policy: JILL Custom Order WORK gateway inactive replacement only.
// No Workers deployment, R2, D1, Shopify data, email or paid services.
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';
export const WORKER='jill-work-custom-orders-qa';
export const GATEWAY_KEY='JILL_CUSTOM_ORDER_GATEWAY_SECRET';
export const BACKEND_KEY='JILL_CUSTOM_ORDER_QA_BACKEND_URL';
export const SHOPIFY_KEY='SHOPIFY_WORK_APP_SECRET';
export const LIMITER='RATE_LIMITER';
export const MARKER='JILL WORK custom-order gateway INACTIVE repair ';
const fail=x=>{throw Error('gateway_inactive_policy_'+x);};
const req=(test,x)=>{if(!test)fail(x);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export function inspectActiveGatewayVersion(version){
  req(version&&uuid.test(version.id||'')&&
    Array.isArray(version.resources?.bindings)&&
    version.resources.bindings.length>=4&&
    version.resources.bindings.length<=18,
    'active_metadata_unverifiable');
  const bindings=version.resources.bindings;
  const byName=new Map(bindings.map(x=>[x.name,x]));
  req(byName.size===bindings.length,'duplicate_worker_binding');
  for(const key of [SHOPIFY_KEY,GATEWAY_KEY,BACKEND_KEY])
    req(byName.get(key)?.type==='secret_text','required_secret_missing');
  const limiter=byName.get(LIMITER);
  req(limiter&&limiter.type==='durable_object_namespace'&&
    limiter.class_name==='CustomOrderRateLimiter',
    'durable_object_binding_changed');
  req(Object.keys(version.resources?.script||{}).length>0&&
    version.resources.script?.etag,
    'script_metadata_unverifiable');
  return Object.freeze({id:version.id,bindingNames:[...byName.keys()].sort()});
}
export function inspectGatewayCandidate({active,candidate}={}){
  const base=inspectActiveGatewayVersion(active);
  const next=inspectActiveGatewayVersion(candidate);
  req(next.id!==base.id,'candidate_id_not_new');
  const a=new Map(active.resources.bindings.map(x=>[x.name,x]));
  const b=new Map(candidate.resources.bindings.map(x=>[x.name,x]));
  req(same([...a.keys()].sort(),[...b.keys()].sort()),
    'gateway_binding_set_changed');
  for(const [name,value] of a){
    req(same(value,b.get(name)),'gateway_binding_metadata_changed');
  }
  const as=active.resources.script,bs=candidate.resources.script;
  // Code etag may vary due to a repeat build; handlers must stay identical.
  req(same(as.handlers,bs.handlers)&&
    same(active.resources.script_runtime,candidate.resources.script_runtime),
    'worker_runtime_or_entry_changed');
  return Object.freeze({
    active:base.id,candidate:next.id,
    originalSecretNamesPreserved:true,
    limiterPreserved:true,
    candidateSecretValuesReadable:false,
    ordinaryTrafficChanged:false,
  });
}
export function getExactGatewayUploadVersion({versions,marker,active}={}){
  req(Array.isArray(versions)&&versions.length>0&&
    versions.length<=100&&uuid.test(active||'')&&
    typeof marker==='string'&&marker.startsWith(MARKER),
    'version_history_unverifiable');
  const matches=versions.filter(v=>
    v?.id!==active&&
    v?.annotations?.['workers/message']===marker);
  req(matches.length===1&&uuid.test(matches[0].id),
    'uploaded_version_not_unique');
  const candidate=matches[0];
  const date=Date.parse(candidate.metadata?.created_on||'');
  req(Number.isFinite(date),'candidate_timestamp_missing');
  req(!versions.some(v=>v?.id!==candidate.id&&
    Number.isFinite(Date.parse(v.metadata?.created_on))&&
    Date.parse(v.metadata.created_on)>date),
    'unknown_newer_worker_version');
  return candidate.id;
}
export function inspectGatewayDeployment(data){
  const ds=Array.isArray(data)?data:
    Array.isArray(data?.deployments)?data.deployments:
    Array.isArray(data?.result?.deployments)?data.result.deployments:null;
  req(ds&&ds.length>0&&ds.length<=30,'deployments_not_verifiable');
  const parsed=ds.map(d=>{
    req(uuid.test(d?.id||'')&&
      Number.isFinite(Date.parse(d.created_on))&&
      Array.isArray(d.versions)&&d.versions.length===1&&
      uuid.test(d.versions[0]?.version_id||'')&&
      d.versions[0].percentage===100,
      'unexpected_gateway_traffic_split');
    return {id:d.id,created:Date.parse(d.created_on),
      version:d.versions[0].version_id};
  }).sort((a,b)=>b.created-a.created);
  req(parsed.length===1||parsed[0].created>parsed[1].created,
    'ambiguous_latest_deployment');
  return Object.freeze({id:parsed[0].id,active:parsed[0].version,
    percent:100});
}
export function gatewayConfigExactlyKnown(raw){
  const expected=[
    'name = "jill-work-custom-orders-qa"',
    'main = "worker.mjs"',
    'compatibility_date = "2026-10-12"',
    'workers_dev = true',
    '',
    '[[durable_objects.bindings]]',
    'name = "RATE_LIMITER"',
    'class_name = "CustomOrderRateLimiter"',
    '',
    '[[migrations]]',
    'tag = "v1"',
    'new_sqlite_classes = ["CustomOrderRateLimiter"]',
    '',
  ].join('\n');
  req(raw===expected,'gateway_manifest_changed');
  return true;
}
export function uploadArguments({file,commit}={}){
  req(typeof file==='string'&&file.endsWith('.json')&&
    typeof commit==='string'&&/^[a-f0-9]{40}$/.test(commit),
    'upload_argument_invalid');
  return Object.freeze(['versions','upload','--config','./wrangler.toml',
    '--name',WORKER,'--strict','--keep-vars',
    '--secrets-file',file,'--message',MARKER+commit]);
}
export function stagedSecrets({secret,endpoint=JILL_HQ_WORK_QA_GOOGLE_URL}={}){
  req(typeof secret==='string'&&secret.length>=32&&
    secret.length<=256&&/^[\x21-\x7e]+$/.test(secret),
    'verified_work_secret_invalid');
  req(endpoint===JILL_HQ_WORK_QA_GOOGLE_URL&&
    endpoint.startsWith('https://script.google.com/macros/s/'),
    'wrong_google_qa_endpoint');
  return Object.freeze({[GATEWAY_KEY]:secret,[BACKEND_KEY]:endpoint});
}
