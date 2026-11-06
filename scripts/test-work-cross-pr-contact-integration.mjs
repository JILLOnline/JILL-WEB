// Offline integration smoke: My JILL PR client modules -> HQ PR WORK handlers.
// TWO REAL SOURCE TREES, synthetic Shopify JWT and in-memory D1. No network,
// database migrations, Google/Shopify/Cloudflare credentials or deployments.
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fileURLToPath} from 'node:url';
import {loadWorkCustomerContactTickets}
 from '../shared/customer-contact-tickets.mjs';
import {claimWorkCustomerContactTicket}
 from '../shared/customer-contact-claim.mjs';
import {loadOwnedContactThread}
 from '../shared/customer-contact-thread.mjs';

const hq=path.resolve(process.env.JILL_HQ_SOURCE_DIR||'hq-work-source');
const needed=['backend/work-contact-account-read.mjs',
 'backend/work-contact-ticket-claim.mjs','backend/work-contact-thread-read.mjs',
 'services/jill-order-desk/work-contact-message-write.mjs'];
for(const name of needed)
 assert.ok(existsSync(path.join(hq,name)),'Missing actual HQ PR source: '+name);
const importHq=async relative=>
 import(pathToFileURL(path.join(hq,relative)).href);
const {handleWorkContactAccountRead}=await importHq(needed[0]);
const {handleWorkContactTicketClaim}=await importHq(needed[1]);
const {readWorkCustomerContactThread}=await importHq(needed[2]);
const {persistWorkContactMerchantMessage}=await importHq(needed[3]);

const now=1792800001000;
const shop='jill-work.myshopify.com';
const secret='offline-shopify-work-signing-key-synthetic-only-2026';
const A='gid://shopify/Customer/111',B='gid://shopify/Customer/222';
const id='jill:contact:11111111-2222-4333-8444-555555555555';
const code=Buffer.alloc(32,7).toString('base64url');
const claimHash=createHash('sha256').update(
 'jill_work_contact_claim_v1\n'+code,'utf8').digest('hex');
const row={ticket_id:id,owner_customer_gid:null,claim_sha256:claimHash,
 state:'reviewing',revision:2,reason:'custom',
 created_at_ms:now-60000,updated_at_ms:now-3000};
