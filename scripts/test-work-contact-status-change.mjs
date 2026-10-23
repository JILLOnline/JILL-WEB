import assert from 'node:assert/strict';
import {handleWorkContactStatusChange}
 from '../services/jill-order-desk/work-contact-status-change.mjs';

const shop='jill-work.myshopify.com';
const ticket='jill:contact:11111111-2222-4333-8444-555555555555';
const op='jill:work:contact:status:11111111-2222-4333-8444-555555555555';
const clock=1792800001000, staff='111';
const command={ticket_id:ticket,operation_id:op,expected_revision:1,
 expected_status:'received',next_status:'reviewing'};
const req=(payload=command)=>new Request('https://hq.qa.example.invalid/app/contacts/'+ticket,{
 method:'POST',headers:{origin:'https://hq.qa.example.invalid',
 'content-type':'application/json'},body:JSON.stringify(payload),
});
const record={state:'received',revision:1,status_actor_staff_id:'',
 last_status_operation_id:null,updated_at_ms:clock-1000};
let reads=0,writes=0,auths=0;
const db={prepare:sql=>({bind:(...args)=>({
 async run(){
  assert.match(sql,/UPDATE jill_work_contact_tickets/);
  assert.match(sql,/revision=revision\+1/);
  writes++;
  if(args[4]===shop&&args[5]===ticket&&
     args[6]===record.revision&&args[7]===record.state&&
     record.updated_at_ms<args[8]){
    record.state=args[0];record.updated_at_ms=args[1];
    record.status_actor_staff_id=args[2];
    record.last_status_operation_id=args[3];record.revision++;
    return {success:true,meta:{changes:1}};
  }
  return {success:true,meta:{changes:0}};
 },
 async first(){
  assert.match(sql,/SELECT state,revision,status_actor_staff_id/);
  reads++;return {...record};
 },
 })})};
const authenticate={admin:async()=>{auths++;return {session:{verified:true}};}};
const authorize=async({session,action})=>{
 assert.ok(session.verified);assert.equal(action,'requests.write');
 return {allowed:true,role:'owner',staffId:staff};
};
const opts={authenticate,authorize,db,now:()=>clock};
const off=await handleWorkContactStatusChange(opts);
assert.equal(off.status,503);assert.equal(auths,0);assert.equal(reads,0);assert.equal(writes,0);
const noAuth=await handleWorkContactStatusChange({...opts,enabled:true,
 request:req(),authorize:async()=>({allowed:false,role:'owner',staffId:staff})});
assert.equal(noAuth.status,403);assert.equal(writes,0);assert.equal(reads,0);
const missingOrigin=new Request('https://hq.qa.example.invalid/app/contacts/'+ticket,{
 method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify(command),
});
const missingOriginResponse=await handleWorkContactStatusChange({...opts,
 enabled:true,request:missingOrigin});
assert.equal(missingOriginResponse.status,400);
assert.equal(writes,0);
const badStatus=await handleWorkContactStatusChange({...opts,enabled:true,
 request:req({...command,next_status:'paid'})});
assert.equal(badStatus.status,400);assert.equal(writes,0);
const spoof=await handleWorkContactStatusChange({...opts,enabled:true,
 request:req({...command,actor_staff_id:'999'})});
assert.equal(spoof.status,400);assert.equal(writes,0);
const ok=await handleWorkContactStatusChange({...opts,enabled:true,request:req()});
assert.equal(ok.status,200);assert.equal((await ok.json()).code,'updated');
assert.equal(record.state,'reviewing');assert.equal(record.revision,2);
assert.equal(record.status_actor_staff_id,staff);assert.equal(writes,1);
const again=await handleWorkContactStatusChange({...opts,enabled:true,request:req()});
assert.equal(again.status,200);
assert.equal((await again.json()).code,'already_updated');
assert.equal(record.revision,2,'same operation retry does not double update');
const oldOp=await handleWorkContactStatusChange({...opts,enabled:true,
 request:req({...command,operation_id:
 'jill:work:contact:status:22222222-2222-4333-8444-555555555555'})});
assert.equal(oldOp.status,409,'stale tab with another operation cannot claim success');
assert.equal(record.revision,2);
const next={...command,operation_id:
 'jill:work:contact:status:33333333-2222-4333-8444-555555555555',
 expected_revision:2,expected_status:'reviewing',next_status:'waiting_customer'};
assert.equal((await handleWorkContactStatusChange({...opts,enabled:true,
 now:()=>clock+1,request:req(next)})).status,200);
assert.equal(record.revision,3);
assert.equal(record.state,'waiting_customer');
assert.equal((await handleWorkContactStatusChange({...opts,enabled:true,
 request:req({...next,next_status:'received'})})).status,400);
const foreign=new Request('https://hq.qa.example.invalid/app/contacts/'+ticket,{
 method:'POST',headers:{origin:'https://malicious.example.invalid',
 'content-type':'application/json'},body:JSON.stringify(command)});
assert.equal((await handleWorkContactStatusChange({...opts,enabled:true,
 request:foreign})).status,400);
assert.equal(writes,4);
console.log('PASS HQ Contact status: hard OFF; Shopify Owner permission; bounded command; optimistic revision; stable operation receipts; no fake payment or cross-origin update.');
