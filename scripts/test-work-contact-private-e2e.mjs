// Source-only WORK Contact Us end-to-end through actual gateway-to-private
// HQ handlers. Synthetic app-proxy signing, Customer A/B JWTs and mock D1.
// NO real customer, Cloudflare, Shopify, mail, payment or remote traffic.
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {handleCloudflareCustomOrderWork}
 from '../services/custom-order-cloudflare/handler.mjs';
import {handleWorkContactPrivateBridge}
 from '../services/jill-order-desk/work-contact-private-bridge.mjs';
import {persistWorkContactMerchantMessage}
 from '../services/jill-order-desk/work-contact-message-write.mjs';

const SHOP='jill-work.myshopify.com';
const SECRET='synthetic-shopify-work-secret-contact-integration-not-real';
const ID='jill:contact:11111111-2222-4333-8444-555555555555';
const OP='jill:work:contact:msg:11111111-2222-4333-8444-555555555555';
const A='gid://shopify/Customer/111';
const B='gid://shopify/Customer/222';
const CLAIM=Buffer.alloc(32,7).toString('base64url');
const NOW=Date.now();
let record=null,quotaCalls=0,rpcCalls=0,dbWrites=0;
const messages=[];
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
const db={prepare(sql){
 return {bind(...args){
  return {
   async run(){
    if(sql.startsWith('INSERT OR IGNORE INTO jill_work_contact_tickets')){
     const [shop,id,bodyHash,claimHash,json,created,updated]=args;
     assert.equal(shop,SHOP);assert.equal(id,ID);
     const createdNew=!record;
     if(createdNew){
      record={shop,ticket_id:id,source:'shopify_contact_bridge',
       body_sha256:bodyHash,claim_sha256:claimHash,
       contact_json:json,owner_customer_gid:null,state:'received',
       revision:1,created_at_ms:created,updated_at_ms:updated};
      dbWrites++;
     }
     return {success:true,meta:{changes:createdNew?1:0}};
    }
    if(sql.startsWith('UPDATE jill_work_contact_tickets SET owner_customer_gid')){
     const [gid,shop,id,claimHash,cutoff]=args;
     const permitted=record&&record.shop===shop&&record.ticket_id===id&&
      record.owner_customer_gid===null&&record.claim_sha256===claimHash&&
      record.created_at_ms>=cutoff;
     if(permitted){record.owner_customer_gid=gid;dbWrites++;}
     return {success:true,meta:{changes:permitted?1:0}};
    }
    if(sql.startsWith('INSERT OR IGNORE INTO jill_work_contact_messages')){
     const [shop,id,, ,op,staffId,text,bodyHash,time,, ,owner]=args;
     const matching=record&&record.shop===shop&&record.ticket_id===id&&
      record.owner_customer_gid===owner&&
      !messages.some(m=>m.operation_id===op);
     if(matching){
      messages.push({ticket_id:id,sequence:messages.length+1,
       operation_id:op,actor_staff_id:staffId,body_text:text,
       body_sha256:bodyHash,created_at_ms:time});
      dbWrites++;
     }
     return {success:true,meta:{changes:matching?1:0}};
    }
    throw Error('Unexpected synthetic D1 write');
   },
   async first(){
    if(sql.startsWith('SELECT source,body_sha256'))
     return record?{
      source:record.source,body_sha256:record.body_sha256,
      claim_sha256:record.claim_sha256,owner_customer_gid:record.owner_customer_gid,
      state:record.state,
     }:null;
    if(sql.startsWith('SELECT owner_customer_gid,claim_sha256,created_at_ms'))
     return record?{owner_customer_gid:record.owner_customer_gid,
      claim_sha256:record.claim_sha256,created_at_ms:record.created_at_ms}:null;
    if(sql.startsWith('SELECT owner_customer_gid FROM jill_work_contact_tickets'))
     return record?.ticket_id===args[1]
      ?{owner_customer_gid:record.owner_customer_gid}:null;
    if(sql.startsWith('SELECT sequence,operation_id,actor_staff_id,body_sha256'))
     return messages.find(m=>m.operation_id===args[1])||null;
    if(sql.startsWith('SELECT sequence FROM jill_work_contact_messages'))
     return messages.find(m=>m.operation_id===args[2]&&m.ticket_id===args[1])||null;
    if(sql.startsWith('SELECT ticket_id,owner_customer_gid,state,revision,updated_at_ms'))
     return record?.shop===args[0]&&record?.ticket_id===args[1]&&
      record?.owner_customer_gid===args[2]?record:null;
    throw Error('Unexpected synthetic D1 first query');
   },
   async all(){
    if(sql.includes('json_extract(contact_json')){
     assert.equal(args[0],SHOP);
     return {results:record?.owner_customer_gid===args[1]?[{
      ...record,reason:JSON.parse(record.contact_json).reason,
     }]:[]};
    }
    if(sql.startsWith('SELECT sequence,body_text,created_at_ms')){
     assert.equal(args[0],SHOP);assert.equal(args[1],ID);
     return {results:messages.map(m=>({
      sequence:m.sequence,body_text:m.body_text,created_at_ms:m.created_at_ms,
     }))};
    }
    throw Error('Unexpected synthetic D1 all query');
   },
  };
 }};
}};
const hq={
 SHOPIFY_API_SECRET:SECRET,JILL_ORDER_DESK_WORK_DB:db,
 JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'true',
 JILL_WORK_CONTACT_INTAKE_ENABLED:'true',
 JILL_WORK_CONTACT_CLAIM_ENABLED:'true',
 JILL_WORK_CONTACT_ACCOUNT_ENABLED:'true',
 JILL_WORK_CONTACT_THREAD_ENABLED:'true',
};
const service={fetch:async req=>{
 rpcCalls++;
 assert.equal(req.headers.has('cookie'),false);
 assert.equal(req.headers.has('cf-connecting-ip'),false);
 return handleWorkContactPrivateBridge({request:req,env:hq,now:()=>NOW});
}};
let quotaAllowed=true;
const gateway={
 SHOPIFY_WORK_APP_SECRET:SECRET,
 JILL_WORK_HQ_CONTACT_PRIVATE:service,
 RATE_LIMITER:{getByName:()=>({allow:async()=>{quotaCalls++;return quotaAllowed;}})},
 JILL_WORK_CONTACT_INTAKE_ENABLED:'true',
 JILL_WORK_CONTACT_CLAIM_ENABLED:'true',
 JILL_WORK_CONTACT_ACCOUNT_ENABLED:'true',
 JILL_WORK_CONTACT_THREAD_ENABLED:'true',
};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function jwt(gid){
 const seconds=Math.floor(NOW/1000);
 const data=b64({alg:'HS256',typ:'JWT'})+'.'+b64({
  aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
  dest:SHOP,sub:gid,iat:seconds-60,nbf:seconds-60,exp:seconds+180,
  jti:'jill-test-private-bridge-a-b-guest-20261023',
 });
 return data+'.'+createHmac('sha256',SECRET).update(data).digest('base64url');
}
function signedUrl(){
 const params=new URLSearchParams({shop:SHOP,timestamp:String(Math.floor(NOW/1000)),
  path_prefix:'/apps/jill-custom-order'});
 const canonical=[...params].map(([k,v])=>k+'='+v).sort().join('');
 params.set('signature',createHmac('sha256',SECRET)
  .update(canonical).digest('hex'));
 return 'https://qa.workers.dev/jill-custom-order-proxy/contact?'+params;
}
const entry={
 ticket_id:ID,name:'JILL QA',email:'test.customer@example.invalid',
 phone:'',reason:'product',message:'Question about a custom piñata',
 preferred_contact:'Email',reviewed:true,
 claim_token:CLAIM,details:{product_name:'Custom piñata'},
};
const submit=()=>new Request(signedUrl(),{method:'POST',
 headers:{'content-type':'application/json',
  origin:'https://jill-work.myshopify.com',cookie:'must-not-forward=1'},
 body:JSON.stringify(entry),
});
const account=(path,gid,data)=>new Request('https://qa.workers.dev'+path,{
 method:'POST',
 headers:{'content-type':'application/json',
  ...(gid?{authorization:'Bearer '+jwt(gid)}:{})},
 body:JSON.stringify(data),
});
const call=request=>handleCloudflareCustomOrderWork(request,gateway);

