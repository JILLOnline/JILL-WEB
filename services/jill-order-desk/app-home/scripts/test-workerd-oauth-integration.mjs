// Isolated pre-release smoke test of the actual bundled Cloudflare Worker.
// Runs under Cloudflare's local workerd test harness. Uses synthetic secrets
// and an in-memory local D1, never remote Shopify or Cloudflare data.
import assert from 'node:assert/strict';
import {createTestHarness} from 'wrangler';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

const url='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const cfg=resolve('dist/server/wrangler.oauth-canary.json');
assert.ok(existsSync(cfg),'build OAuth canary before running Worker smoke test');

const fakeSecret='SYNTHETIC_ONLY_SHOPIFY_SECRET_123456789_NOT_REAL';
const fakeKey=Buffer.alloc(32,64).toString('base64');
const server=createTestHarness({
  root:process.cwd(),
  workers:[{
    configPath:cfg,
    secrets:{
      SHOPIFY_API_SECRET:fakeSecret,
      JILL_WORK_SESSION_KEY_B64:fakeKey,
    },
  }],
});
try {
  await server.listen();
  const worker=server.getWorker('jill-order-desk-canary-work');
  const env=await worker.getEnv();
  const db=env.JILL_ORDER_DESK_WORK_DB;
  assert.ok(db?.prepare,'Local simulated D1 binding unavailable');
  for(const table of [
    'jill_merchant_audit','jill_merchant_authority',
    'jill_merchant_grants','jill_shopify_sessions',
  ]) {
    await db.prepare('CREATE TABLE IF NOT EXISTS '+table+
      ' (id INTEGER PRIMARY KEY)').run();
  }
  const health=await worker.fetch(url+'/healthz');
  assert.equal(health.status,200,'Local D1 schema must be healthy');
  const healthData=await health.json();
  assert.equal(healthData.database_ready,true);
  assert.equal(healthData.admin_ready,false);

  for(const path of ['/auth/login','/app','/app/setup-owner']) {
    // Anonymous request only; no shop/install query or session token.
    const response=await worker.fetch(url+path,{
      method:'GET',
      redirect:'manual',
    });
    const status=response.status;
    await response.arrayBuffer(); // Drain response without leaking HTML.
    assert.notEqual(status,500,
      path+' throws HTTP 500 in the real Cloudflare workerd runtime');
    assert.ok(status>=200 && status<500,
      path+' returned unexpected HTTP '+status);
    console.log('PASS local Cloudflare runtime '+path+' HTTP '+status);
  }
  // An untrusted shop parameter must never initiate another store's login.
  for(const [requestUrl,init] of [
    [url+'/auth/login?shop=jqtdgr-1y.myshopify.com',{
      method:'GET',redirect:'manual',
    }],
    [url+'/auth/login',{
      method:'POST',redirect:'manual',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'shop=jqtdgr-1y.myshopify.com',
    }],
  ]) {
    const blocked=await worker.fetch(requestUrl,init);
    assert.equal(blocked.status,403,'Foreign Shopify shop denied before SDK login');
    await blocked.arrayBuffer();
  }
  console.log('PASS canary login WORK-only shop isolation and SDK validation route.');
  console.log('PASS real compiled Cloudflare Shopify canary: anonymous auth routes do not crash; simulated D1 and secrets only.');
} catch(error) {
  // Only synthetic fixture values exist in this local worker. Avoid logging
  // requests, headers, response bodies, or any unexpected SDK token strings.
  const message=String(error?.message||'unknown')
    .replaceAll(fakeSecret,'[SYNTHETIC]')
    .replaceAll(fakeKey,'[SYNTHETIC]');
  console.error('WORK local Cloudflare OAuth smoke failed: '+message);
  for(const item of server.getLogs().slice(-8)) {
    if(item?.message) {
      console.error('Worker event: '+String(item.message)
        .replaceAll(fakeSecret,'[SYNTHETIC]')
        .replaceAll(fakeKey,'[SYNTHETIC]')
        .slice(0,400));
    }
  }
  process.exitCode=1;
} finally {
  await server.close();
}
