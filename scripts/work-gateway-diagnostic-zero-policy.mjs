// Pure policy for attaching the already uploaded diagnostic at 0%.
// The deployed WORK candidate stays at 100%; the old 0% version leaves
// the two-version deployment but remains in Cloudflare version history.
import {CANDIDATE,ORIGINAL,WORKER,HOST}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {baseline} from './work-gateway-diagnostic-release-policy.mjs';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const fail=code=>{throw Error('work_gateway_diagnostic_zero_'+code);};
const check=(value,code)=>{if(!value)fail(code);};
export const OVERRIDE_HEADER='Cloudflare-Workers-Version-Overrides';

export function deployArgs(id){
  check(UUID.test(id||'')&&id!==CANDIDATE&&id!==ORIGINAL,
    'version_id_invalid');
  return Object.freeze(['versions','deploy',CANDIDATE+'@100%',id+'@0%',
    '--name',WORKER,'--config','./wrangler.toml','--yes','--message',
    'JILL WORK signed connection diagnostic 0pct; active candidate remains 100pct']);
}
export function overrideValue(id){
  check(UUID.test(id||'')&&id!==CANDIDATE&&id!==ORIGINAL,
    'version_id_invalid');
  return WORKER+'="'+id+'"';
}
export function newAllocation(deployments,priorId,id){
  check(UUID.test(priorId||'')&&UUID.test(id||''),
    'deployment_id_invalid');
  const arr=Array.isArray(deployments)?deployments:
    Array.isArray(deployments?.deployments)?deployments.deployments:
      Array.isArray(deployments?.result?.deployments)?
        deployments.result.deployments:null;
  check(arr&&arr.length>=2&&arr.length<=30,'deployment_list_invalid');
  const sorted=arr.map(d=>{
    check(UUID.test(d?.id||'')&&Number.isFinite(Date.parse(d?.created_on||''))&&
      Array.isArray(d?.versions)&&d.versions.length>=1&&d.versions.length<=2,
      'deployment_shape_invalid');
    return {deployment:d,when:Date.parse(d.created_on)};
  }).sort((a,b)=>b.when-a.when);
  check(sorted[0].when>sorted[1].when&&sorted[0].deployment.id!==priorId,
    'deployment_not_new');
  const pairs=sorted[0].deployment.versions;
  check(pairs.length===2&&pairs.some(x=>x.version_id===CANDIDATE&&
    x.percentage===100)&&pairs.some(x=>x.version_id===id&&
    x.percentage===0),'unexpected_traffic_allocation');
  const previous=arr.find(d=>d.id===priorId);
  check(previous&&baseline([previous],CANDIDATE).new_deployment_id===priorId,
    'previous_deployment_changed');
  return sorted[0].deployment.id;
}
export function healthUrl(uuid){
  check(UUID.test(uuid||''),'probe_uuid_invalid');
  return HOST+'/healthz?jill_work_version_probe='+uuid;
}
