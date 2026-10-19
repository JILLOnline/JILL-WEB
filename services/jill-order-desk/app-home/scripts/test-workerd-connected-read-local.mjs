// Actual compiled candidate, synthetic keys and emulated D1 only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createTestHarness} from 'wrangler';
import {prepareConnectedManifest} from '../../../../scripts/stage-work-hq-connected-read-owner.mjs';
const origin='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const manifest=prepareConnectedManifest(JSON.parse(readFileSync('dist/server/wrangler.json','utf8')));
assert.equal(manifest.d1_databases.length,1);
assert.notEqual(manifest.d1_databases[0].remote,true);
manifest.d1_databases[0].remote=false;
const file=resolve('dist/server/wrangler.connected-local-'+randomUUID()+'.json');
let harness;
try{
  writeFileSync(file,JSON.stringify(manifest),{flag:'wx',mode:0o600});
  harness=createTestHarness({root:process.cwd(),workers:[{configPath:file,secrets:{
    SHOPIFY_API_SECRET:'SYNTHETIC_LOCAL_CONNECTED_SHOPIFY_SECRET_NOT_REAL',
    JILL_WORK_SESSION_KEY_B64:Buffer.alloc(32,19).toString('base64'),
    JILL_HQ_MERCHANT_READ_SECRET:'SYNTHETIC_LOCAL_CONNECTED_MERCHANT_READ_NOT_REAL',
    JILL_HQ_MERCHANT_WRITE_SECRET:'SYNTHETIC_LOCAL_CONNECTED_MERCHANT_WRITE_NOT_REAL',
  }}]});
  await harness.listen();
  const worker=harness.getWorker(manifest.name),env=await worker.getEnv();
  for(const name of ['jill_merchant_audit','jill_merchant_authority','jill_merchant_grants','jill_shopify_sessions'])
    await env.JILL_ORDER_DESK_WORK_DB.prepare('CREATE TABLE '+name+' (id INTEGER PRIMARY KEY)').run();
  const spoof='11111111-2222-4333-8444-555555555555';
  const health=await worker.fetch(origin+'/healthz?version='+spoof,{headers:{
    'X-JILL-WORK-HQ-Version':spoof,'Cloudflare-Workers-Version-Overrides':manifest.name+'="'+spoof+'"',
  }});
  assert.equal(health.status,200);
  // The harness getEnv() bridge emulates another isolate and generates a
  // distinct local metadata UUID. Never equate it to a deployed version ID.
  assert.notEqual(health.headers.get('x-jill-work-hq-version'),spoof);
  assert.match(health.headers.get('x-jill-work-hq-version'),/^[0-9a-f-]{36}$/);
  assert.match(health.headers.get('cache-control'),/no-store/);
  assert.deepEqual(await health.json(),{ok:true,environment:'JILL_ORDER_DESK_WORK',database_ready:true,admin_ready:false});
  for(const path of ['/app/access','/app/catalog']){
    const response=await worker.fetch(origin+path,{redirect:'manual',headers:{'User-Agent':'Mozilla/5.0'}});
    const body=await response.text();
    assert.ok([302,401,403,410].includes(response.status),path+' must deny anonymous access');
    assert.doesNotMatch(body,/verified_owner|shopify_scope_intersection|inventoryItems|inventoryLevels/);
  }
  const quote=await worker.fetch(origin+'/app/requests/quote-draft');
  assert.equal(quote.status,503);assert.equal((await quote.json()).error,'quote_drafts_not_enabled');
  const media=await worker.fetch(origin+'/app/requests/media/inspect');
  assert.equal(media.status,503);assert.equal((await media.json()).error,'private_media_not_enabled');
  const foreign=await worker.fetch('https://jillonlinestore.com/app/access',{redirect:'manual'});
  assert.equal(foreign.status,421);await foreign.arrayBuffer();
  assert.equal(env.JILL_WORK_CATALOG_ENABLED,'true');
  assert.equal(env.JILL_WORK_CONVERSATION_ENABLED,'false');
  console.log('PASS actual LOCAL compiled connected candidate: runtime identity health, anonymous Owner/catalog denial, foreign-host denial, quote/media OFF. No authenticated or remote acceptance claimed.');
}finally{
  if(harness)await harness.close();
  unlinkSync(file);
}
