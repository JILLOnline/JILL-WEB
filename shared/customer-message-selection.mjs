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
