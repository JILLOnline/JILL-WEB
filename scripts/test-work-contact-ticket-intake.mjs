import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleWorkContactTicketIntake}
 from '../backend/work-contact-ticket-intake.mjs';

const secret='synthetic-shopify-work-app-proxy-secret-never-real';
const time=1792760400000,shop='jill-work.myshopify.com';
const id='jill:contact:11111111-2222-4333-8444-555555555555';
const body={ticket_id:id,name:'Customer QA',email:'qa@example.invalid',
 phone:'',reason:'custom',message:'Please contact me about a quote',
 preferred_contact:'Email',reviewed:true,
 claim_token:Buffer.alloc(32,7).toString('base64url')};
const signedUrl=({shopName=shop,loggedIn='',badSignature=false}={})=>{
 const p=new URLSearchParams({
  shop:shopName,timestamp:String(Math.floor(time/1000)),
  path_prefix:'/apps/jill-custom-order',
 });
 if(loggedIn)p.set('logged_in_customer_id',loggedIn);
 const parts=new Map();
 for(const [name,value] of p){
  if(!parts.has(name))parts.set(name,[]);
  parts.get(name).push(value);
 }
 const canonical=[...parts].map(([key,values])=>key+'='+values.join(','))
  .sort().join('');
 p.set('signature',badSignature?'a'.repeat(64):
  createHmac('sha256',secret).update(canonical).digest('hex'));
 return 'https://jill-work.myshopify.com/apps/jill-custom-order?'+p;
};
const request=(record=body,options={})=>new Request(signedUrl(options),{
 method:'POST',headers:{'Content-Type':'application/json',
  origin:'https://jill-work.myshopify.com'},
 body:JSON.stringify(record),
});
const saved=new Map();let reads=0,writes=0,quota=0;
const db={prepare:sql=>({bind:(...args)=>({
 async run(){
  assert.match(sql,/INSERT OR IGNORE/);
  writes++;
  const key=args[0]+':'+args[1];
  const before=saved.has(key);
  if(!before)saved.set(key,{source:'shopify_contact_bridge',
   body_sha256:args[2],claim_sha256:args[3],
   owner_customer_gid:null,state:'received',private_body:args[4]});
  return {success:true,meta:{changes:before?0:1}};
 },
 async first(){
  assert.match(sql,/SELECT source/);
  reads++;
  return saved.get(args[0]+':'+args[1])??null;
 },
 })})};
const opts={enabled:true,shopifyAppSecret:secret,db,
 rateLimit:async({shop:accepted})=>{quota++;return accepted===shop;},
 now:()=>time};
const closed=await handleWorkContactTicketIntake({request:request(),
 ...opts,enabled:false});
assert.equal(closed.status,503);
assert.equal(writes,0);assert.equal(quota,0);
const invalid=await handleWorkContactTicketIntake({
 ...opts,request:request(body,{badSignature:true})});
assert.equal(invalid.status,401);assert.equal(writes,0);
const first=await handleWorkContactTicketIntake({
 ...opts,request:request(body,{loggedIn:'123456'})});
assert.equal(first.status,201);
const firstJson=await first.json();
assert.equal(firstJson.ticket_id,id);
assert.equal(firstJson.code,'received');
assert.equal(JSON.stringify(firstJson).includes('qa@example.invalid'),false);
assert.equal(saved.get(shop+':'+id).owner_customer_gid,null,
 'Shopify app proxy logged-in hint is NOT verified Customer Account ownership');
assert.match(saved.get(shop+':'+id).private_body,/qa@example.invalid/);
assert.equal(saved.get(shop+':'+id).private_body.includes(body.claim_token),false);
assert.match(saved.get(shop+':'+id).claim_sha256,/^[a-f0-9]{64}$/);
const storedFirst=JSON.parse(saved.get(shop+':'+id).private_body);
assert.deepEqual(Object.keys(storedFirst.details),[
 'order_number','product_name','business_name',
 'business_link','website_area','device','reference_images',
],'all optional Contact Us source fields have a deterministic shape');
const repeat=await handleWorkContactTicketIntake({...opts,request:request()});
assert.equal(repeat.status,200);
assert.equal((await repeat.json()).code,'already_received');
assert.equal(saved.size,1);
const wrongClaim=await handleWorkContactTicketIntake({
 ...opts,request:request({...body,
   claim_token:Buffer.alloc(32,8).toString('base64url')})});
assert.equal(wrongClaim.status,409,'a replaced claim proof must not replay a ticket');
const conflict=await handleWorkContactTicketIntake({
 ...opts,request:request({...body,message:'A changed message'})});
assert.equal(conflict.status,409);
assert.equal(saved.size,1,'same id with changed body cannot overwrite stored ticket');
for(const altered of [
 {...body,ticket_id:'bad'},
 {...body,reason:'unknown'},
 {...body,reviewed:false},
 {...body,message:'x'.repeat(3001)},
 {...body,preferred_contact:'Phone',phone:''},
 {...body,owner_customer_gid:'gid://shopify/Customer/123'},
 {...body,claim_token:'weak'},
]){
 const result=await handleWorkContactTicketIntake({...opts,request:request(altered)});
 assert.equal(result.status,400);
}
const existing={...body,reason:'existing',ticket_id:
 'jill:contact:33333333-2222-4333-8444-555555555555'};
assert.equal((await handleWorkContactTicketIntake({
 ...opts,request:request(existing)})).status,400,
 'existing order inquiries require an order reference');
const withDetails={...existing,details:{order_number:'JILL-123',
 reference_images:'Yes'}};
assert.equal((await handleWorkContactTicketIntake({
 ...opts,request:request(withDetails)})).status,201);
assert.equal(JSON.parse(saved.get(shop+':'+existing.ticket_id).private_body)
 .details.order_number,'JILL-123');
const denied=await handleWorkContactTicketIntake({
 ...opts,rateLimit:async()=>false,request:request({...body,ticket_id:
 'jill:contact:22222222-2222-4333-8444-555555555555'})});
assert.equal(denied.status,429);
assert.equal(saved.size,2);
const foreign=await handleWorkContactTicketIntake({
 ...opts,request:request(body,{shopName:'foreign.myshopify.com'})});
assert.equal(foreign.status,401);
assert.equal(saved.size,2);
assert.equal(reads,5,'changed claim token must produce one extra integrity read');
console.log('PASS WORK Contact Us signed source: default OFF, app-proxy HMAC, quota, bounded input, idempotent D1, no Customer autoclaim, no private receipt.');
