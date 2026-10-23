import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {persistWorkContactMerchantMessage}
 from '../services/jill-order-desk/work-contact-message-write.mjs';
import {readWorkCustomerContactThread}
 from '../backend/work-contact-thread-read.mjs';
import {handleCloudflareCustomOrderWork}
 from '../services/custom-order-cloudflare/handler.mjs';

const SHOP='jill-work.myshopify.com';
const owner='gid://shopify/Customer/111',other='gid://shopify/Customer/222';
const secret='synthetic-work-shopify-app-secret-for-contact-thread';
const ticket='jill:contact:11111111-2222-4333-8444-555555555555';
const operation='jill:work:contact:msg:11111111-2222-4333-8444-555555555555';
const time=1792800001000;
const ticketRow={ticket_id:ticket,owner_customer_gid:owner,
 state:'reviewing',revision:2,updated_at_ms:time-1000};
const messages=[];
const db={prepare:sql=>({bind:(...args)=>({
 async first(){
  if(sql.startsWith('SELECT owner_customer_gid FROM')){
   assert.equal(args[0],SHOP);
   return ticketRow.owner_customer_gid?{owner_customer_gid:ticketRow.owner_customer_gid}:null;
  }
  if(sql.startsWith('SELECT sequence,operation_id')){
   const msg=messages.find(m=>m.operation_id===args[1]);
   return msg??null;
  }
  if(sql.startsWith('SELECT sequence FROM')){
   return messages.find(m=>m.operation_id===args[2]&&m.ticket_id===args[1])??null;
  }
  if(sql.startsWith('SELECT ticket_id,owner_customer_gid')){
   assert.equal(args[2]===owner||args[2]===other,true);
   return ticketRow.owner_customer_gid===args[2]?ticketRow:null;
  }
  throw Error('unknown read '+sql);
 },
 async run(){
  assert.match(sql,/INSERT OR IGNORE INTO jill_work_contact_messages/);
  assert.match(sql,/t.owner_customer_gid=\?/);
  assert.equal(args[0],SHOP);
  assert.equal(args[1],ticket);
  assert.equal(typeof args[6],'string');
  const existing=messages.find(m=>m.operation_id===args[4]);
  if(existing||ticketRow.owner_customer_gid!==args[11])
   return {success:true,meta:{changes:0}};
  messages.push({ticket_id:args[1],sequence:messages.length+1,
   operation_id:args[4],actor_staff_id:args[5],body_text:args[6],
   body_sha256:args[7],created_at_ms:args[8]});
  return {success:true,meta:{changes:1}};
 },
 async all(){
  assert.match(sql,/WHERE shop=\? AND ticket_id=\?/);
  assert.equal(args[0],SHOP);
  return {results:messages.map(m=>({
   sequence:m.sequence,body_text:m.body_text,created_at_ms:m.created_at_ms,
  }))};
 },
 })})};
const signedAdmin={admin:async()=>({session:{online:true}})};
const authorize=async({action})=>{
 assert.equal(action,'requests.write');
 return {allowed:true,role:'owner',staffId:'111'};
};
const post=(message='Hello from HQ',op=operation,id=ticket)=>
 new Request('https://hq.work.example.test/app/contacts/'+encodeURIComponent(id)+'/message',{
  method:'POST',
  headers:{'content-type':'application/json',
   origin:'https://hq.work.example.test'},
  body:JSON.stringify({ticket_id:id,operation_id:op,message}),
 });
const write=(request=post(),options={})=>persistWorkContactMerchantMessage({
 enabled:true,request,expectedTicketId:ticket,db,authenticate:signedAdmin,
 authorize,now:()=>time,...options,
});
const disabled=await persistWorkContactMerchantMessage({request:post(),db,
 authenticate:signedAdmin,authorize,now:()=>time});
assert.equal(disabled.status,503);
assert.equal(messages.length,0);
const blocked=await write(post(),{authorize:async()=>({allowed:false})});
assert.equal(blocked.status,403);assert.equal(messages.length,0);
ticketRow.owner_customer_gid=null;
const guest=await write(post());
assert.equal(guest.status,409);assert.equal(messages.length,0);
ticketRow.owner_customer_gid=owner;
const first=await write(post('111'));
assert.equal(first.status,200);
assert.equal((await first.json()).code,'persisted_for_customer_account');
assert.equal(messages.length,1);assert.equal(messages[0].body_text,'111');
const retry=await write(post('111'));
assert.equal(retry.status,200);
assert.equal((await retry.json()).code,'already_persisted');
assert.equal(messages.length,1);
const tampered=await write(post('changed'));
assert.equal(tampered.status,409);
const wrongId=await write(post('111',operation,
 'jill:contact:22222222-2222-4333-8444-555555555555'));
assert.equal(wrongId.status,400);
const extraField=new Request('https://hq.work.example.test/app/contacts',{
 method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({ticket_id:ticket,operation_id:operation,
 message:'111',email:'someone@example.invalid'}),
});
assert.equal((await write(extraField)).status,400);
assert.equal(messages.length,1);

const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const jwt=gid=>{
 const sec=Math.floor(time/1000);
 const p=b64({alg:'HS256',typ:'JWT'})+'.'+b64({
  aud:'f8e1ebdbae84490dc8ea5b133637e6c0',dest:SHOP,sub:gid,
  iat:sec-60,nbf:sec-60,exp:sec+180,jti:'contact-thread-test-jti'});
 return p+'.'+createHmac('sha256',secret).update(p).digest('base64url');
};
const accountReq=gid=>new Request('https://worker.work.example.test/jill-contact-thread',{
 method:'POST',headers:{authorization:'Bearer '+jwt(gid),
 'content-type':'application/json'},
 body:JSON.stringify({ticket_id:ticket}),
});
const read=(gid=owner,options={})=>readWorkCustomerContactThread({
 enabled:true,request:accountReq(gid),db,shopifyAppSecret:secret,
 now:()=>time,rateLimit:async()=>true,...options,
});
const accountOff=await readWorkCustomerContactThread({
 request:accountReq(owner),db,shopifyAppSecret:secret,
 rateLimit:async()=>true,
});
assert.equal(accountOff.status,503);
const customer=await read();
assert.equal(customer.status,200);
const publicData=await customer.json();
assert.equal(publicData.thread.messages.length,1);
assert.equal(publicData.thread.messages[0].message,'111');
assert.equal(publicData.thread.reply_enabled,false);
assert.equal(publicData.thread.read_receipt_available,false);
assert.doesNotMatch(JSON.stringify(publicData),
 /actor_staff_id|owner_customer_gid|operation_id|body_sha256|contact_json|email/);
const noAccess=await read(other);
assert.equal(noAccess.status,404);
ticketRow.owner_customer_gid=null;
assert.equal((await read(owner)).status,404);
const workerOff=await handleCloudflareCustomOrderWork(accountReq(owner),{
 SHOPIFY_WORK_APP_SECRET:secret,JILL_ORDER_DESK_WORK_DB:db,
 RATE_LIMITER:{getByName:()=>({allow:async()=>true})},
});
assert.equal(workerOff.status,503);
console.log('PASS Contact message bridge: hard OFF, Owner auth, claimed ticket only, idempotent merchant message, JWT Customer A thread, B/guest denied, no delivered/read claim.');
