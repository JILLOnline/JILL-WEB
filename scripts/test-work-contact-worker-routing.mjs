import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleCloudflareCustomOrderWork}
 from '../services/custom-order-cloudflare/handler.mjs';
import {handleWorkContactPrivateBridge}
 from '../services/jill-order-desk/work-contact-private-bridge.mjs';
import {readFileSync} from 'node:fs';

const secret='synthetic-work-app-secret-configuration-never-real';
const id='jill:contact:11111111-2222-4333-8444-555555555555';
const shop='jill-work.myshopify.com';
function signedUrl(path='/jill-custom-order-proxy/contact'){
 const p=new URLSearchParams({shop,timestamp:String(Math.floor(Date.now()/1000)),
  path_prefix:'/apps/jill-custom-order'});
 const canonical=[...p.entries()].map(([k,v])=>k+'='+v).sort().join('');
 p.set('signature',createHmac('sha256',secret).update(canonical).digest('hex'));
 return 'https://qa.workers.dev'+path+'?'+p.toString();
}
const payload={ticket_id:id,name:'QA',email:'qa@example.invalid',
 phone:'',reason:'product',message:'Interested in tote kits',
 preferred_contact:'Email',reviewed:true,details:{product_name:'Paint Tote'},
 claim_token:Buffer.alloc(32,7).toString('base64url')};
const request=(path,extraHeaders={})=>new Request(signedUrl(
 path??'/jill-custom-order-proxy/contact'),{
 method:'POST',headers:{'content-type':'application/json',
  origin:'https://jill-work.myshopify.com',...extraHeaders},
 body:JSON.stringify(payload),
});
let writes=0,rpcCalls=0,quotas=0;
const store=new Map();
const db={prepare:sql=>({bind:(...args)=>({
 async run(){
  assert.match(sql,/INSERT OR IGNORE INTO jill_work_contact_tickets/);
  writes++;
  const key=args[1];
  const exists=store.has(key);
  if(!exists)store.set(key,{source:'shopify_contact_bridge',
    body_sha256:args[2],claim_sha256:args[3],owner_customer_gid:null});
  return {success:true,meta:{changes:exists?0:1}};
 },
 async first(){
  assert.match(sql,/SELECT source,body_sha256/);
  return store.get(args[1])??null;
 },
})})};
let quotaAllowed=true;
const limiter={getByName:()=>({allow:async()=>{
 quotas++;return quotaAllowed;
}})};
const hq={SHOPIFY_API_SECRET:secret,JILL_ORDER_DESK_WORK_DB:db,
 JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'true',
 JILL_WORK_CONTACT_INTAKE_ENABLED:'true'};
const service={fetch:async r=>{
 rpcCalls++;
 assert.equal(r.headers.get('cookie'),null);
 assert.equal(r.headers.get('cf-connecting-ip'),null);
 assert.equal(r.headers.get('x-forwarded-for'),null);
 return handleWorkContactPrivateBridge({request:r,env:hq});
}};
const base={SHOPIFY_WORK_APP_SECRET:secret,RATE_LIMITER:limiter,
 JILL_WORK_HQ_CONTACT_PRIVATE:service};
const disabled=await handleCloudflareCustomOrderWork(request(),base);
assert.equal(disabled.status,503);
assert.equal(writes,0);assert.equal(rpcCalls,0);assert.equal(quotas,0);
const missingService=await handleCloudflareCustomOrderWork(request(),{
 SHOPIFY_WORK_APP_SECRET:secret,RATE_LIMITER:limiter,
 JILL_WORK_CONTACT_INTAKE_ENABLED:'true',
});
assert.equal(missingService.status,503);
assert.equal(writes,0);
const enabled={...base,JILL_WORK_CONTACT_INTAKE_ENABLED:'true'};
const hqOff={...hq,JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'false'};
assert.equal((await handleWorkContactPrivateBridge({
 request:request(),env:hqOff,
})).status,503);
assert.equal(writes,0);
const perRouteOff={...hq,JILL_WORK_CONTACT_INTAKE_ENABLED:'false'};
assert.equal((await handleWorkContactPrivateBridge({
 request:request(),env:perRouteOff,
})).status,503);
assert.equal(writes,0);
const noDb={...hq,JILL_ORDER_DESK_WORK_DB:undefined};
assert.equal((await handleWorkContactPrivateBridge({
 request:request(),env:noDb,
})).status,503);
assert.equal(writes,0);
quotaAllowed=false;
assert.equal((await handleCloudflareCustomOrderWork(request(),enabled)).status,429);
assert.equal(rpcCalls,0);assert.equal(writes,0);
quotaAllowed=true;
const created=await handleCloudflareCustomOrderWork(
 request(undefined,{'cookie':'fake=secret','cf-connecting-ip':'203.0.113.2',
  'x-forwarded-for':'198.51.100.4'}),enabled);
assert.equal(created.status,201);
const ack=await created.json();
assert.equal(ack.ticket_id,id);
assert.equal(ack.code,'received');
assert.equal(JSON.stringify(ack).includes('qa@example.invalid'),false);
assert.equal(store.size,1);assert.equal(rpcCalls,1);
const replay=await handleCloudflareCustomOrderWork(request(),enabled);
assert.equal(replay.status,200);
assert.equal((await replay.json()).code,'already_received');
assert.equal(store.size,1);
const wrongPath=await handleCloudflareCustomOrderWork(
 request('/jill-custom-order-proxy/contacts'),enabled);
assert.equal(wrongPath.status,404);
assert.equal(store.size,1);
const other=await handleWorkContactPrivateBridge({
 request:request('/private/unknown'),env:hq,
});
assert.equal(other.status,404);
// Never add a private database binding to the gateway. Only HQ may own it.
const publicManifest=readFileSync(
 'services/custom-order-cloudflare/wrangler.toml','utf8');
const candidate=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const worker=readFileSync(
 'services/jill-order-desk/app-home/workers/app.ts','utf8');
assert.doesNotMatch(publicManifest, /JILL_WORK_HQ_CONTACT_PRIVATE|\[\[services\]\]|JILL_ORDER_DESK_WORK_DB/);
assert.match(candidate,/binding = "JILL_WORK_HQ_CONTACT_PRIVATE"/);
assert.match(candidate,/service = "jill-order-desk-canary-work"/);
assert.match(candidate,/entrypoint = "JillContactPrivate"/);
assert.doesNotMatch(candidate,/\[\[d1_databases\]\]|JILL_ORDER_DESK_WORK_DB/);
assert.match(worker,/export class JillContactPrivate extends WorkerEntrypoint/);
assert.match(worker,/handleWorkContactPrivateBridge/);
console.log('PASS WORK Contact bridge: private named HQ service, two OFF flags, quota-before-RPC, signed Shopify intake, idempotency, no gateway D1, no cookie/IP leak or deploy.');
