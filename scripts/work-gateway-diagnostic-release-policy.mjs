// WORK gateway diagnostic: inactive version only. Pure policy; no network.
import {certifiedPromotion,CANDIDATE,ORIGINAL,WORKER,HOST}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {inspectGatewayCandidate}
  from './work-custom-order-gateway-inactive-repair-policy.mjs';
import {DEPLOYMENT}
  from './verify-work-gateway-synthetic-readiness.mjs';

export const SOURCE='4e1af98dd9643bda3742601f974d54d98f97b49f';
export const MARKER='JILL WORK gateway read-only diagnostic INACTIVE '+SOURCE;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const stop=code=>{throw Error('work_gateway_diagnostic_'+code);};
const check=(v,code)=>{if(!v)stop(code);};
export function baseline(deployments,active){
  const state=certifiedPromotion(deployments);
  check(state.new_deployment_id===DEPLOYMENT&&active===CANDIDATE,
    'active_deployment_changed');
  return state;
}
export function uploadArgs(){
  // --keep-vars inherits existing secrets; no file, secret value or
  // secret-put operation is ever supplied by this release.
  return Object.freeze(['versions','upload','--config','./wrangler.toml',
    '--name',WORKER,'--strict','--keep-vars','--message',MARKER]);
}
export function candidateIsLatest(versions){
  const arr=Array.isArray(versions)?versions:
    Array.isArray(versions?.versions)?versions.versions:
      Array.isArray(versions?.result)?versions.result:null;
  check(arr&&arr.length>0&&arr.length<=100,
    'version_list_invalid');
  const candidate=arr.find(x=>x.id===CANDIDATE);
  const when=Date.parse(candidate?.metadata?.created_on||'');
  check(Number.isFinite(when)&&arr.every(x=>
    Number.isFinite(Date.parse(x?.metadata?.created_on||'')))&&
    !arr.some(x=>x.id!==CANDIDATE&&
      Date.parse(x.metadata.created_on)>when),
    'candidate_not_latest');
  check(!arr.some(x=>x?.annotations?.['workers/message']===MARKER),
    'diagnostic_already_uploaded');
  return true;
}
export function inspectUploaded({versions,active,uploaded}={}){
  const arr=Array.isArray(versions)?versions:
    Array.isArray(versions?.versions)?versions.versions:
      Array.isArray(versions?.result)?versions.result:null;
  check(arr&&arr.length>=2&&arr.length<=100&&
    active?.id===CANDIDATE&&UUID.test(uploaded?.id||'')&&
    uploaded.id!==CANDIDATE&&uploaded.id!==ORIGINAL,
    'version_history_invalid');
  const found=arr.filter(x=>x?.annotations?.['workers/message']===MARKER);
  check(found.length===1&&found[0].id===uploaded.id&&
    uploaded?.annotations?.['workers/message']===MARKER,
    'diagnostic_version_unverified');
  const when=Date.parse(found[0]?.metadata?.created_on||'');
  check(Number.isFinite(when)&&!arr.some(x=>x.id!==uploaded.id&&
    Number.isFinite(Date.parse(x?.metadata?.created_on))&&
    Date.parse(x.metadata.created_on)>when),
    'newer_version_exists');
  inspectGatewayCandidate({active,candidate:uploaded});
  check(uploaded.resources.bindings.length===5&&
    uploaded.resources.bindings.some(x=>x.name==='CF_VERSION_METADATA'&&
      x.type==='version_metadata'),
    'diagnostic_binding_set_changed');
  return uploaded.id;
}
export function uploadedVersionUrl(output,id){
  check(typeof output==='string'&&output.length<20000&&UUID.test(id||''),
    'upload_output_invalid');
  const hostname=new URL(HOST).hostname;
  check(hostname.startsWith(WORKER+'.'),'work_host_invalid');
  const suffix=hostname.slice(WORKER.length+1);
  const matches=[...output.matchAll(/https:\/\/[^\s<>"']+/g)]
    .map(x=>x[0].replace(/[),.;]+$/,''));
  const valid=matches.filter(url=>{
    try{
      const target=new URL(url);
      const tag=target.hostname.slice(0,-('.'+suffix).length);
      const prefix=tag.slice(0,-('-'+WORKER).length);
      return target.protocol==='https:'&&target.hostname.endsWith('.'+suffix)&&
        tag.endsWith('-'+WORKER)&&prefix.length>=6&&id.startsWith(prefix)&&
        target.pathname==='/'&&!target.search&&!target.hash;
    }catch{return false;}
  });
  check(valid.length===1,'version_url_unavailable');
  return valid[0].replace(/\/$/,'');
}
export function versionUrlForId(id){
  check(UUID.test(id||''),'version_id_invalid');
  const origin=new URL(HOST);
  check(origin.protocol==='https:'&&origin.hostname.startsWith(WORKER+'.')&&
    origin.pathname==='/'&&origin.search==='',
    'work_host_invalid');
  return `https://${id.slice(0,8)}-${origin.hostname}`;
}
export function certifyVersionHealth({status,mime,body,versionHeader,
  cacheControl,redirect}={},id){
  check(UUID.test(id||'')&&status===200&&mime==='application/json'&&
    body&&Object.keys(body).length===2&&body.ok===true&&
    body.environment==='WORK_CUSTOM_ORDERS_QA'&&
    versionHeader===id&&cacheControl==='no-store'&&redirect===null,
    'version_url_identity_unverified');
  return true;
}
export function certifyProbe({status,body,cacheControl,redirect}={}){
  check(status===200&&cacheControl==='no-store'&&redirect===null&&
    body&&Object.keys(body).length===3&&body.ok===true&&
    body.code==='gateway_google_signature_verified'&&
    body.order_created===false,'connection_not_verified');
  return Object.freeze({google_signature_verified:true,
    customer_order_created:false,shopify_submission_tested:false});
}

// Separate reviewed release after the Owner's 2026-10-19 read-only inventory.
// The old upload/recovery/deployment receipts and their policies stay spent.
export const EMPTY_POST_BASELINE=Object.freeze({
  deployment:'3c025657-0c60-482d-bb41-4987d87bd848',
  diagnostic:'1201c7c0-9086-4d4e-89a6-3f2bc0a74c5f',
});
export const EMPTY_POST_MARKER='JILL WORK zero-byte diagnostic v1 b9f36124574463205b4b11d63a2d013f34c66686';
export function emptyPostBaseline(state){
  check(state?.deployment===EMPTY_POST_BASELINE.deployment&&
    state.versions?.length===2&&
    state.versions.some(v=>v.id===CANDIDATE&&v.percentage===100)&&
    state.versions.some(v=>v.id===EMPTY_POST_BASELINE.diagnostic&&v.percentage===0),
    'empty_post_baseline_changed');
  return state;
}
export function emptyPostVersion(versions){
  const arr=Array.isArray(versions)?versions:versions?.versions||versions?.result;
  check(Array.isArray(arr)&&arr.length>0&&arr.length<=100,'version_list_invalid');
  check(arr.every(v=>UUID.test(v?.id||'')&&
    Number.isFinite(Date.parse(v.metadata?.created_on))), 'version_list_invalid');
  const matches=arr.filter(v=>v.annotations?.['workers/message']===EMPTY_POST_MARKER);
  check(matches.length<=1,'empty_post_marker_not_unique');
  const latest=[...arr].sort((a,b)=>Date.parse(b.metadata.created_on)-Date.parse(a.metadata.created_on));
  check(latest.length===1||Date.parse(latest[0].metadata.created_on)>
    Date.parse(latest[1].metadata.created_on),'ambiguous_latest_version');
  if(!matches.length){
    check(latest[0].id===EMPTY_POST_BASELINE.diagnostic,'newer_version_exists');
    return null;
  }
  check(matches[0].id===latest[0].id&&
    ![CANDIDATE,ORIGINAL,EMPTY_POST_BASELINE.diagnostic].includes(matches[0].id),
    'empty_post_version_not_latest');
  return matches[0].id;
}
export function inspectEmptyPostVersion({versions,active,previous,uploaded}){
  check(previous?.id===EMPTY_POST_BASELINE.diagnostic&&
    previous.annotations?.['workers/message']===MARKER&&active?.id===CANDIDATE,
    'empty_post_prior_identity_changed');
  inspectGatewayCandidate({active,candidate:previous});
  inspectGatewayCandidate({active:previous,candidate:uploaded});
  check(active.resources.bindings.length===5&&
    active.resources.bindings.some(b=>b.name==='CF_VERSION_METADATA'&&b.type==='version_metadata')&&
    uploaded?.id===emptyPostVersion(versions)&&
    uploaded.annotations?.['workers/message']===EMPTY_POST_MARKER,
    'empty_post_bindings_or_marker_changed');
  return uploaded.id;
}
export function emptyPostAllocation(state,id){
  check(UUID.test(id||'')&&![CANDIDATE,ORIGINAL,EMPTY_POST_BASELINE.diagnostic].includes(id)&&
    UUID.test(state?.deployment||'')&&state.deployment!==EMPTY_POST_BASELINE.deployment&&
    state.versions?.length===2&&
    state.versions.some(v=>v.id===CANDIDATE&&v.percentage===100)&&
    state.versions.some(v=>v.id===id&&v.percentage===0),
    'empty_post_allocation_unverified');
  return state;
}
export function emptyPostUploadArgs(){
  return Object.freeze(['versions','upload','--config','./wrangler.toml',
    '--name',WORKER,'--strict','--keep-vars','--message',EMPTY_POST_MARKER]);
}
export function emptyPostDeployArgs(id){
  check(UUID.test(id||'')&&![CANDIDATE,ORIGINAL,EMPTY_POST_BASELINE.diagnostic].includes(id),
    'empty_post_id_invalid');
  return Object.freeze(['versions','deploy',CANDIDATE+'@100%',id+'@0%',
    '--name',WORKER,'--config','./wrangler.toml','--yes','--message',
    'JILL WORK zero-byte diagnostic v1 0pct; existing candidate remains 100pct']);
}