const messages=[];
const stats={queries:0,updates:0,requests:0,tokenReads:0};
const db={prepare(sql){
 stats.queries++;
 return {bind(...args){
  return {
   async run(){
    stats.updates++;
    if(sql.startsWith('UPDATE jill_work_contact_tickets SET owner_customer_gid')){
     const good=args[1]===shop&&args[2]===id&&
      row.owner_customer_gid===null&&args[3]===row.claim_sha256&&
      row.created_at_ms>=args[4];
     if(good)row.owner_customer_gid=args[0];
     return {success:true,meta:{changes:good?1:0}};
    }
    if(sql.startsWith('INSERT OR IGNORE INTO jill_work_contact_messages')){
     assert.match(sql,/owner_customer_gid=\?/);
     const valid=args[0]===shop&&args[1]===id&&
      args[11]===row.owner_customer_gid&&row.owner_customer_gid!==null;
     const existing=messages.some(m=>m.operation_id===args[4]);
     if(!valid||existing)return {success:true,meta:{changes:0}};
     messages.push({ticket_id:id,sequence:messages.length+1,
      operation_id:args[4],actor_staff_id:args[5],
      body_text:args[6],body_sha256:args[7],created_at_ms:args[8],
      private_email:'not-public@invalid.test'});
     return {success:true,meta:{changes:1}};
    }
    throw Error('Unexpected HQ mutation '+sql);
   },
   async first(){
    if(sql.includes('SELECT owner_customer_gid,claim_sha256,created_at_ms')){
     return {...row};
    }
    if(sql.includes('SELECT ticket_id,owner_customer_gid,state,revision')){
     return args[0]===shop&&args[1]===id&&
       args[2]===row.owner_customer_gid?{...row}:null;
    }
    if(sql.includes('SELECT owner_customer_gid FROM jill_work_contact_tickets')){
     return args[0]===shop&&args[1]===id&&row.owner_customer_gid
       ?{owner_customer_gid:row.owner_customer_gid}:null;
    }
    if(sql.includes('SELECT sequence,operation_id,actor_staff_id,body_sha256')){
     return messages.find(m=>m.operation_id===args[1])||null;
    }
    if(sql.includes('SELECT sequence FROM jill_work_contact_messages')){
     return messages.find(m=>m.ticket_id===args[1]&&
       m.operation_id===args[2])||null;
    }
    throw Error('Unexpected HQ query '+sql);
   },
   async all(){
    if(sql.includes('FROM jill_work_contact_tickets')){
     assert.match(sql,/owner_customer_gid=\?/);
     return {results:args[0]===shop&&args[1]===row.owner_customer_gid
      ?[{...row}]:[]};
    }
    if(sql.includes('FROM jill_work_contact_messages')){
     assert.equal(args[0],shop);
     assert.equal(args[1],id);
     return {results:messages};
    }
    throw Error('Unexpected HQ query '+sql);
   },
  };
 }};
}};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function signedJwt(gid){
 const t=Math.floor(now/1000);
 const parts=b64({alg:'HS256',typ:'JWT'})+'.'+b64({
  aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
  dest:shop,sub:gid,iat:t-60,nbf:t-60,exp:t+180,
  jti:'jill-cross-pr-contact-integration-20261023',
 });
 return parts+'.'+createHmac('sha256',secret)
  .update(parts).digest('base64url');
}
const sessionToken=gid=>({
 async get(){stats.tokenReads++;return signedJwt(gid);},
});
const operation='jill:work:contact:msg:22222222-2222-4333-8444-555555555555';
async function merchantWrite(message,operationId=operation){
 const request=new Request('https://hq.work.example.invalid/app/contacts/'+id+'/message',{
  method:'POST',headers:{origin:'https://hq.work.example.invalid',
   'content-type':'application/json'},
  body:JSON.stringify({ticket_id:id,operation_id:operationId,message}),
 });
 return persistWorkContactMerchantMessage({
  request,enabled:true,expectedTicketId:id,db,now:()=>now,
  authenticate:{admin:async()=>({session:{online:true}})},
  authorize:async({session,action})=>{
   assert.equal(session.online,true);
   assert.equal(action,'requests.write');
   return {allowed:true,role:'owner',staffId:'111'};
  },
 });
}
const transport=async(url,opts)=>{
 stats.requests++;
 assert.equal(opts.method,'POST');
 assert.ok(opts.headers.Authorization?.startsWith('Bearer '));
 assert.match(opts.headers['Content-Type'],/application\/json/);
 const request=new Request(url,opts);
 const args={request,enabled:true,shopifyAppSecret:secret,db,
   rateLimit:async()=>true,now:()=>now};
 if(new URL(url).pathname==='/jill-contact-account')
   return handleWorkContactAccountRead(args);
 if(new URL(url).pathname==='/jill-contact-claim')
   return handleWorkContactTicketClaim(args);
 if(new URL(url).pathname==='/jill-contact-thread')
   return readWorkCustomerContactThread(args);
 throw Error('Unexpected account endpoint '+url);
};

// Default OFF is a zero-token / zero-network guarantee on the REAL client.
const before={...stats};
assert.equal((await loadWorkCustomerContactTickets({
 sessionToken:sessionToken(A),request:transport})).state,'not_connected');
assert.equal((await loadOwnedContactThread({
 sessionToken:sessionToken(A),ticketId:id,request:transport})).state,'not_connected');
await assert.rejects(()=>claimWorkCustomerContactTicket({
 sessionToken:sessionToken(A),ticketId:id,claimCode:code,request:transport,
}),/contact_claim_not_connected/);
assert.deepEqual(stats,before);

// Before a signed claim, merchant writes cannot become My JILL messages.
assert.equal((await merchantWrite('JILL is reviewing your request.')).status,409);
assert.equal(messages.length,0);
// Before a signed claim, neither account has a visible ticket.
for(const gid of [A,B]){
 const list=await loadWorkCustomerContactTickets({
  enabled:true,sessionToken:sessionToken(gid),request:transport});
 assert.deepEqual(list.tickets,[]);
}
await assert.rejects(()=>loadOwnedContactThread({
 enabled:true,sessionToken:sessionToken(A),ticketId:id,request:transport,
}),/contact_thread_unverified/);

