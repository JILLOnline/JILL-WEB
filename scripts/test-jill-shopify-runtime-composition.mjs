import assert from 'node:assert/strict';
import {createConfiguredWorkShopifyHost} from
  '../services/jill-order-desk/shopify-host/work-shopify-runtime.mjs';

let captured=null;
const sdk=cfg=>{
  captured=cfg;
  return {authenticate:{admin:async()=>({})}};
};
const Session={fromPropertyArray:()=>null};
const db={
  prepare:()=>({bind:()=>({first:async()=>null})}),
  batch:async()=>[],
};
const env={
  JILL_ORDER_DESK_WORK_DB:db,
  JILL_WORK_HOST_STAGE:'work',
  SHOPIFY_API_SECRET:'SYNTHETIC_TEST_SHOPIFY_SECRET_DO_NOT_USE',
  JILL_WORK_SESSION_KEY_B64:Buffer.alloc(32,44).toString('base64'),
};
const instance=createConfiguredWorkShopifyHost({
  shopifyApp:sdk,Session,env,
  apiVersion:'2026-10',distribution:'single_merchant',
});
assert.equal(typeof instance.authenticate.admin,'function');
assert.equal(captured.useOnlineTokens,true);
assert.equal(captured.distribution,'single_merchant');
assert.equal(captured.sessionStorage.loadSession instanceof Function,true);
assert.equal(captured.sessionStorage.storeSession instanceof Function,true);
assert.equal(captured.sessionStorage.deleteSession instanceof Function,true);
assert.equal(captured.sessionStorage.deleteSessions instanceof Function,true);
assert.equal(captured.sessionStorage.findSessionsByShop instanceof Function,true);
assert.equal(captured.apiKey,'f8e1ebdbae84490dc8ea5b133637e6c0');
assert.equal(captured.appUrl,'https://jill-order-desk-work.jill-work-custom-orders.workers.dev');
assert.ok(!JSON.stringify(instance).includes('SYNTHETIC_TEST_SHOPIFY_SECRET'));
createConfiguredWorkShopifyHost({
  shopifyApp:sdk,Session,env:{...env,JILL_WORK_HOST_STAGE:'canary'},
  apiVersion:'2026-10',distribution:'single_merchant',
});
assert.equal(captured.appUrl,
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev');
for(const stage of ['LIVE','production','']) {
  assert.throws(()=>createConfiguredWorkShopifyHost({
    shopifyApp:sdk,Session,env:{...env,JILL_WORK_HOST_STAGE:stage},
    apiVersion:'2026-10',distribution:'single_merchant',
  }),/invalid_work_host_stage/);
}
for(const missing of [
 {},{...env,JILL_ORDER_DESK_WORK_DB:null},
 {...env,JILL_WORK_SESSION_KEY_B64:''},
 {...env,SHOPIFY_API_SECRET:''},
]) {
  assert.throws(()=>createConfiguredWorkShopifyHost({
    shopifyApp:sdk,Session,env:missing,
    apiVersion:'2026-10',distribution:'single_merchant',
  }));
}
assert.throws(()=>createConfiguredWorkShopifyHost({
  shopifyApp:sdk,Session:null,env,
  apiVersion:'2026-10',distribution:'single_merchant',
}),/missing_shopify_session_class/);
console.log('WORK Shopify runtime wiring uses separate encrypted D1 SDK storage and staff-scope online tokens, without opening any routes.');
