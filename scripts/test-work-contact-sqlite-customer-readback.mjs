// WORK Contact Owner -> claimed Customer A -> My JILL readback.
// Executes EXISTING merchant SQL against real disposable in-memory SQLite
// and the EXISTING Customer Account HMAC JWT verifier/server/client readers.
// Nothing is sent to Cloudflare, Shopify, WORK D1 or an actual customer.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {persistWorkContactMerchantMessage}
 from '../services/jill-order-desk/work-contact-message-write.mjs';
import {readWorkCustomerContactThread}
 from '../backend/work-contact-thread-read.mjs';
import {projectOwnedContactThread}
 from '../shared/customer-contact-thread.mjs';

const SHOP='jill-work.myshopify.com';
const WORK='https://work-hq.invalid';
const ACCOUNT='https://jill-qa.invalid';
const APP_SECRET='synthetic-contact-account-test-secret-not-real-provider';
const TICKET='jill:contact:11111111-2222-4333-8444-555555555555';
const GUEST='jill:contact:22222222-2222-4333-8444-666666666666';
const A='gid://shopify/Customer/111';
const B='gid://shopify/Customer/222';
const NOW=1792800012345;
const op=i=>'jill:work:contact:msg:00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(customer){
 const sec=Math.floor(NOW/1000);
 const unsigned=b64({alg:'HS256',typ:'JWT'})+'.'+b64({
  aud:'f8e1ebdbae84490dc8ea5b133637e6c0',dest:SHOP,
  sub:customer,iat:sec-60,nbf:sec-60,exp:sec+180,
  jti:'synthetic-claimed-contact-customer-proof',
 });
 return unsigned+'.'+createHmac('sha256',APP_SECRET)
  .update(unsigned).digest('base64url');
}
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`
 CREATE TABLE jill_work_contact_tickets(
   shop TEXT NOT NULL,ticket_id TEXT NOT NULL,
   owner_customer_gid TEXT,state TEXT NOT NULL,
   revision INTEGER NOT NULL,updated_at_ms INTEGER NOT NULL,
   PRIMARY KEY(shop,ticket_id)
 );
 CREATE TABLE jill_work_contact_messages(
   shop TEXT NOT NULL,ticket_id TEXT NOT NULL,
   sequence INTEGER NOT NULL,operation_id TEXT NOT NULL,
   actor_staff_id TEXT NOT NULL,body_text TEXT NOT NULL,
   body_sha256 TEXT NOT NULL,created_at_ms INTEGER NOT NULL,
   PRIMARY KEY(shop,ticket_id,sequence),
   UNIQUE(shop,operation_id)
 );
`);
sqlite.prepare('INSERT INTO jill_work_contact_tickets VALUES (?,?,?,?,?,?)')
 .run(SHOP,TICKET,null,'reviewing',2,NOW-1000);
sqlite.prepare('INSERT INTO jill_work_contact_tickets VALUES (?,?,?,?,?,?)')
 .run(SHOP,GUEST,null,'received',1,NOW-2000);
let queries=0,writes=0;
const db={
 prepare:sql=>({
  bind(...args){
   const bound={
    async first(){
     queries++;
     return sqlite.prepare(sql).get(...args)??null;
    },
    async all(){
     queries++;
     return {results:sqlite.prepare(sql).all(...args)};
    },
    async run(){
     writes++;
     const meta=sqlite.prepare(sql).run(...args);
     return {success:true,meta:{changes:meta.changes}};
    },
   };
   return bound;
  },
 }),
};
const accountReq=(gid=A,id=TICKET,signature=jwt(gid))=>new Request(
 ACCOUNT+'/jill-contact-thread',{method:'POST',
  headers:{'content-type':'application/json',
   authorization:'Bearer '+signature},
  body:JSON.stringify({ticket_id:id})});
const writeReq=(id=TICKET,operation=op(1),message='JILL received your request.')=>
 new Request(WORK+'/app/contacts/'+encodeURIComponent(id)+'/message',{
  method:'POST',headers:{origin:WORK,'content-type':'application/json'},
  body:JSON.stringify({ticket_id:id,operation_id:operation,message}),
 });
let owner=true;
const session={admin:async()=>({session:{
 shop:SHOP,isOnline:true,onlineAccessInfo:{associated_user:{
  id:123,account_owner:owner},associated_user_scope:'read_products'},
}})};
const authorize=async()=>({allowed:owner,role:owner?'owner':'viewer',staffId:'123'});
const save=(request,enabled=true)=>persistWorkContactMerchantMessage({
 request,enabled,expectedTicketId:TICKET,db,authenticate:session,
 authorize,now:()=>NOW,
});
const read=(gid=A,id=TICKET,enabled=true,token=jwt(gid))=>
 readWorkCustomerContactThread({request:accountReq(gid,id,token),
  enabled,db,shopifyAppSecret:APP_SECRET,now:()=>NOW,
  rateLimit:async()=>true});
const count=()=>sqlite.prepare(
 'SELECT count(*) AS count FROM jill_work_contact_messages').get().count;
