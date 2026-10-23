import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleCloudflareCustomOrderWork}
 from '../services/custom-order-cloudflare/handler.mjs';

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
const request=path=>new Request(signedUrl(path),{
 method:'POST',headers:{'content-type':'application/json',
 origin:'https://jill-work.myshopify.com'},
 body:JSON.stringify(payload),
});
let writes=0;
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
const limiter={getByName:()=>({allow:async()=>true})};
const base={SHOPIFY_WORK_APP_SECRET:secret,RATE_LIMITER:limiter,
 JILL_ORDER_DESK_WORK_DB:db};
const disabled=await handleCloudflareCustomOrderWork(request(),base);
assert.equal(disabled.status,503);
assert.equal(writes,0,'OFF must never write or read the contact DB');
const missingDb=await handleCloudflareCustomOrderWork(request(),{
 SHOPIFY_WORK_APP_SECRET:secret,RATE_LIMITER:limiter,
 JILL_WORK_CONTACT_INTAKE_ENABLED:'true'});
assert.equal(missingDb.status,503);
assert.equal(writes,0);
const enabled={...base,JILL_WORK_CONTACT_INTAKE_ENABLED:'true'};
const created=await handleCloudflareCustomOrderWork(request(),enabled);
assert.equal(created.status,201);
const ack=await created.json();
assert.equal(ack.ticket_id,id);
assert.equal(ack.code,'received');
assert.equal(JSON.stringify(ack).includes('qa@example.invalid'),false);
assert.equal(store.size,1);
const replay=await handleCloudflareCustomOrderWork(request(),enabled);
assert.equal(replay.status,200);
assert.equal((await replay.json()).code,'already_received');
assert.equal(store.size,1);
const wrongPath=await handleCloudflareCustomOrderWork(
 request('/jill-custom-order-proxy/contacts'),enabled);
assert.equal(wrongPath.status,404);
assert.equal(store.size,1);
console.log('PASS Cloudflare Contact Us route: hard OFF, exact app-proxy child path, signed WORK request, D1 idempotency; no credential or PII response.');
