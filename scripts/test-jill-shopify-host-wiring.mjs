import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createWorkShopifyHost,JILL_WORK_APP_HOME_ORIGIN,
} from '../services/jill-order-desk/shopify-host/sdk-config.mjs';
import {loadWorkShopifyAdminRoute} from
  '../services/jill-order-desk/shopify-host/app-home-route.mjs';
import {
  JILL_WORK_MERCHANT_CLIENT_ID,JILL_WORK_MERCHANT_SHOP,
} from '../backend/jill-merchant-auth.mjs';

// A trusted Shopify SDK adapter is mandatory: these mocks verify wiring
// only and do NOT simulate cryptographic proof of Shopify authorization.
const sessionStorage={
  async storeSession(){return true;},
  async loadSession(){return undefined;},
  async deleteSession(){return true;},
};
const secret='TEST_ONLY_NOT_A_REAL_SHOPIFY_SECRET_123456';
let config;
const shopifyApp=cfg=>{
  config=cfg;
  return {authenticate:{admin:async()=>({})}};
};
const client=createWorkShopifyHost({
  shopifyApp,apiVersion:'2026-10',distribution:'app_store',
  sessionStorage,apiSecretKey:secret,appUrl:JILL_WORK_APP_HOME_ORIGIN,
});
assert.equal(typeof client.authenticate.admin,'function');
assert.equal(config.apiKey,JILL_WORK_MERCHANT_CLIENT_ID);
assert.equal(config.apiSecretKey,secret);
assert.equal(config.appUrl,JILL_WORK_APP_HOME_ORIGIN);
assert.equal(config.apiVersion,'2026-10');
assert.equal(config.useOnlineTokens,true);
assert.equal(config.authPathPrefix,'/auth');
assert.deepEqual(config.future,{expiringOfflineAccessTokens:true});
assert.equal(config.sessionStorage,sessionStorage);
assert.equal(config.scopes,undefined,'No Shopify scope changes during host preparation');

for(const extra of [
  {shop:'jqtdgr-1y.myshopify.com'},
  {appUrl:'https://jillonlinestore.com'},
  {appUrl:'http://localhost:3000'},
  {apiSecretKey:'weak'},
  {sessionStorage:null},
  {apiVersion:undefined},
]) {
  assert.throws(()=>createWorkShopifyHost({
    shopifyApp,apiVersion:'2026-10',distribution:'app_store',
    sessionStorage,apiSecretKey:secret,appUrl:JILL_WORK_APP_HOME_ORIGIN,
    ...extra,
  }),/work_host_configuration_incomplete/);
}
assert.throws(()=>createWorkShopifyHost({
  shopifyApp:()=>({}),apiVersion:'2026-10',distribution:'app_store',
  sessionStorage,apiSecretKey:secret,appUrl:JILL_WORK_APP_HOME_ORIGIN,
}),/shopify_sdk_authenticate_admin_missing/);

const request=new Request(JILL_WORK_APP_HOME_ORIGIN+'/app');
const ownerSession={
  shop:JILL_WORK_MERCHANT_SHOP,isOnline:true,
  expires:new Date(Date.now()+120000),
  onlineAccessInfo:{
    associated_user:{id:321,account_owner:true},
    associated_user_scope:'read_orders,write_orders',
  },
};
const authority={
  shop:JILL_WORK_MERCHANT_SHOP,environment:'WORK',
  app_client_id:JILL_WORK_MERCHANT_CLIENT_ID,
  owner_staff_id:'321',policy_version:1,
};
function mockDb(ready=true) {
  return {prepare(sql) {
    assert.match(sql,/^SELECT /);
    return {bind(){
      return {async first(){
        if(!ready)throw Error('DB unavailable');
        if(sql.includes('jill_merchant_authority'))return authority;
        return null;
      }};
    }};
  }};
}
let authCount=0;
const authenticate={admin:async arg=>{
  authCount++;
  assert.equal(arg,request);
  return {session:ownerSession};
}};
let response=await loadWorkShopifyAdminRoute({
  request,authenticate,env:{JILL_ORDER_DESK_WORK_DB:mockDb()},
});
assert.equal(response.status,200);
assert.match(response.headers.get('cache-control'),/no-store/);
let data=await response.json();
assert.equal(data.state,'staff_verified');
assert.equal(data.role,'owner');
assert.equal(data.teamManagementEnabled,false);
assert.equal(data.invoicingEnabled,false);
assert.equal(data.requestsConnected,false);
assert.equal(authCount,1);
assert.doesNotMatch(JSON.stringify(data),/321|owner_staff_id|token/i);

response=await loadWorkShopifyAdminRoute({request,authenticate,env:{}});
assert.equal(response.status,503);
assert.equal((await response.json()).state,'merchant_setup_required');
assert.equal(authCount,2,'Always validate Shopify auth before checking D1 health');

const wrongShop={admin:async()=>({
  session:{...ownerSession,shop:'jqtdgr-1y.myshopify.com'},
})};
response=await loadWorkShopifyAdminRoute({
  request,authenticate:wrongShop,env:{JILL_ORDER_DESK_WORK_DB:mockDb()},
});
assert.equal(response.status,401);
const failedAuthResponse=new Response(null,{status:302,
  headers:{location:'/auth/login'}});
await assert.rejects(()=>loadWorkShopifyAdminRoute({
  request,authenticate:{admin:async()=>{throw failedAuthResponse;}},
  env:{JILL_ORDER_DESK_WORK_DB:mockDb()},
}),error=>error===failedAuthResponse,
  'Preserve official Shopify authentication challenge/redirect');

const source=readFileSync('services/jill-order-desk/shopify-host/sdk-config.mjs','utf8');
assert.doesNotMatch(source,/fetch\(|discountCodeBasicCreate|draftOrderCreate|customer_list/);
console.log('WORK Shopify SDK App Home integration: pinned shop/origin, online staff scopes, authenticated read-only route and fail-closed D1 tests passed.');