try{
 // OFF means absolutely no Owner authorization or D1 traffic.
 let before={queries,writes};
 let response=await save(writeReq(),false);
 assert.equal(response.status,503);
 response=await read(A,TICKET,false);
 assert.equal(response.status,503);
 assert.deepEqual({queries,writes},before);

 // Guest cannot receive messages merely from form email or ticket ID.
 response=await save(writeReq(GUEST,op(5),'Guest-only message'));
 assert.equal(response.status,400,'Route-scoped ticket ID mismatch');
 response=await save(writeReq());
 assert.equal(response.status,409);
 assert.equal((await response.json()).code,'customer_account_unverified');
 assert.equal(count(),0);
 response=await read(A);
 assert.equal(response.status,404);

 // Only an independently verified claim may bind this ticket to Customer A.
 sqlite.prepare('UPDATE jill_work_contact_tickets SET owner_customer_gid=? WHERE shop=? AND ticket_id=?')
  .run(A,SHOP,TICKET);
 owner=false;
 before={queries,writes};
 response=await save(writeReq());
 assert.equal(response.status,403);
 assert.equal(count(),0);
 assert.deepEqual({queries,writes},before,
  'Denied merchant cannot read tickets or write messages');
 owner=true;
 response=await save(writeReq());
 assert.equal(response.status,200);
 let ack=await response.json();
 assert.equal(ack.code,'persisted_for_customer_account');
 assert.equal(ack.operation_id,op(1),'ACK tied to exact request operation');
 assert.equal(ack.sequence,1);
 assert.equal(count(),1);
 assert.equal(sqlite.prepare('SELECT actor_staff_id FROM jill_work_contact_messages').get().actor_staff_id,'123');

 // Existing persisted op is the idempotency key: no duplicate or phantom
 // sequence increment, and reusing it with other content is a conflict.
 response=await save(writeReq());
 assert.equal(response.status,200);
 assert.equal((await response.json()).code,'already_persisted');
 assert.equal(count(),1);
 response=await save(writeReq(TICKET,op(1),'A different text'));
 assert.equal(response.status,409);
 assert.equal(count(),1);
 response=await save(writeReq(TICKET,op(2),'Your order inquiry is in review.'));
 assert.equal(response.status,200);
 assert.equal((await response.json()).sequence,2);
 assert.equal(count(),2);

 // Exact Customer A token and claimed owner GID: only two public strings.
 response=await read(A);
 assert.equal(response.status,200);
 const raw=await response.json();
 assert.equal(raw.operation,'jill.contact.account.thread.result');
 assert.equal(raw.thread.messages.length,2);
 const visible=projectOwnedContactThread(raw,TICKET);
 assert.deepEqual(visible.messages.map(m=>m.text),[
  'JILL received your request.','Your order inquiry is in review.',
 ]);
 assert.equal(visible.messages[0].author,'jill');
 assert.equal(visible.reply_enabled,false);
 assert.equal(visible.read_receipt_available,false);
 assert.equal(JSON.stringify(raw).includes('actor_staff_id'),false);
 assert.equal(JSON.stringify(raw).includes('body_sha256'),false);
 assert.equal(JSON.stringify(raw).includes('owner_customer_gid'),false);
 assert.equal(JSON.stringify(raw).includes('operation_id'),false);
 assert.equal(JSON.stringify(raw).includes('jill:work:contact:msg'),false);
 assert.equal(JSON.stringify(raw).includes(A),false);

 // Exact same ID with Customer B or wrong authenticated guest claim is
 // indistinguishable from nonexistent ticket (never ownership info).
 response=await read(B);
 assert.equal(response.status,404);
 response=await read(A,GUEST);
 assert.equal(response.status,404);
 const forged=jwt(A).slice(0,-1)+(jwt(A).endsWith('A')?'B':'A');
 response=await read(A,TICKET,true,forged);
 assert.equal(response.status,401);
 response=await read(A,TICKET,true,'not-a-jwt');
 assert.equal(response.status,401);
 assert.equal(count(),2);

 // The Contact customer projection cannot be tricked into accepting
 // another ticket's matching sequence or invented read receipts.
 assert.throws(()=>projectOwnedContactThread(raw,GUEST),
  /contact_thread_unverified/);
 assert.throws(()=>projectOwnedContactThread({
  ...raw,thread:{...raw.thread,read_receipt_available:true},
 },TICKET),/contact_thread_unverified/);
 const changed=JSON.parse(JSON.stringify(raw));
 changed.thread.messages[1].sequence=3;
 assert.throws(()=>projectOwnedContactThread(changed,TICKET),
  /contact_thread_unverified/);

 // Merchant operation cannot be repurposed to write to a different
 // correctly-shaped Contact ticket, even if A owns it in the future.
 sqlite.prepare('UPDATE jill_work_contact_tickets SET owner_customer_gid=? WHERE shop=? AND ticket_id=?')
  .run(A,SHOP,GUEST);
 response=await save(writeReq(GUEST,op(1),'Wrong-ticket replay'));
 assert.equal(response.status,400);
 assert.equal(count(),2);
 console.log('PASS: Actual WORK Contact SQL -> verified A-only account JWT -> My JILL client thread; idempotent 2-message sequence, guest/B denial, forgery/receipt/tampering guards, OFF zero reads and writes. Disposable SQLite only.');
}finally{sqlite.close();}
