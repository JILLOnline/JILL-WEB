// SOURCE-ONLY release policy: add Cloudflare runtime version metadata to WORK
// Custom Order gateway as a new INACTIVE version. NO deployment, order or writes.
import {
  WORKER,ACTIVE, CANDIDATE as PREVIOUS, DEPLOYMENT,
  inspectGatewayZeroAllocation,
} from './work-custom-order-gateway-version-tail-policy.mjs';
import {
  inspectActiveGatewayVersion,inspectGatewayCandidate,
  stagedSecrets,SHOPIFY_KEY,GATEWAY_KEY,BACKEND_KEY,LIMITER,
} from './work-custom-order-gateway-inactive-repair-policy.mjs';
export {WORKER,ACTIVE,PREVIOUS,DEPLOYMENT,stagedSecrets};
export const META='CF_VERSION_METADATA';
export const MARKER='JILL WORK gateway version-metadata INACTIVE ';
const fail=code=>{throw Error('gateway_metadata_upload_'+code);};
const assert=(ok,code)=>{if(!ok)fail(code);};
const guid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const hex=/^[a-f0-9]{40}$/;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function exactManifest(text){
  const expected=[
    'name = "jill-work-custom-orders-qa"',
    'main = "worker.mjs"',
    'compatibility_date = "2026-10-12"',
    'workers_dev = true',
    '',
    '# Opt-in WORK health probe; metadata is non-secret and has no storage access.',
    '[version_metadata]',
    'binding = "CF_VERSION_METADATA"',
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
  assert(typeof text==='string'&&text.replace(/\r\n/g,'\n')===expected,
    'unexpected_manifest');
  return true;
}
export function exactAllocation(data){
  const report=inspectGatewayZeroAllocation(data);
  assert(report.deployment_id===DEPLOYMENT &&
    report.active_pct===100 && report.candidate_pct===0,
    'unexpected_allocation');
  return report;
}
function bindingMap(version){
  inspectActiveGatewayVersion(version);
  const b=version.resources.bindings;
  const m=new Map(b.map(x=>[x.name,x]));
  assert(m.size===b.length,'duplicate_bindings');
  return m;
}
export function inspectNewInactiveVersion({original,previous,candidate}={}){
  assert(original?.id===ACTIVE&&previous?.id===PREVIOUS&&
    guid.test(candidate?.id||'')&&
    candidate.id!==ACTIVE&&candidate.id!==PREVIOUS,
    'version_identity_drift');
  // Pre-existing live and 0%-repair versions MUST retain identical
  // original code/bindings as already certified.
  inspectGatewayCandidate({active:original,candidate:previous});
  const a=bindingMap(original),p=bindingMap(previous),next=bindingMap(candidate);
  const expected=[...p.keys(),META].sort();
  assert(equal([...next.keys()].sort(),expected),'unexpected_binding_set');
  const metadata=next.get(META);
  assert(metadata?.name===META&&metadata?.type==='version_metadata',
    'version_metadata_binding_missing');
  for(const [key,value] of p)
    assert(equal(value,next.get(key)),'existing_binding_changed');
  assert(a.get(SHOPIFY_KEY)?.type==='secret_text'&&
    a.get(GATEWAY_KEY)?.type==='secret_text'&&
    a.get(BACKEND_KEY)?.type==='secret_text'&&
    a.get(LIMITER)?.type==='durable_object_namespace',
    'original_binding_unverified');
  assert(equal(candidate.resources?.script_runtime,
      previous.resources?.script_runtime)&&
    equal(candidate.resources?.script?.handlers,
      previous.resources?.script?.handlers),
    'runtime_or_handlers_changed');
  return Object.freeze({original:ACTIVE,previous:PREVIOUS,
    new_inactive_version:candidate.id,extra_binding:META,
    secret_values_readable:false,normal_traffic_changed:false});
}
export function exactNewVersion({versions,commit}={}){
  const array=Array.isArray(versions)?versions:
    Array.isArray(versions?.result)?versions.result:
    Array.isArray(versions?.versions)?versions.versions:null;
  assert(array&&array.length>0&&array.length<=100&&hex.test(commit||''),
    'version_list_unverifiable');
  const marker=MARKER+commit;
  const found=array.filter(x=>x?.annotations?.['workers/message']===marker);
  assert(found.length===1&&guid.test(found[0]?.id||'')&&
    ![ACTIVE,PREVIOUS].includes(found[0].id),
    'new_candidate_not_unique');
  const time=Date.parse(found[0]?.metadata?.created_on||'');
  assert(Number.isFinite(time),'candidate_time_unverified');
  assert(!array.some(x=>x.id!==found[0].id&&
    Number.isFinite(Date.parse(x?.metadata?.created_on))&&
    Date.parse(x.metadata.created_on)>time),
    'unknown_newer_version');
  return found[0].id;
}
export function inactiveUploadArgs({file,commit}={}){
  assert(typeof file==='string'&&/\.json$/i.test(file)&&hex.test(commit||''),
    'invalid_upload_args');
  return Object.freeze(['versions','upload','--config','./wrangler.toml',
    '--name',WORKER,'--strict','--keep-vars','--secrets-file',
    file,'--message',MARKER+commit]);
}
