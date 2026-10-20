import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  JILL_WORK_APP_HOME_ORIGIN,JILL_WORK_CANARY_APP_HOME_ORIGIN,
  workAppHomeOrigin,createWorkShopifyHost,
} from '../services/jill-order-desk/shopify-host/sdk-config.mjs';

const base=JSON.parse(readFileSync(
  'services/jill-order-desk/app-home/wrangler.jsonc','utf8'));
const canary=JSON.parse(readFileSync(
  'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
assert.equal(base.name,'jill-order-desk-work');
assert.equal(canary.name,'jill-order-desk-canary-work');
assert.notEqual(base.name,canary.name);
assert.equal(base.vars.JILL_WORK_HOST_STAGE,'work');
assert.equal(canary.vars.JILL_WORK_HOST_STAGE,'canary');
assert.equal(base.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
assert.equal(canary.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
assert.equal(canary.vars.JILL_WORK_OAUTH_ENABLED,'false');
assert.equal(base.vars.JILL_WORK_OAUTH_ENABLED,'false');
assert.equal(canary.d1_databases[0].database_id,base.d1_databases[0].database_id);
assert.equal(canary.d1_databases[0].database_name,'jill-order-desk-work');
assert.deepEqual(canary.d1_databases.map(x=>x.binding),['JILL_ORDER_DESK_WORK_DB']);
assert.deepEqual(canary.compatibility_flags,['nodejs_compat']);
assert.equal(workAppHomeOrigin('work'),JILL_WORK_APP_HOME_ORIGIN);
assert.equal(workAppHomeOrigin('canary'),JILL_WORK_CANARY_APP_HOME_ORIGIN);
assert.throws(()=>workAppHomeOrigin('LIVE'),/invalid_work_host_stage/);
assert.throws(()=>workAppHomeOrigin(undefined),/invalid_work_host_stage/);
const auth={authenticate:{admin:async()=>({})}};
const fakeShopify=()=>auth;
const sessionStorage={
  storeSession:async()=>true,loadSession:async()=>null,
  deleteSession:async()=>true,
};
const common={
  shopifyApp:fakeShopify,apiVersion:'2026-10',
  distribution:'single_merchant',sessionStorage,
  apiSecretKey:'SYNTHETIC_SECRET_FOR_TEST_ONLY_123456',
};
assert.equal(createWorkShopifyHost({...common,stage:'canary',
  appUrl:JILL_WORK_CANARY_APP_HOME_ORIGIN}),auth);
for(const [stage,appUrl] of [
  ['canary',JILL_WORK_APP_HOME_ORIGIN],
  ['work',JILL_WORK_CANARY_APP_HOME_ORIGIN],
  ['LIVE',JILL_WORK_CANARY_APP_HOME_ORIGIN],
]){
  assert.throws(()=>createWorkShopifyHost({...common,stage,appUrl}),
    /work_host_configuration_incomplete|invalid_work_host_stage/);
}
const script=readFileSync('services/jill-order-desk/app-home/workers/app.ts','utf8');
assert.match(script,/workAppHomeOrigin\(env\.JILL_WORK_HOST_STAGE\)/);
assert.match(script,/shopify_auth_not_configured/);
assert.match(script,/env\.JILL_WORK_OAUTH_ENABLED!=="true"/);
assert.match(script,/jill_shopify_sessions/);
assert.match(script,/wrong_host/);
assert.match(script,/admin_ready:false/);
const main=readFileSync('services/jill-order-desk/worker.mjs','utf8');
assert.match(main,/merchant_host_not_configured/);
assert.doesNotMatch(main,/authenticate\.admin/);
const vite=readFileSync('services/jill-order-desk/app-home/vite.config.ts','utf8');
assert.match(vite,/wrangler\.canary\.jsonc/);
assert.match(vite,/JILL_BUILD_TARGET/);
console.log('WORK isolated Shopify App Home canary: separate Worker identity, hostname pinning, D1-only sharing, secret gate and disabled owner mutations passed.');
