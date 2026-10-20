// Pure WORK Custom Orders release policy. No cloud, secrets, files, or HTTP.
// Future OWNER APPROVAL REQUIRED before any 100%-original/0%-metadata deployment.
import {
  WORKER,ACTIVE,PREVIOUS,DEPLOYMENT,META,MARKER,
  exactManifest,exactAllocation,inspectNewInactiveVersion,exactNewVersion,
} from './work-gateway-version-metadata-inactive-policy.mjs';
import {HOST} from './work-custom-order-gateway-version-tail-policy.mjs';
export {
  WORKER,ACTIVE,PREVIOUS,DEPLOYMENT,META,MARKER,HOST,
  exactManifest,exactAllocation,inspectNewInactiveVersion,exactNewVersion,
};
export const NEW='9322193f-5e87-4479-88c9-39229dddb5f2';
export const UPLOAD_COMMIT='a4a9840ce83e04dd85f7f2e306cdcdd037b56d6a';
export const OVERRIDE_HEADER='Cloudflare-Workers-Version-Overrides';
export const VERSION_HEADER='x-jill-work-gateway-version';
export const PROBE_PARAMETER='jill_work_version_probe';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const reject=code=>{throw Error('gateway_metadata_zero_'+code);};
const need=(predicate,code)=>{if(!predicate)reject(code);};
export function releaseArguments(){
  return Object.freeze(['versions','deploy',ACTIVE+'@100%',NEW+'@0%',
    '--name',WORKER,'--config','./wrangler.toml','--yes','--message',
    'JILL WORK verified metadata candidate 0pct; original stays 100pct']);
}
export function overrideValue(){
  return WORKER+'="'+NEW+'"';
}
export function metadataProbeUrl(uuid){
  need(UUID.test(uuid||''),'invalid_probe_uuid');
  return HOST+'/healthz?'+PROBE_PARAMETER+'='+uuid;
}
function newestDeployments(value) {
  const entries=Array.isArray(value)?value:
    Array.isArray(value?.deployments)?value.deployments:
    Array.isArray(value?.result?.deployments)?
      value.result.deployments:null;
  need(entries&&entries.length>0&&entries.length<=30,
    'deployment_list_unverifiable');
  const ordered=entries.map(x=>{
    need(UUID.test(x?.id||'')&&
      Number.isFinite(Date.parse(x?.created_on||''))&&
      Array.isArray(x?.versions)&&x.versions.length>=1&&
      x.versions.length<=2,'deployment_shape_unverifiable');
    const share=new Map();
    for(const v of x.versions){
      need(UUID.test(v?.version_id||'')&&
        Number.isFinite(v?.percentage)&&
        v.percentage>=0&&v.percentage<=100&&
        !share.has(v.version_id),
        'deployment_share_invalid');
      share.set(v.version_id,v.percentage);
    }
    need([...share.values()].reduce((a,b)=>a+b,0)===100,
      'deployment_share_sum_invalid');
    return {id:x.id,when:Date.parse(x.created_on),share};
  }).sort((a,b)=>b.when-a.when);
  need(ordered.length===1||ordered[0].when>ordered[1].when,
    'latest_deployment_ambiguous');
  return ordered[0];
}
export function verifyNewZeroAllocation(value,{previousDeployment=DEPLOYMENT}={}){
  const {id,share}=newestDeployments(value);
  need(UUID.test(previousDeployment||'')&&id!==previousDeployment,
    'deployment_not_new');
  need(share.size===2&&share.get(ACTIVE)===100&&share.get(NEW)===0,
    'unexpected_traffic_allocation');
  return Object.freeze({deployment_id:id,original_pct:100,
    metadata_pct:0});
}
export function certifyProbe({status,mime,body,versionHeader,redirect,
  cacheControl}={}){
  need(status===200&&mime==='application/json'&&
    body&&typeof body==='object'&&!Array.isArray(body)&&
    Object.keys(body).length===2&&
    body.ok===true&&body.environment==='WORK_CUSTOM_ORDERS_QA',
    'invalid_work_health_response');
  need(versionHeader===NEW,'candidate_version_not_proven');
  need(redirect===null,'unexpected_redirect');
  need(cacheControl==='no-store','health_cache_not_disabled');
  return Object.freeze({version_executed:NEW,anonymous_health_verified:true,
    original_traffic_unchanged_required:true,
    google_hmac_verified:false,customer_order_submitted:false});
}
export function certifyBaselineHealth({status,mime,body,versionHeader,
  redirect,cacheControl}={}){
  need(status===200&&mime==='application/json'&&
    body&&typeof body==='object'&&!Array.isArray(body)&&
    Object.keys(body).length===2&&
    body.ok===true&&body.environment==='WORK_CUSTOM_ORDERS_QA',
    'baseline_health_not_work');
  need(versionHeader===null&&redirect===null&&cacheControl==='no-store',
    'baseline_health_contract_changed');
  return true;
}
