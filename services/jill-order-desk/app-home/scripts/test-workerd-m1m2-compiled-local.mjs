// JILL M1+M2 actual compiled Worker smoke — NOT a historical V4 repackage.
// Uses freshly built dist/server/wrangler.json, LOCAL fake D1, and synthetic
// requests ONLY. Never contacts Cloudflare, Shopify, Apps Script or real R2.
// Zero remote writes, billing changes, deployments, HTTP quote mutations.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createTestHarness} from 'wrangler';
const MANIFEST=resolve('dist/server/wrangler.json');
const manifest=JSON.parse(readFileSync(MANIFEST,'utf8'));
assert.equal(manifest.name,'jill-order-desk-work');
assert.ok(Array.isArray(manifest.d1_databases)&&manifest.d1_databases.length===1);
assert.ok(manifest.d1_databases.every(db=>db.remote!==true));
assert.equal(manifest.vars?.JILL_WORK_HOST_STAGE,'work');
assert.notEqual(manifest.vars?.JILL_WORK_OAUTH_ENABLED,'true');
for(const key of ['JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',
 'JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED',
 'JILL_WORK_CONVERSATION_ENABLED','JILL_WORK_HQ_INVOICE_ENABLED',
 'JILL_WORK_HQ_QUOTE_PUBLICATION_ENABLED']){
 assert.notEqual(manifest.vars[key],'true');
}
assert.equal(manifest.r2_buckets?.some(b=>b.remote===true)??false,false);
manifest.workers_dev=false;
manifest.d1_databases[0].remote=false;
const temp=resolve('dist/server/wrangler.m1m2-local-'+randomUUID()+'.json');
const ORIGIN='https://jill-order-desk-work.jill-work-custom-orders.workers.dev';
let harness;
try{
 writeFileSync(temp,JSON.stringify(manifest),{flag:'wx',mode:0o600});
 harness=createTestHarness({root:process.cwd(),workers:[{
   configPath:temp,secrets:{SHOPIFY_API_SECRET:'JILL_SYNTHETIC_LOCAL_NO_LIVE_KEY_123456789',
     JILL_WORK_SESSION_KEY_B64:Buffer.alloc(32,17).toString('base64')},
 }]});
 await harness.listen();
 const worker=harness.getWorker(manifest.name);
 const env=await worker.getEnv();
 // No real migrations: only minimum offline synthetic Worker health tables.
 for(const name of ['jill_merchant_audit','jill_merchant_authority',
   'jill_merchant_grants','jill_shopify_sessions']){
   await env.JILL_ORDER_DESK_WORK_DB.prepare(
     'CREATE TABLE '+name+' (id INTEGER PRIMARY KEY)').run();
 }
 const health=await worker.fetch(ORIGIN+'/healthz');
 assert.equal(health.status,200);
 const hb=await health.json();
 assert.equal(hb.ok,true);assert.equal(hb.database_ready,true);
 for(const endpoint of ['/app/requests/quote-draft','/app/requests/quote-catalog']){
   const response=await worker.fetch(ORIGIN+endpoint);
   assert.equal(response.status,503,endpoint);
   const body=await response.json();
   assert.match(body.error,endpoint.includes('quote-catalog')?
     /quote_catalog_not_enabled/:/quote_drafts_not_enabled/);
 }
 for(const endpoint of ['/app/queue','/app/requests','/app/messages',
    '/app/catalog','/app/access']){
   const r=await worker.fetch(ORIGIN+endpoint,{
     headers:{accept:'application/json'}});
   // No OAuth or forged Owner session: readable private data is impossible.
   assert.equal(r.status,503,endpoint);
   const body=await r.json();
   assert.equal(body.error,'shopify_auth_not_configured');
 }
 const foreign=await worker.fetch('https://foreign.example/app/queue');
 assert.equal(foreign.status,421);
 const forged=await worker.fetch(ORIGIN+'/app/requests/quote-draft',{
  method:'POST',headers:{origin:'https://evil.example'}});
 assert.equal(forged.status,403);
 console.log('PASS compiled M1/M2 LOCAL Worker health and D1, Queue/Requests deny OAuth, quote/catalog OFF, origin CSRF, wrong host. No remote calls/deploy.');
}finally{
 if(harness)await harness.close();
 try{unlinkSync(temp)}catch{}
}
