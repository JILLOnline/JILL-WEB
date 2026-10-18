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
export function certifyProbe({status,body,cacheControl,redirect}={}){
  check(status===200&&cacheControl==='no-store'&&redirect===null&&
    body&&Object.keys(body).length===3&&body.ok===true&&
    body.code==='gateway_google_signature_verified'&&
    body.order_created===false,'connection_not_verified');
  return Object.freeze({google_signature_verified:true,
    customer_order_created:false,shopify_submission_tested:false});
}