// Everything requires explicit dual flags, including the HQ private flag.
const hqOff={...hq,JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'false'};
assert.equal((await handleWorkContactPrivateBridge({
 request:submit(),env:hqOff,now:()=>NOW,
})).status,503);
assert.equal(dbWrites,0);
// The public gateway can't use HQ's private D1: only the private service can.
assert.equal((await call(submit())).status,201);
assert.equal(record.owner_customer_gid,null);
assert.ok(!record.contact_json.includes(CLAIM));
const recorded=JSON.parse(record.contact_json);
assert.equal(recorded.email,entry.email);
assert.equal((await call(submit())).status,200);
assert.equal(dbWrites,1,'idempotent replay creates no duplicate ticket');
const noOwner=await call(account('/jill-contact-account',A,{}));
assert.equal(noOwner.status,200);
assert.deepEqual((await noOwner.json()).tickets,[]);
const unclaimed=await call(account('/jill-contact-thread',A,{ticket_id:ID}));
assert.equal(unclaimed.status,404);
const noAuth=await call(account('/jill-contact-claim',null,
 {ticket_id:ID,claim_token:CLAIM}));
assert.equal(noAuth.status,401);
const badClaim=await call(account('/jill-contact-claim',A,
 {ticket_id:ID,claim_token:Buffer.alloc(32,8).toString('base64url')}));
