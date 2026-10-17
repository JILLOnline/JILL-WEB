// Local compiled WORK Cloudflare harness — detail flag ON, NO real Owner.
// Proves anonymous requests fail closed even when the detail feature is ON.
// Uses simulated D1 and synthetic keys. No external Google/Shopify requests.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createTestHarness} from 'wrangler';

const cfg=resolve('dist/server/wrangler.hq-detail-v9-on-INACTIVE.json');
assert.ok(existsSync(cfg),'Build WORK ON candidate before local workerd test');
const origin='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const server=createTestHarness({
  root:process.cwd(),
  workers:[{
    configPath:cfg,
    secrets:{
      SHOPIFY_API_SECRET:'SYNTHETIC_SHOPIFY_FOR_LOCAL_TEST_ONLY_123456789',
      JILL_WORK_SESSION_KEY_B64:Buffer.alloc(32,73).toString('base64'),
      JILL_HQ_MERCHANT_READ_SECRET:'SYNTHETIC_GOOGLE_READ_ONLY_NEVER_REAL_123456789',
      JILL_HQ_MERCHANT_WRITE_SECRET:'SYNTHETIC_WRITE_ONLY_NEVER_REAL_123456789',
    },
  }],
});
try{
  await server.listen();
  const worker=server.getWorker('jill-order-desk-canary-work');
  const env=await worker.getEnv();
  assert.equal(env.JILL_WORK_HQ_DETAIL_ENABLED,'true');
  assert.equal(env.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
  assert.equal(env.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
  assert.equal(env.JILL_WORK_OAUTH_ENABLED,'true');
  const db=env.JILL_ORDER_DESK_WORK_DB;
  assert.ok(db?.prepare);
  for(const table of [
    'jill_merchant_audit','jill_merchant_authority',
    'jill_merchant_grants','jill_shopify_sessions',
  ])await db.prepare('CREATE TABLE IF NOT EXISTS '+table+
      ' (id INTEGER PRIMARY KEY)').run();
  assert.equal((await worker.fetch(origin+'/healthz')).status,200);
  for(const url of [
    origin+'/app/requests',
    origin+'/app/requests/jill%3Aqa%3Anonexistent123456',
    origin+'/app/requests/jill%3Aqa%3Anonexistent123456?refresh=1',
  ]){
    const reply=await worker.fetch(url,{redirect:'manual'});
    assert.ok([404,410].includes(reply.status),
      'Anonymous WORK request detail must not be rendered: '+reply.status);
    assert.notEqual(reply.headers.get('location')?.includes('script.google.com'),
      true);
    await reply.arrayBuffer();
  }
  const setup=await worker.fetch(origin+'/app/setup-owner',{
    redirect:'manual'});
  assert.equal(setup.status,410);
  const command=await worker.fetch(origin+'/app/requests/command',{
    method:'POST',headers:{
      'Content-Type':'application/x-www-form-urlencoded'},
    body:'probe=1',redirect:'manual',
  });
  assert.equal(command.status,403);
  assert.equal((await command.json()).error,'invalid_origin');
  console.log('PASS local Cloudflare WORK full-detail ON: anonymous inbox and exact-ID denied, Owner registration OFF, existing write Origin guard 403; synthetic-only D1/keys and no customer request reads.');
}catch(e){
  console.error('WORK detail ON simulated runtime DENIED: '+(
    ['ERR_ASSERTION','AssertionError'].includes(e?.name)?
      'anonymous_owner_boundary_failed':'local_workerd_test_failed'));
  process.exitCode=1;
}finally{await server.close();}
