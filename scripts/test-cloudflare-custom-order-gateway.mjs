import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {consumeQuota} from '../services/custom-order-cloudflare/limiter.mjs';
import {handleCloudflareCustomOrderWork} from '../services/custom-order-cloudflare/handler.mjs';

// Exercise the actual HTTP handler and a semantically equivalent SQL mock;
// the real Wrangler bundle also compiles the Durable Object class in CI.
class FakeSql {
  data=new Map();
  exec(statement,...args) {
    if(statement.startsWith('CREATE TABLE')||statement.startsWith('DELETE FROM')) {
      if(statement.startsWith('DELETE FROM')) {
        for(const k of this.data.keys())if(Number(k.split('|')[0])<args[0])this.data.delete(k);
      }
      return {one:()=>null};
    }
    if(statement.startsWith('INSERT INTO')) {
      const key=args.join('|');
      this.data.set(key,(this.data.get(key)||0)+1);
      return {one:()=>null};
    }
    if(statement.startsWith('SELECT hits')) {
      return {one:()=>({hits:this.data.get(args.join('|'))})};
    }
    throw Error('Unknown SQL');
  }
}
const sql=new FakeSql();
const x='a'.repeat(32),y='b'.repeat(32);
assert.equal(consumeQuota(sql,{bucket:123,client:x,shopLimit:3,clientLimit:2}),true);
assert.equal(consumeQuota(sql,{bucket:123,client:x,shopLimit:3,clientLimit:2}),true);
assert.equal(consumeQuota(sql,{bucket:123,client:x,shopLimit:3,clientLimit:2}),false);
assert.equal(consumeQuota(sql,{bucket:123,client:y,shopLimit:3,clientLimit:2}),false,
  'Global shop cap applies even when users change their IPs');
assert.equal(consumeQuota(sql,{bucket:124,client:x,shopLimit:3,clientLimit:2}),true);
assert.throws(()=>consumeQuota(sql,{bucket:125,client:'not-an-ip-hash'}),/Invalid WORK/);

const t=Date.now();
const shopifySecret='shopify-work-app-secret-qa-test-at-least-32-characters';
const googleSecret='google-different-work-qa-test-secret-at-least-32-characters';
const qaUrl='https://script.google.com/macros/s/AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V/exec';
const order='jill:12345678-abcd-4def-abcd-111111111111';
const raw={
  version:1,operation:'custom_order.submit',submission_id:order,
  submitted_at:'2026-10-12T15:00:00.000Z',
  customer:{email:'qa@example.invalid'},items:[{product_id:'1',quantity:1}],
};
function signedUrl() {
  const url=new URL('https://example.workers.dev/jill-custom-order-proxy');
  url.searchParams.set('shop','jill-work.myshopify.com');
  url.searchParams.set('timestamp',String(Math.floor(t/1000)));
  url.searchParams.set('path_prefix','/apps/jill-custom-order');
  url.searchParams.set('logged_in_customer_id','');
  const canonical=[...url.searchParams].map(([k,v])=>k+'='+v).sort().join('');
  url.searchParams.set('signature',createHmac('sha256',shopifySecret).update(canonical).digest('hex'));
  return url;
}
const body=new URLSearchParams({
  source:'JILL custom order',submission_id:order,submitted_at:raw.submitted_at,
  raw_payload:JSON.stringify(raw),email:raw.customer.email,
});
const stub={ping:async()=>true,allow:async()=>true};
const env={
  SHOPIFY_WORK_APP_SECRET:shopifySecret,
  JILL_CUSTOM_ORDER_GATEWAY_SECRET:googleSecret,
  JILL_CUSTOM_ORDER_QA_BACKEND_URL:qaUrl,
  RATE_LIMITER:{getByName:(name)=>{assert.equal(name,'jill-work-custom-orders-global');return stub;}},
};
function req(url=signedUrl(),payload=body) {
  return new Request(url,{method:'POST',body:payload,
    headers:{origin:'https://jill-work.myshopify.com','cf-connecting-ip':'203.0.113.7'}});
}
assert.equal((await handleCloudflareCustomOrderWork(new Request('https://example.workers.dev/healthz'),env)).status,200);
assert.equal((await handleCloudflareCustomOrderWork(new Request('https://example.workers.dev/healthz'),{
  ...env,RATE_LIMITER:{getByName:()=>({ping:async()=>{throw Error('down');}})},
})).status,503);
assert.equal((await handleCloudflareCustomOrderWork(
  new Request('https://example.workers.dev/other'),env)).status,404);
// Shopify app proxies append a trailing slash to their configured upstream
// path. This was previously a Worker-generated 404 even when the Shopify
// app version declared the correct proxy destination. A signed, deliberately
// invalid POST must get the SAME authenticated 400 on both root spellings.
const probe=new URLSearchParams({probe:'1'});
const directRoot=await handleCloudflareCustomOrderWork(req(signedUrl(),probe),env);
assert.equal(directRoot.status,400);
assert.equal((await directRoot.json()).error.code,'invalid_submission');
const slashUrl=signedUrl();
slashUrl.pathname='/jill-custom-order-proxy/';
const slashRoot=await handleCloudflareCustomOrderWork(req(slashUrl,probe),env);
assert.equal(slashRoot.status,400,
  'Shopify app-proxy trailing slash must be accepted and HMAC checked');
assert.equal((await slashRoot.json()).error.code,'invalid_submission');
const badChild=signedUrl();
badChild.pathname='/jill-custom-order-proxy/child';
assert.equal((await handleCloudflareCustomOrderWork(req(badChild,probe),env)).status,404,
  'Other child paths stay blocked');
const fakeSlash=signedUrl();
fakeSlash.pathname='/jill-custom-order-proxy-other';
assert.equal((await handleCloudflareCustomOrderWork(req(fakeSlash,probe),env)).status,404);
const slashGet=await handleCloudflareCustomOrderWork(new Request(slashUrl),env);
assert.equal(slashGet.status,404,'Gateway remains POST-only, even with a slash');
const slashForged=signedUrl();
slashForged.pathname='/jill-custom-order-proxy/';
slashForged.searchParams.set('signature','f'.repeat(64));
assert.equal((await handleCloudflareCustomOrderWork(req(slashForged,probe),env)).status,401,
  'Slash route must not bypass Shopify signature verification');
assert.equal((await handleCloudflareCustomOrderWork(req(),{
  ...env,SHOPIFY_WORK_APP_SECRET:'',
})).status,503);
const forged=signedUrl();
forged.searchParams.set('signature','f'.repeat(64));
assert.equal((await handleCloudflareCustomOrderWork(req(forged),env)).status,401);
assert.equal((await handleCloudflareCustomOrderWork(req(signedUrl(),new URLSearchParams({payload:'x'.repeat(300000)})),env)).status,413);
assert.equal((await handleCloudflareCustomOrderWork(req(),{
  ...env,RATE_LIMITER:{getByName:()=>({allow:async()=>false})},
})).status,429);
assert.equal((await handleCloudflareCustomOrderWork(req(),{
  ...env,RATE_LIMITER:{getByName:()=>({allow:async()=>{throw Error('storage down');}})},
})).status,503);
console.log('Cloudflare WORK proxy signed POST + Shopify root slash handling, SQL DO quotas, health, forged/child routes and fail-closed tests passed.');