assert.equal(badClaim.status,409);
assert.equal(record.owner_customer_gid,null);
const claimed=await call(account('/jill-contact-claim',A,
 {ticket_id:ID,claim_token:CLAIM}));
assert.equal(claimed.status,200);
assert.equal(record.owner_customer_gid,A);
const afterClaimWrites=dbWrites;
assert.equal((await call(account('/jill-contact-claim',A,
 {ticket_id:ID,claim_token:CLAIM}))).status,200);
assert.equal(dbWrites,afterClaimWrites,'same Customer A claim is idempotent');
assert.equal((await call(account('/jill-contact-claim',B,
 {ticket_id:ID,claim_token:CLAIM}))).status,409);
const aTickets=await (await call(account('/jill-contact-account',A,{}))).json();
const bTickets=await (await call(account('/jill-contact-account',B,{}))).json();
assert.equal(aTickets.tickets.length,1);
assert.deepEqual(bTickets.tickets,[]);
assert.equal(aTickets.tickets[0].ticket_id,ID);
assert.equal(JSON.stringify(aTickets).includes(entry.email),false);
const message=new Request('https://hq.work.example.invalid/app/contacts/'+ID+'/message',{
 method:'POST',headers:{origin:'https://hq.work.example.invalid',
  'content-type':'application/json'},
 body:JSON.stringify({ticket_id:ID,operation_id:OP,
  message:'JILL has received your request.'}),
});
const save=()=>persistWorkContactMerchantMessage({
 request:message.clone(),expectedTicketId:ID,enabled:true,db,now:()=>NOW,
 authenticate:{admin:async()=>({session:{online:true}})},
 authorize:async()=>({allowed:true,role:'owner',staffId:'111'}),
});
assert.equal((await save()).status,200);
assert.equal((await save()).status,200);
assert.equal(messages.length,1);
const aThread=await call(account('/jill-contact-thread',A,{ticket_id:ID}));
assert.equal(aThread.status,200);
const publicThread=(await aThread.json()).thread;
assert.equal(publicThread.messages.length,1);
assert.equal(publicThread.messages[0].message,'JILL has received your request.');
assert.equal(publicThread.reply_enabled,false);
assert.equal(publicThread.read_receipt_available,false);
assert.doesNotMatch(JSON.stringify(publicThread),
 /actor_staff_id|owner_customer_gid|claim_sha256|contact_json|body_sha256|test.customer@/);
assert.equal((await call(account('/jill-contact-thread',B,{ticket_id:ID}))).status,404);
assert.equal((await call(account('/jill-contact-thread',null,{ticket_id:ID}))).status,401);
// Quota denial stops gateway before ANY private RPC or D1 access.
quotaAllowed=false;
const rpcBefore=rpcCalls,writesBefore=dbWrites;
assert.equal((await call(account('/jill-contact-thread',A,{ticket_id:ID}))).status,429);
assert.equal(rpcCalls,rpcBefore);
assert.equal(dbWrites,writesBefore);
assert.ok(quotaCalls>0);
console.log('PASS WORK private Contact full synthetic path: signed intake -> HQ-only D1 -> A exact claim -> Owner reply -> A thread; B/guest blocked, no PII leak, quota first, no remote traffic.');
