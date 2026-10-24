// Exact WORK Contact reply gateway -> private HQ -> disposable SQLite.
// Runs the REAL 0004+0005 migration and handlers. NO provider credentials,
// Cloudflare writes, customer data, Shopify API, deployment, or traffic.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {loadOwnedContactConversationV2,postOwnedContactReply}
 from '../shared/customer-contact-conversation-v2.mjs';
import {handleCloudflareCustomOrderWork}
 from '../services/custom-order-cloudflare/handler.mjs';
import {handleWorkContactPrivateBridge}
 from '../services/jill-order-desk/work-contact-private-bridge.mjs';

const DB=new DatabaseSync(':memory:');
DB.exec('PRAGMA foreign_keys=ON');
DB.exec(readFileSync(
 'services/jill-order-desk/migrations/0004_work_contact_tickets_source_only.sql','utf8'));
DB.exec(readFileSync(
 'services/jill-order-desk/migrations/0005_work_contact_customer_replies_source_only.sql','utf8'));
const SHOP='jill-work.myshopify.com';
const SECRET='synthetic-customer-reply-hmac-secret-not-a-real-secret';
const A='gid://shopify/Customer/111';
const B='gid://shopify/Customer/222';
const T='jill:contact:11111111-2222-4333-8444-555555555555';
const OTHER='jill:contact:22222222-2222-4333-8444-555555555555';
const NOW=1792860012345;
const OP=n=>'jill:customer:contact:reply:00000000-0000-4000-8000-'+
 String(n).padStart(12,'0');
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const jwt=gid=>{
 const now=Math.floor(NOW/1000);
 const unsigned=b64({alg:'HS256',typ:'JWT'})+'.'+b64({
  aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
  dest:SHOP,sub:gid,iat:now-60,nbf:now-60,exp:now+180,
  jti:'synthetic-jill-contact-reply-test-jwt',
 });
 return unsigned+'.'+createHmac('sha256',SECRET)
  .update(unsigned).digest('base64url');
};
const ticketInsert=DB.prepare(
 'INSERT INTO jill_work_contact_tickets '+
 '(shop,ticket_id,source,body_sha256,claim_sha256,contact_json,'+
 'state,revision,created_at_ms,updated_at_ms,owner_customer_gid) '+
 'VALUES (?,?,?,?,?,?,?,?,?,?,?)'
);
for(const [id,owner] of [[T,A],[OTHER,B]]){
 ticketInsert.run(SHOP,id,'shopify_contact_bridge','a'.repeat(64),
  'b'.repeat(64),JSON.stringify({
   ticket_id:id,reason:'custom',reviewed:true,
   name:'Synthetic',email:'hidden@example.invalid',
   phone:'',message:'My question',
  }), 'reviewing',1,NOW-1000,NOW-1000,owner);
}
let queries=0,writes=0,rate=0,rpc=0;
let quota=true;
const db={prepare:sql=>({bind:(...params)=>({
 async first(){queries++;return DB.prepare(sql).get(...params)??null;},
 async all(){queries++;return {results:DB.prepare(sql).all(...params)};},
 async run(){writes++;const x=DB.prepare(sql).run(...params);
  return {success:true,meta:{changes:x.changes}};},
})})};
const Hq={
 SHOPIFY_API_SECRET:SECRET,
 JILL_ORDER_DESK_WORK_DB:db,
 JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'true',
 JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED:'true',
 JILL_WORK_CONTACT_THREAD_ENABLED:'true',
};
const service={fetch:async request=>{
 rpc++;
 assert.equal(request.headers.has('cookie'),false);
 assert.equal(request.headers.has('cf-connecting-ip'),false);
 return handleWorkContactPrivateBridge({request,env:Hq,now:()=>NOW});
}};
const Gateway={
 JILL_WORK_HQ_CONTACT_PRIVATE:service,
 SHOPIFY_WORK_APP_SECRET:SECRET,
 JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED:'true',
 JILL_WORK_CONTACT_THREAD_ENABLED:'true',
 RATE_LIMITER:{getByName:()=>({
  allow:async()=>{rate++;return quota},
 })},
};
const path='https://jill-gateway.invalid/jill-contact-reply';
const make=(gid=A,id=T,op=OP(1),text='Can we use purple?',expected=0,
 options={})=>new Request(path,{
 method:'POST',
 headers:{
  'content-type':'application/json',
  ...(gid?{'authorization':'Bearer '+jwt(gid)}:{}),
  cookie:'never-forward-this-cookie',
  'cf-connecting-ip':'192.0.2.5',
 },
 body:JSON.stringify({
  ticket_id:id,operation_id:op,
  expected_reply_sequence:expected,message:text,
  ...(options.extra??{}),
 }),
});
const act=(request,env=Gateway)=>handleCloudflareCustomOrderWork(request,env);
const n=()=>DB.prepare('SELECT count(*) AS n FROM jill_work_contact_customer_replies').get().n;
const sessionToken={get:async()=>jwt(A)};
const appRequest=(url,options)=>act(new Request(url,options));
try{
 let resp=await act(make(),{...Gateway,
  JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED:'false'});
 assert.equal(resp.status,503);
 assert.equal(rate,0);assert.equal(rpc,0);
 assert.equal(writes,0);assert.equal(queries,0);
 resp=await act(make(),{...Gateway,
  JILL_WORK_HQ_CONTACT_PRIVATE:{fetch:async req=>
   handleWorkContactPrivateBridge({request:req,env:{
    ...Hq,JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED:'false',
   },now:()=>NOW})}});
 assert.equal(resp.status,503);assert.equal(n(),0);
 resp=await act(make(null));
 assert.equal(resp.status,401);assert.equal(n(),0);
 resp=await act(make(B));
 assert.equal(resp.status,404);assert.equal(n(),0);
 resp=await act(make(B,OTHER,OP(10)));
 assert.equal(resp.status,200);
 assert.equal((await resp.json()).code,'reply_saved');
 assert.equal(n(),1);
 // B's own ticket reply must never authorize Customer A's ticket.
 resp=await act(make(A,T,OP(1)));
 assert.equal(resp.status,200);
 let saved=await resp.json();
 assert.equal(saved.code,'reply_saved');
 assert.equal(saved.operation_id,OP(1));
 assert.equal(saved.sequence,1);
 assert.equal(n(),2);
 // replay: identical operation and expected sequence is idempotent.
 resp=await act(make(A,T,OP(1)));
 assert.equal(resp.status,200);
 assert.equal((await resp.json()).code,'already_persisted');
 assert.equal(n(),2);
 resp=await act(make(A,T,OP(1),'New forged message'));
 assert.equal(resp.status,409);
 resp=await act(make(A,T,OP(2),'Stale two-tab write',0));
 assert.equal(resp.status,409);
 assert.equal(n(),2);
 resp=await act(make(A,T,OP(2),'Please add a name',1));
 assert.equal(resp.status,200);
 assert.equal((await resp.json()).sequence,2);
 assert.equal(n(),3);
 resp=await act(make(A,T,OP(2),'Please add a name',1));
 assert.equal(resp.status,200);
 assert.equal((await resp.json()).code,'already_persisted');
 // Operation cannot be moved from one ticket to another (even if owner
 // later changes). Never accept raw account/owner hints in payload.
 resp=await act(make(A,OTHER,OP(1),'Can I move my message?',0));
 assert.equal(resp.status,404);
 resp=await act(make(A,T,OP(3),'Hi',2,{extra:{customer_gid:A}}));
 assert.equal(resp.status,400);
 resp=await act(make(A,T,OP(3),' Hi ',2));
 assert.equal(resp.status,400);
 assert.equal(n(),3);
 // Merchant-only v1 remains immutable; V2 merges it with verified
 // customer replies without exposing staff/Customer GID or receipt hashes.
 DB.prepare('INSERT INTO jill_work_contact_messages '+
  '(shop,ticket_id,sequence,operation_id,actor_staff_id,body_text,'+
  'body_sha256,created_at_ms) VALUES (?,?,?,?,?,?,?,?)')
  .run(SHOP,T,1,
   'jill:work:contact:msg:33333333-2222-4333-8444-555555555555',
   '111','JILL confirms your theme.','c'.repeat(64),NOW-100);
 const v2=await loadOwnedContactConversationV2({
  enabled:true,sessionToken,request:appRequest,ticketId:T,
 });
 assert.equal(v2.state,'ready');
 assert.equal(v2.reply_enabled,true);
 assert.equal(v2.next_customer_reply_sequence,2);
 assert.deepEqual(v2.messages.map(m=>m.author),['jill','customer','customer']);
 assert.deepEqual(v2.messages.map(m=>m.text),[
  'JILL confirms your theme.','Can we use purple?','Please add a name',
 ]);
 assert.equal(v2.read_receipt_available,false);
 assert.equal(v2.delivery_verified,false);
 assert.equal(v2.unread_count,null);
 assert.equal(JSON.stringify(v2).includes(A),false);
 assert.equal(JSON.stringify(v2).includes('actor_staff_id'),false);
 assert.equal(JSON.stringify(v2).includes('operation_id'),false);
 const off=await loadOwnedContactConversationV2({
  enabled:false,sessionToken:{get:()=>{throw Error('no token while OFF')}},
  request:()=>{throw Error('no network while OFF')},ticketId:T,
 });
 assert.equal(off.state,'not_connected');
 await assert.rejects(loadOwnedContactConversationV2({
  enabled:true,sessionToken:{get:async()=>jwt(B)},
  request:appRequest,ticketId:T,
 }),/contact_conversation_v2_unverified/);
 const replyResult=await postOwnedContactReply({
  enabled:true,sessionToken,request:appRequest,
  ticketId:T,operationId:OP(3),
  expectedReplySequence:2,message:'Great, thanks!',
 });
 assert.equal(replyResult.state,'persisted_unconfirmed_readback');
 assert.equal(replyResult.read,false);
 assert.equal(replyResult.delivered,false);
 assert.equal(n(),4);
 const confirmed=await loadOwnedContactConversationV2({
  enabled:true,sessionToken,request:appRequest,ticketId:T,
 });
 assert.equal(confirmed.messages.at(-1).text,'Great, thanks!');
 assert.equal(confirmed.next_customer_reply_sequence,3);
 assert.equal(confirmed.messages.at(-1).author,'customer');
 const wrongJwt=jwt(A).slice(0,-1)+(jwt(A).endsWith('A')?'B':'A');
 resp=await act(new Request(path,{method:'POST',headers:{
  authorization:'Bearer '+wrongJwt,'content-type':'application/json',
 },body:JSON.stringify({ticket_id:T,operation_id:OP(4),
  expected_reply_sequence:2,message:'Forged token'})}));
 assert.equal(resp.status,401);
 quota=false;const prev={rpc,writes,queries};
 resp=await act(make(A,T,OP(4),'Limited',2));
 assert.equal(resp.status,429);
 assert.deepEqual({rpc,writes,queries},prev);
 quota=true;
 DB.prepare('UPDATE jill_work_contact_tickets SET state=?,revision=revision+1,'+
  'updated_at_ms=?,status_actor_staff_id=?,last_status_operation_id=? '+
  'WHERE shop=? AND ticket_id=? AND revision=? AND state=?')
  .run('resolved',NOW+10,'111',
  'jill:work:contact:status:11111111-2222-4333-8444-555555555555',
  SHOP,T,1,'reviewing');
 resp=await act(make(A,T,OP(4),'Closed should not accept',2));
 assert.equal(resp.status,409);
 assert.equal(n(),3);
 // Database-level immutability guard, regardless of application access.
 assert.throws(()=>DB.prepare(
  'UPDATE jill_work_contact_customer_replies SET body_text=? WHERE shop=? AND ticket_id=?'
 ).run('tamper',SHOP,T));
 assert.throws(()=>DB.prepare(
  'DELETE FROM jill_work_contact_customer_replies WHERE shop=? AND ticket_id=?'
 ).run(SHOP,T));
 // Wrong customer cannot directly forge row even if buggy app tries.
 assert.throws(()=>DB.prepare(
  'INSERT INTO jill_work_contact_customer_replies '+
  '(shop,ticket_id,reply_sequence,operation_id,actor_customer_gid,'+
  'body_text,body_sha256,created_at_ms) VALUES (?,?,?,?,?,?,?,?)'
 ).run(SHOP,T,3,OP(6),B,'forged','c'.repeat(64),NOW));
 assert.equal(n(),4);
 console.log('PASS WORK Contact customer reply: real 0004+0005 SQLite schema, dual OFF switches, private bounded gateway, signed Customer A/B isolation, exact CAS, replay, forged JWT, quota, closed ticket, immutability, no remote D1.');
}finally{DB.close();}
