// JILL WORK Custom Orders: exact 100% ORIGINAL / 0% REPAIR policy.
// This module has no cloud, filesystem or customer interactions.
export const WORKER='jill-work-custom-orders-qa';
export const OLD='408bdf7c-eb20-4b6e-97dd-3d3b293c6120';
export const NEW='225cdbb4-46f5-492e-801d-6726bea2703e';
export const UPLOAD_SOURCE='2263c1ecf131127961ebc2612274ebb830caceee';
// Derived from the already known WORK account workers.dev subdomain.
// Must pass a live anonymous health preflight BEFORE any deployment.
// This value is not taken as proof of correct routing by itself.
export const HOST='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev';
export const MESSAGE='JILL WORK gateway 0pct verified HMAC candidate QA only';
export const HEADER='Cloudflare-Workers-Version-Overrides';
const GUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const fail=x=>{throw Error('gateway_zero_policy_'+x);};
const ok=(t,x)=>{if(!t)fail(x);};
export function deploymentArgs(mode='zero'){
  ok(['zero','restore'].includes(mode),'mode_invalid');
  const vs=mode==='zero'?[OLD+'@100%',NEW+'@0%']:[OLD+'@100%'];
  return Object.freeze(['versions','deploy',...vs,'--name',WORKER,
    '--config','./wrangler.toml','--yes','--message',
    mode==='zero'?MESSAGE:'JILL WORK gateway restore original 100pct']);
}
export function deploymentState(value){
  const entries=Array.isArray(value)?value:
    Array.isArray(value?.deployments)?value.deployments:
    Array.isArray(value?.result?.deployments)?value.result.deployments:null;
  ok(entries&&entries.length>0&&entries.length<=30,'deployments_unverified');
  const normalized=entries.map(d=>{
    ok(GUID.test(d?.id||'')&&Number.isFinite(Date.parse(d.created_on||''))&&
      Array.isArray(d.versions)&&d.versions.length>=1&&
      d.versions.length<=2,'deployment_shape_unverified');
    const share=new Map();
    for(const v of d.versions){
      ok(GUID.test(v?.version_id||'')&&
        Number.isFinite(v.percentage)&&
        v.percentage>=0&&v.percentage<=100&&
        !share.has(v.version_id),'shares_unverified');
      share.set(v.version_id,v.percentage);
    }
    ok([...share.values()].reduce((a,b)=>a+b,0)===100,
      'shares_not_100_percent');
    return {id:d.id,time:Date.parse(d.created_on),share};
  }).sort((a,b)=>b.time-a.time);
  ok(normalized.length===1||normalized[0].time>normalized[1].time,
    'latest_deployment_ambiguous');
  const last=normalized[0],r=last.share;
  const baseline=r.size===1&&r.get(OLD)===100;
  const zero=r.size===2&&r.get(OLD)===100&&r.get(NEW)===0;
  const onlyPinned=[...r.keys()].every(k=>k===OLD||k===NEW);
  return Object.freeze({id:last.id,
    state:baseline?'baseline':zero?'zero':'unexpected',
    oldPct:r.get(OLD)??null,newPct:r.get(NEW)??null,
    onlyPinned,canRestore:baseline||zero});
}
export function checkAllocation(value,expected){
  const state=deploymentState(value);
  ok(expected==='baseline'||expected==='zero',
    'expected_state_invalid');
  ok(state.state===expected,'unexpected_traffic_allocation');
  return state;
}
export function versionOverride(id=NEW){
  ok(id===OLD||id===NEW,'version_not_pinned');
  return WORKER+'="'+id+'"';
}
export function interpretSmoke({regular,pinned,account,baseline,after}={}){
  ok(baseline?.state==='zero'&&after?.state==='zero'&&
     baseline.id===after.id&&after.oldPct===100&&after.newPct===0,
    'allocation_changed_during_smoke');
  for(const health of [regular,pinned]){
    ok(health?.status===200&&health.mime==='application/json'&&
      health.body?.ok===true&&
      health.body?.environment==='WORK_CUSTOM_ORDERS_QA'&&
      Object.keys(health.body).length===2,
      'work_health_failed');
  }
  ok(account?.status===401&&account.mime==='application/json'&&
    account.body?.ok===false&&
    account.body?.operation==='custom_order.account.list.result'&&
    account.body?.error?.code==='unauthenticated_account'&&
    account.body?.version===1&&
    Object.keys(account.body).length===4,
    'ownerless_account_read_not_denied');
  return Object.freeze({allocation_100_0:true,
    regular_health_good:true,pinned_health_good:true,
    account_denial_verified:true,
    // NO version metadata binding: identical code cannot prove override
    pinned_execution_proven:false,google_signature_verified:false,
    customer_submission_performed:false,paid_resources_enabled:false});
}