// Wrong capability must not claim or leak existence.
await assert.rejects(()=>claimWorkCustomerContactTicket({
 enabled:true,sessionToken:sessionToken(A),ticketId:id,
 claimCode:Buffer.alloc(32,8).toString('base64url'),request:transport,
}),/contact_claim_unverified/);
assert.equal(row.owner_customer_gid,null);
const claimed=await claimWorkCustomerContactTicket({
 enabled:true,sessionToken:sessionToken(A),ticketId:id,
 claimCode:code,request:transport,
});
assert.equal(claimed.state,'claimed');
assert.equal(row.owner_customer_gid,A);
const repeated=await claimWorkCustomerContactTicket({
 enabled:true,sessionToken:sessionToken(A),ticketId:id,
 claimCode:code,request:transport,
});
assert.equal(repeated.state,'claimed');
await assert.rejects(()=>claimWorkCustomerContactTicket({
 enabled:true,sessionToken:sessionToken(B),ticketId:id,
 claimCode:code,request:transport,
}),/contact_claim_unverified/);
assert.equal(row.owner_customer_gid,A);

// Actual HQ account-list result passes the actual My JILL client decoder.
const listA=await loadWorkCustomerContactTickets({
 enabled:true,sessionToken:sessionToken(A),request:transport,
});
const listB=await loadWorkCustomerContactTickets({
 enabled:true,sessionToken:sessionToken(B),request:transport,
});
assert.equal(listA.tickets.length,1);
assert.deepEqual(listB.tickets,[]);
assert.equal(listA.tickets[0].ticket_id,id);
assert.equal(listA.tickets[0].revision,2);
assert.equal(listA.tickets[0].status,'reviewing');
assert.equal(listA.tickets[0].reply_enabled,false);
assert.equal(JSON.stringify(listA).includes('claim_sha256'),false);

// An authenticated Owner saves exactly one public message in HQ.
const emptyThread=await loadOwnedContactThread({
 enabled:true,sessionToken:sessionToken(A),ticketId:id,request:transport,
});
assert.deepEqual(emptyThread.messages,[]);
const written=await merchantWrite('JILL is reviewing your request.');
assert.equal(written.status,200);
assert.equal((await written.json()).code,'persisted_for_customer_account');
assert.equal(messages.length,1);
const duplicate=await merchantWrite('JILL is reviewing your request.');
assert.equal(duplicate.status,200);
assert.equal((await duplicate.json()).code,'already_persisted');
assert.equal(messages.length,1);
assert.equal((await merchantWrite('Changed text, same operation')).status,409);
assert.equal(messages.length,1);
// Actual HQ private thread response passes the My JILL transport/projector.
const thread=await loadOwnedContactThread({
 enabled:true,sessionToken:sessionToken(A),ticketId:id,request:transport,
});
assert.equal(thread.state,'ready');
assert.equal(thread.messages[0].text,'JILL is reviewing your request.');
assert.equal(thread.messages[0].author,'jill');
assert.equal(thread.reply_enabled,false);
assert.equal(thread.read_receipt_available,false);
assert.equal(JSON.stringify(thread).includes('not-public@'),false);
assert.equal(JSON.stringify(thread).includes('private_staff_id'),false);
await assert.rejects(()=>loadOwnedContactThread({
 enabled:true,sessionToken:sessionToken(B),ticketId:id,request:transport,
}),/contact_thread_unverified/);

// Even if the customer can see a claimed ticket, no extension writer is on.
const hub=readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
const hqWorker=readFileSync(path.join(hq,'services/custom-order-cloudflare/handler.mjs'),'utf8');
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
for(const key of ['JILL_WORK_CONTACT_CLAIM_ENABLED',
 'JILL_WORK_CONTACT_ACCOUNT_ENABLED','JILL_WORK_CONTACT_THREAD_ENABLED']){
 assert.ok(hqWorker.includes(key),'Missing independent WORK gate '+key);
}
console.log('PASS two-tree HQ→My JILL Contact integration: exact LIVE-code contracts, signed A/B identity, claim, list, private message readback, guest/foreign denial, hard OFF. No provider network, database, or live mutations.');
