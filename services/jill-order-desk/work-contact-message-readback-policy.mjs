// JILL WORK Contact — presentation-only save/verified-readback reconciliation.
// A server acknowledgment is NOT customer delivery, read receipt or an email.
// Clear merchant input ONLY after independently refreshed, Owner-authorized
// public Contact thread contains the exact acknowledged sequence and text.
// No I/O, writes, notifications, quote or Shopify operations.
const TICKET=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const OP=/^jill:work:contact:msg:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hold=reason=>Object.freeze({state:'held',reason,
 clear_editor:false,message_saved_for_account_verified:false,
 customer_delivered:false,customer_read:false});
export function verifyWorkContactMessageReadback({
 ticketId,command,ack,refreshedThread,
}={}){
 if(!TICKET.test(ticketId||'')||!obj(command)||
    !OP.test(command.operation_id||'')||
    typeof command.message!=='string'||command.message.length<1||
    command.message.length>1000||
    command.message!==command.message.trim())
  return hold('invalid_original_operation');
 if(!obj(ack)||ack.ok!==true||ack.kind!=='contact'||
    !['persisted_for_customer_account','already_persisted'].includes(ack.code)||
    ack.ticket_id!==ticketId||
    !Number.isSafeInteger(ack.sequence)||ack.sequence<1||
    ack.sequence>50)
  return hold('unconfirmed_operation_ack');
 if(!obj(refreshedThread)||!Array.isArray(refreshedThread.messages)||
    refreshedThread.messages.length>50)
  return hold('refresh_unavailable');
 const matches=refreshedThread.messages.filter(m=>
  m?.sequence===ack.sequence&&m?.author==='jill'&&
  m?.message===command.message&&
  typeof m.created_at==='string'&&Number.isFinite(Date.parse(m.created_at)));
 if(matches.length!==1)return hold('readback_not_confirmed');
 // A verified matching public entry is necessary but never sufficient to
 // infer customer read, push, email or notification delivery.
 return Object.freeze({
  state:'verified_public_thread_readback',
  sequence:ack.sequence,
  clear_editor:true,message_saved_for_account_verified:true,
  customer_delivered:false,customer_read:false,
 });
}
