// My JILL WORK Contact V2: in-memory only draft and idempotency receipts.
// A signed, freshly verified Contact ticket list must authorize all keys.
// This module has NO network, storage, identity inference, or send actions.
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const OP=/^jill:customer:contact:reply:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validCommand=(cmd,id,text)=>object(cmd)&&cmd.ticketId===id&&
 OP.test(cmd.operationId||'')&&
 Number.isSafeInteger(cmd.expectedReplySequence)&&
 cmd.expectedReplySequence>=0&&cmd.expectedReplySequence<50&&
 typeof cmd.message==='string'&&cmd.message.length>0&&
 cmd.message.length<=500&&cmd.message===cmd.message.trim()&&
 cmd.message===text.trim();
const validTickets=tickets=>{
 if(!Array.isArray(tickets)||tickets.length>20)return null;
 const ids=new Set();
 for(const item of tickets){
  if(!object(item)||!ID.test(item.ticket_id||'')||
     ids.has(item.ticket_id)||!Number.isSafeInteger(item.revision)||
     item.revision<1||item.revision>100||
     !['received','reviewing','waiting_customer','resolved'].includes(item.status))
   return null;
  ids.add(item.ticket_id);
 }
 return ids;
};
const recover=(entry,id)=>{
 if(!object(entry))return {text:'',state:'idle',operation:null,busy:false};
 const text=typeof entry.text==='string'&&entry.text.length<=500
  ?entry.text:'';
 const operation=validCommand(entry.operation,id,text)?Object.freeze({
  ticketId:id,operationId:entry.operation.operationId,
  expectedReplySequence:entry.operation.expectedReplySequence,
  message:entry.operation.message,
 }):null;
 const state=operation?'unconfirmed':
  entry.state==='confirmed'?'confirmed':'idle';
 return Object.freeze({text,state,operation,busy:false});
};
export function retainOwnedContactDrafts(previous,verifiedTickets){
 const owned=validTickets(verifiedTickets);
 if(!owned)return Object.freeze({});
 const old=object(previous)?previous:{};
 const next=Object.create(null);
 for(const id of owned){
  // A draft from an unverified or now-foreign ticket is never copied.
  // An in-flight operation resumes as UNCONFIRMED, never auto-resends.
  next[id]=recover(Object.hasOwn(old,id)?old[id]:null,id);
 }
 return Object.freeze(next);
}
const confirmedInFreshThread=(thread,cmd)=>object(thread)&&
 thread.state==='ready'&&thread.ticket_id===cmd.ticketId&&
 Array.isArray(thread.messages)&&
 thread.messages.filter(m=>m?.author==='customer'&&
  m.source_sequence===cmd.expectedReplySequence+1&&
  m.text===cmd.message).length===1;

// All mutations require a key ALREADY admitted by a fresh signed list,
// and an exact operation ID guard. Old async callbacks cannot resurrect
// an unowned ticket or erase a newer in-flight message.
export function updateOwnedContactDraft(previous,id,change,meta={}){
 if(!object(previous)||!ID.test(id||'')||
  !Object.hasOwn(previous,id)||!object(change)||!object(meta)||
  !Object.hasOwn(meta,'expectedOperationId'))return previous;
 const prior=previous[id];
 if(!object(prior))return previous;
 const current=validCommand(prior.operation,id,prior.text)
  ?prior.operation:null;
 const expected=meta.expectedOperationId;
 if(expected!==(current?.operationId??null))return previous;
 const keys=Object.keys(change);
 if(keys.length===0||keys.some(key=>
  !['text','state','operation','busy'].includes(key)))return previous;
 if(Object.hasOwn(change,'text')&&
  (typeof change.text!=='string'||change.text.length>500))return previous;
 if(Object.hasOwn(change,'busy')&&typeof change.busy!=='boolean')
  return previous;
 if(Object.hasOwn(change,'state')&&
  !['idle','busy','unconfirmed','confirmed'].includes(change.state))
  return previous;
 const merged={...prior,...change};
 const nextOperation=merged.operation;
 const finishing=change.operation===null&&change.text===''&&
  change.state==='confirmed'&&change.busy===false;
 if(finishing){
  if(!current||!confirmedInFreshThread(meta.verifiedThread,current))
   return previous;
  return {...previous,[id]:Object.freeze({
   text:'',operation:null,state:'confirmed',busy:false,
  })};
 }
 // All other changes must keep the same immutable pending command.
 if(current){
  if(!validCommand(nextOperation,id,merged.text)||
    nextOperation.operationId!==current.operationId||
    nextOperation.message!==current.message||
    nextOperation.expectedReplySequence!==current.expectedReplySequence)
   return previous;
 }else if(nextOperation!==null&&nextOperation!==undefined){
  if(!validCommand(nextOperation,id,merged.text))return previous;
 }
 if(merged.state==='confirmed')return previous;
 if(['busy','unconfirmed'].includes(merged.state)&&
    !validCommand(nextOperation,id,merged.text))return previous;
 if(merged.state==='idle'&&nextOperation)return previous;
 if(merged.busy===true&&!nextOperation)return previous;
 const safe=Object.freeze({
  text:merged.text??'',state:merged.state??'idle',
  operation:nextOperation??null,busy:merged.busy??false,
 });
 return {...previous,[id]:safe};
}
