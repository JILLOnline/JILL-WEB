// Real compiled SDK + React Router + local D1; no authenticated customer data.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createTestHarness} from 'wrangler';
import {prepareConnectedManifest} from '../../../../scripts/stage-work-hq-connected-read-owner.mjs';
import {workAdminAppDestination} from '../../shopify-host/sdk-config.mjs';
const origin='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const manifest=prepareConnectedManifest(JSON.parse(readFileSync('dist/server/wrangler.json','utf8')));
manifest.d1_databases[0].remote=false;
const file=resolve('dist/server/wrangler.navigation-local-'+randomUUID()+'.json');
const ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
let harness;
try{
 writeFileSync(file,JSON.stringify(manifest),{flag:'wx',mode:0o600});
 harness=createTestHarness({root:process.cwd(),workers:[{configPath:file,secrets:{
  SHOPIFY_API_SECRET:'SYNTHETIC_LOCAL_NAVIGATION_SHOPIFY_SECRET_NOT_REAL',
  JILL_WORK_SESSION_KEY_B64:Buffer.alloc(32,19).toString('base64'),
 }}]});
 await harness.listen();const worker=harness.getWorker(manifest.name),env=await worker.getEnv();
 for(const table of ['jill_merchant_audit','jill_merchant_authority','jill_merchant_grants','jill_shopify_sessions'])
  await env.JILL_ORDER_DESK_WORK_DB.prepare('CREATE TABLE '+table+' (id INTEGER PRIMARY KEY)').run();
 for(const path of ['/app','/app/requests','/app/requests/synthetic-request-id','/app/catalog','/app/access']){
  const document=await worker.fetch(origin+path+'?id_token=SYNTHETIC_NOT_VALID&shop=evil.example&return_to=https://evil.example',{redirect:'manual',headers:{'user-agent':ua,'sec-fetch-dest':'document'}});
  assert.equal(document.status,302);assert.equal(document.headers.get('location'),workAdminAppDestination(path));
  assert.match(document.headers.get('cache-control'),/no-store/);assert.equal(await document.text(),'');
 }
 // Real SDK bootstrap from parallel parent + inbox loaders must survive
 // React Router's independent response consumption for documents AND data.
 for(const path of ['/app/requests','/app/requests.data']){
  const response=await worker.fetch(origin+path,{redirect:'manual',headers:{'user-agent':ua,'sec-fetch-dest':path.endsWith('.data')?'empty':'iframe'}});
  const body=await response.text();assert.equal(response.status,200);
  assert.match(body,/app-bridge\.js/);assert.doesNotMatch(body,/Unexpected Server Error|Body.*used|<h1>200 OK/);
  assert.doesNotMatch(body,/submission_id|customer.email|verified_owner/);
 }
 const signedQuery='?shop=jill-work.myshopify.com&host=YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvamlsbC13b3Jr&embedded=1';
 const bounce=await worker.fetch(origin+'/app/requests'+signedQuery,{redirect:'manual',headers:{'user-agent':ua,'sec-fetch-dest':'iframe'}});
 assert.equal(bounce.status,302);assert.match(bounce.headers.get('location'),/^\/auth\/session-token\?/);await bounce.arrayBuffer();
 const denied=await worker.fetch(origin+'/app/requests.data',{headers:{'user-agent':ua,authorization:'Bearer invalid-synthetic-token'}});
 assert.ok([401,403].includes(denied.status));assert.doesNotMatch(await denied.text(),/submission_id|verified_owner/);
 console.log('PASS compiled WORK navigation: new-tab WORK Admin re-entry with no forwarded query/tokens, iframe and data bootstrap bodies preserved, SDK bounce retained, invalid token denied. Synthetic local only; no platform Owner acceptance.');
}finally{if(harness)await harness.close();unlinkSync(file);}
