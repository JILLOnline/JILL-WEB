// My JILL navigation and reply drafts. These functions do NOT authorize a
// customer: inputs MUST be the fresh signed-account public request projection.
// Nothing is persisted outside the mounted hub (no local storage/URL).
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const validIds=(records)=>{
 if(!Array.isArray(records)||records.length>20)return null;
 const ids=new Set();
 for(const row of records){
  if(!row||typeof row!=='object'||!ID.test(row.submission_id||'')||
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
export function retainOwnedMessageDrafts(previous,verifiedOrders){
 const owned=validIds(verifiedOrders);
 if(!owned)return {};
 const existing=previous&&typeof previous==='object'&&!Array.isArray(previous)
   ?previous:{};
 const next={};
 for(const id of owned){
  const draft=Object.hasOwn(existing,id)?existing[id]:null;
  // Preserve uncertain send text and the SAME operation ID across tabs,
  // but only while its request is still in the freshly authorized result.
  Object.defineProperty(next,id,{value:draft&&typeof draft==='object'&&!Array.isArray(draft)
    ?draft:{},enumerable:true,writable:true,configurable:true});
 }
 return next;
}
