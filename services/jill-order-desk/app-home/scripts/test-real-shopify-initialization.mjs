// Actual installed SDK initialization smoke test.
// Synthetic credentials only; no network, Shopify authorization, or D1 writes.
// This closes the gap between mocked SDK config tests and real Cloudflare
// runtime before another WORK canary OAuth attempt.
import assert from 'node:assert/strict';
import '@shopify/shopify-app-react-router/adapters/node';
import {shopifyApp,AppDistribution,ApiVersion} from '@shopify/shopify-app-react-router/server';
import {Session} from '@shopify/shopify-api';
import {createConfiguredWorkShopifyHost} from '../../shopify-host/work-shopify-runtime.mjs';

const stage='canary';
const fakeD1={
  prepare(sql) {
    assert.match(sql,/^(SELECT |INSERT |DELETE )/);
    return {bind(){return {
      async first(){return undefined;},
      async all(){return {results:[]};},
      async run(){return {success:true};},
    }}};
  },
  async batch(statements){return [];},
};
const env={
  JILL_ORDER_DESK_WORK_DB:fakeD1,
  JILL_WORK_HOST_STAGE:stage,
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  SHOPIFY_API_SECRET:'SYNTHETIC_SHOPIFY_SECRET_NOT_REAL_abcdefghijklmnopqrstuvwxyz',
  JILL_WORK_SESSION_KEY_B64:Buffer.alloc(32,71).toString('base64'),
};
const sdk=createConfiguredWorkShopifyHost({
  shopifyApp,Session,env,
  apiVersion:ApiVersion.July26,
  distribution:AppDistribution.SingleMerchant,
});
assert.equal(typeof sdk.authenticate.admin,'function');
assert.equal(typeof sdk.sessionStorage.storeSession,'function');
assert.equal(typeof sdk.sessionStorage.loadSession,'function');
assert.equal(typeof sdk.login,'function');
assert.equal(typeof sdk.addDocumentResponseHeaders,'function');
assert.ok(!JSON.stringify(sdk).includes(env.SHOPIFY_API_SECRET));
console.log('PASS real Shopify React Router SDK initialized for WORK canary with synthetic credentials, online-session D1 and no actual Shopify requests.');
