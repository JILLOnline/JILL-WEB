// My JILL navigation and in-memory reply drafts. These functions do NOT
// authorize a customer: only a fresh, signed Shopify account response may
// determine which requests can be selected. No URL, storage, or new writer.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const OP=/^jill:customer:reply:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validIds=records=>{
 if(!Array.isArray(records)||records.length>20)return null;
 const ids=new Set();
 for(const row of records){
  if(!object(row)||!ID.test(row.submission_id||'')||
    ids.has(row.submission_id))return null;
  ids.add(row.submission_id);
 }
 return ids;
};
export function selectOwnedMessageRequest(inbox,{requestedId=null,previousId=null}={}){
 const owned=validIds(inbox);
 if(!owned)return null;
 if(typeof requestedId==='string'&&owned.has(requestedId))return requestedId;
 if(typeof previousId==='string'&&owned.has(previousId))return previousId;
 return inbox[0]?.submission_id??null;
}
const validOperation=(operation,id,text)=>object(operation)&&
 operation.submission_id===id&&
 typeof operation.operation_id==='string'&&OP.test(operation.operation_id)&&
 Number.isSafeInteger(operation.expected_revision)&&
 operation.expected_revision>=1&&operation.expected_revision<=99&&
 typeof operation.text==='string'&&operation.text.trim()===operation.text&&
 operation.text.length>0&&operation.text.length<=500&&
 text.trim()===operation.text;
export function recoverOwnedMessageDraft(draft,id){
 if(!ID.test(id)||!object(draft))return {};
 const text=typeof draft.text==='string'&&draft.text.length<=500?draft.text:'';
 const valid=validOperation(draft.operation,id,text);
 const operation=valid?draft.operation:null;
 // Do not allow a foreign/malformed operation or phantom pending receipt.
 // Keep what the customer typed, never retry under a new operation ID.
 let state=['idle','busy','unconfirmed','missing','stale','sent'].includes(draft.state)
   ?draft.state:'idle';
 if(draft.operation&&!valid)state='idle';
 if(state==='busy'||draft.busy===true)
  state=operation?'unconfirmed':'idle';
 if(['missing','unconfirmed'].includes(state)&&!operation)state='idle';
 return {text,state,operation,busy:false,staleRevision:
  state==='stale'&&Number.isSafeInteger(draft.staleRevision)
    ?draft.staleRevision:null};
}
export function retainOwnedMessageDrafts(previous,verifiedOrders){
 const owned=validIds(verifiedOrders);
 if(!owned)return {};
 const existing=object(previous)?previous:{};
 const next={};
 for(const id of owned){
  // Preserve the SAME receipt operation across screens, but never restore
  // an in-flight "busy" flag after the sending component unmounts. A resumed
  // operation must show "Check delivery", not send a second message.
  Object.defineProperty(next,id,{
   value:recoverOwnedMessageDraft(Object.hasOwn(existing,id)?existing[id]:null,id),
   enumerable:true,writable:true,configurable:true,
  });
 }
 return next;
}


// The shared hub ledger is the ONLY permitted draft writer. Every UI update
// carries the operation ID it observed (null if starting a new reply).
// A late response from an unmounted screen cannot replace a newer command,
// revive a removed customer request, or clear another operation's busy flag.
export function updateOwnedMessageDraft(previous,id,change,meta={}){
 if(!object(previous)||!ID.test(id)||!Object.hasOwn(previous,id)||
   !object(change)||!object(meta)||
   !Object.hasOwn(meta,'expectedOperationId'))return previous;
 const existing=object(previous[id])?previous[id]:{};
 const currentOp=object(existing.operation)&&typeof existing.operation.operation_id==='string'
   ?existing.operation.operation_id:null;
 const expected=meta.expectedOperationId;
 if((expected!==null&&typeof expected!=='string')||expected!==currentOp)
   return previous;
 const allowed=['text','state','operation','busy','staleRevision'];
 if(Object.keys(change).some(key=>!allowed.includes(key)))return previous;
 if(Object.hasOwn(change,'text')&&
  (typeof change.text!=='string'||change.text.length>500))return previous;
 if(Object.hasOwn(change,'operation')){
  const next=change.operation;
  if(next!==null){
   const shown=Object.hasOwn(change,'text')?change.text:existing.text??'';
   if(!validOperation(next,id,shown))return previous;
   if(currentOp!==null&&(next.operation_id!==currentOp||
     next.submission_id!==existing.operation.submission_id||
     next.expected_revision!==existing.operation.expected_revision||
     next.text!==existing.operation.text))return previous;
  }
 }
 if(Object.hasOwn(change,'state')&&
   !['idle','busy','unconfirmed','missing','stale','sent'].includes(change.state))
   return previous;
 if(Object.hasOwn(change,'busy')&&typeof change.busy!=='boolean')return previous;
 const updated={...existing,...change};
 return {...previous,[id]:updated};
}
