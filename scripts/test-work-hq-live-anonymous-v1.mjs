// Phase 28 offline adversarial checks against synthetic HTTP Responses.
// Never contacts WORK, Cloudflare, Shopify, Google, customer data or LIVE.
import assert from 'node:assert/strict';
import {
  WORK_HQ_CANARY_ORIGIN as ORIGIN,
  inspectWorkHqLiveAnonymous as inspect,
} from './inspect-work-hq-live-anonymous-v1.mjs';
const paths=['/healthz','/auth/login','/app/requests','/app/setup-owner'];
const headers={'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store, max-age=0'};
const response=(status,payload,extra={})=>new Response(
  typeof payload==='string'?payload:JSON.stringify(payload),
  {status,headers:{...headers,...extra}});
const health=response(200,{
  ok:true,environment:'JILL_ORDER_DESK_WORK',
  database_ready:true,admin_ready:false,
});
const locked=response(503,{
  ok:false,error:'shopify_auth_not_configured',
});
const login=response(200,'<html>WORK synthetic login</html>',{
  'content-type':'text/html; charset=utf-8'});
const denied=response(410,'<html>WORK synthetic denied</html>',{
  'content-type':'text/html; charset=utf-8'});
const redirect=response(302,'',{
  location:'https://admin.shopify.com/store/jill-work/apps/jill-hq',
});
function fake(items){
  let at=0;
  return async(url,init)=>{
    assert.equal(init.method,'GET');
    assert.equal(init.redirect,'manual');
    assert.equal(init.body,undefined);
    assert.equal(init.headers.accept,
      'application/json,text/html;q=0.2');
    assert.ok(init.signal);
    assert.equal(init.signal.aborted,false);
    assert.equal(url,ORIGIN+paths[at]);
    return items[at++];
  };
}
let checks=0;
async function success(items,state){
  const x=await inspect({request:fake(items),timeoutMs:15000});
  assert.equal(x.state,state);
  assert.equal(x.records.length,4);
  assert.equal(x.work_d1_healthy,true);
  for(const key of [
    'signed_in_owner_verified','deployed_version_verified',
    'google_qa_deployment_verified','hq_real_end_to_end_certified',
    'app_public_data_exposed','remote_deploy_authorized',
    'real_customers_accessed','mutations_performed',
    'paid_upgrade_authorized',
  ])assert.equal(x[key],false);
  assert.equal(Object.isFrozen(x),true);
  checks++;
}
async function reject(items,regex=/work_hq_live_boundary_/){
  await assert.rejects(()=>inspect({request:fake(items)}),regex);
  checks++;
}
await success([health,locked,locked,locked],'oauth_locked');
await success([health,login,denied,denied],
  'oauth_login_public_and_private_routes_denied');
await success([health,login,redirect,redirect],
  'oauth_login_public_and_private_routes_denied');
await success([health,login,
  response(403,'Forbidden'),response(401,'Unauthorized')],
  'oauth_login_public_and_private_routes_denied');
await reject([response(503,{ok:false,error:'merchant_storage_unavailable'}),
  locked,locked,locked]);
await reject([response(200,{ok:true,environment:'JILL_ORDER_DESK_WORK',
  database_ready:false,admin_ready:false}),locked,locked,locked]);
await reject([response(200,{ok:true,environment:'JILL_ORDER_DESK_WORK',
  database_ready:true,admin_ready:true}),locked,locked,locked]);
await reject([response(200,{ok:true,environment:'OTHER',
  database_ready:true,admin_ready:false}),locked,locked,locked]);
await reject([health,
  response(503,{ok:false,error:'shopify_auth_not_configured'},
    {'cache-control':'public, max-age=86400'}),locked,locked]);
await reject([health,response(503,{ok:false,error:'wrong_host'}),
  locked,locked]);
await reject([health,login,response(200,'<html>private dashboard</html>'),
  denied]);
await reject([health,login,denied,response(200,'owner setup public')]);
await reject([health,login,response(302,'',{
  location:'https://jillonlinestore.com/account'}),
  denied]);
await reject([health,login,response(302,'',{
  location:'https://admin.shopify.com/store/another-shop/apps'}),
  denied]);
await reject([health,login,response(302,'',{
  location:'https://evil.invalid/steal'}),
  denied]);
await reject([health,login,locked,locked]);
await reject([health,locked,denied,denied]);
await reject([health,response(500,'err'),denied,denied]);
await reject([health,login,response(302,'',{
  location:'javascript:alert(1)'}),denied]);
await reject([response(200,'{not json}',headers),locked,locked,locked]);
await assert.rejects(
  ()=>inspect({request:()=>{throw Error('network down');}}),
  /work_hq_live_boundary_request_unavailable/);checks++;
await assert.rejects(
  ()=>inspect({request:null}),
  /work_hq_live_boundary_invalid_config/);checks++;
for(const timeoutMs of [0,500,30001,NaN,-1]){
  await assert.rejects(()=>inspect({request:fake([
    health,locked,locked,locked]),timeoutMs}),
    /work_hq_live_boundary_invalid_config/);
  checks++;
}
console.log('PASS WORK Phase 28 OFFLINE anonymous canary boundary: '+
  checks+' cases, exact WORK origin, no public Owner/custom requests, '+
  'OAuth on/off distinguished; no actual provider calls or permissions.');
