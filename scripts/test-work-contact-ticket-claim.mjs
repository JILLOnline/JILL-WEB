import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {handleWorkContactTicketClaim}
 from '../backend/work-contact-ticket-claim.mjs';
import {handleCloudflareCustomOrderWork}
 from '../services/custom-order-cloudflare/handler.mjs';

const secret='shopify-work-test-secret-not-a-real-key-of-length-42';
const now=1791800000000;
const shop='jill-work.myshopify.com';
const A='gid://shopify/Customer/111',B='gid://shopify/Customer/222';
const ticket='jill:contact:11111111-2222-4333-8444-555555555555';
const claim=Buffer.alloc(32,7).toString('base64url');
const secretHash=createHash('sha256').update(
 'jill_work_contact_claim_v1\n'+claim).digest('hex');
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(customer=A){
 const t=Math.floor(now/1000);
 const payload={aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
 dest:shop,sub:customer,iat:t-60,nbf:t-60,exp:t+180,
 jti:'qa-contact-claim-session'};
 const part=enc({alg:'HS256',typ:'JWT'})+'.'+enc(payload);
 return part+'.'+createHmac('sha256',secret).update(part).digest('base64url');
}
const url='https://qa.workers.dev/jill-contact-claim';
const request=(user=A,data={ticket_id:ticket,claim_token:claim})=>
 new Request(url,{method:'POST',headers:{
  authorization:'Bearer '+token(user),
  'content-type':'application/json',
 },body:JSON.stringify(data)});
const row={owner_customer_gid:null,claim_sha256:secretHash,
 created_at_ms:now-1000};
let mutates=0,queries=0;
const db={prepare:sql=>{
 const update=sql.startsWith('UPDATE jill_work_contact_tickets');
 if(update)assert.match(sql,/owner_customer_gid IS NULL/);
 else assert.match(sql,/SELECT owner_customer_gid,claim_sha256/);
 return {bind:(...args)=>({
  async run(){
   assert.ok(update);
   mutates++;
   assert.equal(args[1],shop);
   assert.equal(args[2],ticket);
   assert.equal(args[3],secretHash);
   const good=args[3]===row.claim_sha256&&
     row.owner_customer_gid===null&&row.created_at_ms>=args[4];
   if(good)row.owner_customer_gid=args[0];
   return {success:true,meta:{changes:good?1:0}};
  },
  async first(){
   assert.equal(update,false);
   queries++;
   return {...row};
  },
 })};
}};
const opts={enabled:true,shopifyAppSecret:secret,db,now:()=>now,
 rateLimit:async()=>true};
const off=await handleWorkContactTicketClaim({
 ...opts,request:request(),enabled:false});
assert.equal(off.status,503);assert.equal(mutates,0);
const withoutJwt=await handleWorkContactTicketClaim({
 ...opts,request:new Request(url,{method:'POST',
 headers:{'content-type':'application/json'},
 body:JSON.stringify({ticket_id:ticket,claim_token:claim})})});
assert.equal(withoutJwt.status,401);assert.equal(mutates,0);
const malformed=await handleWorkContactTicketClaim({
 ...opts,request:request(A,{ticket_id:ticket,
 claim_token:claim,owner_customer_gid:B})});
assert.equal(malformed.status,400);assert.equal(mutates,0);
const wrongCode=await handleWorkContactTicketClaim({
 ...opts,request:request(A,{ticket_id:ticket,
 claim_token:Buffer.alloc(32,9).toString('base64url')})});
assert.equal(wrongCode.status,409);assert.equal(row.owner_customer_gid,null);
const first=await handleWorkContactTicketClaim({
 ...opts,request:request()});
assert.equal(first.status,200);
const result=await first.json();
assert.equal(result.code,'claimed');
assert.equal(result.ticket_id,ticket);
assert.equal(JSON.stringify(result).includes(claim),false);
assert.equal(row.owner_customer_gid,A);
const retry=await handleWorkContactTicketClaim({...opts,request:request()});
assert.equal(retry.status,200);
assert.equal((await retry.json()).code,'already_claimed');
const takeover=await handleWorkContactTicketClaim({
 ...opts,request:request(B)});
assert.equal(takeover.status,409);
assert.equal(row.owner_customer_gid,A);
const wrongClaim=await handleWorkContactTicketClaim({
 ...opts,request:request(A,{ticket_id:ticket,
 claim_token:Buffer.alloc(32,8).toString('base64url')})});
assert.equal(wrongClaim.status,409);
const oldRow={owner_customer_gid:null,claim_sha256:secretHash,
 created_at_ms:now-91*24*60*60*1000};
const expired=await handleWorkContactTicketClaim({...opts,request:request(),
 db:{prepare:()=>({bind:()=>({run:async()=>({success:true,meta:{changes:0}}),
 first:async()=>oldRow})})}});
assert.equal(expired.status,409);
assert.equal(row.owner_customer_gid,A);
const workerOff=await handleCloudflareCustomOrderWork(request(),{
 SHOPIFY_WORK_APP_SECRET:secret,JILL_ORDER_DESK_WORK_DB:db,
 RATE_LIMITER:{getByName:()=>({allow:async()=>true})},
});
assert.equal(workerOff.status,503);
assert.ok(mutates>=4&&queries>=4);
console.log('PASS WORK contact claim: exact JWT and 256-bit possession, atomic one-owner CAS, retry recovery, Customer B takeover denied, no secret leakage, default OFF.');
