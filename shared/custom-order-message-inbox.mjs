// Shared *presentation-only* thread summary for HQ and My JILL.
// Canonical public timelines are owned by Google, not by this list.
// Never infer unread/seen/delivered from an updated timestamp or badge.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const KINDS=new Set(['merchant_message','customer_reply']);
const ACTORS=new Set(['jill','customer']);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&
  Number.isFinite(Date.parse(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function summarizePublicOrderThread(order){
  if(!object(order)||!ID.test(order.submission_id||'')||
     !Number.isSafeInteger(order.revision)||order.revision<1||
     order.revision>100||!date(order.updated_at)||
     !Array.isArray(order.timeline)||
     order.timeline.length>100||order.timeline.length<1||
     (order.timeline_version!==undefined&&order.timeline_version!==2))
    throw Error('unverified_message_thread');
  // Legacy v1 status-only histories have no author/kind/revision.
  // Preserve the thread's existence without claiming "no messages" or
  // manufacturing a sender. Reply remains disabled by existing v2 check.
  if(order.timeline_version!==2)return Object.freeze({
    submission_id:order.submission_id,revision:order.revision,
    status:order.status,updated_at:order.updated_at,
    timeline_version:1,last_message:null,unread_count:null,
    read_receipt_verified:false,delivery_verified:false,
  });
  let prior=0,last=null;
  for(const e of order.timeline){
    if(!object(e)||!Number.isSafeInteger(e.revision)||
       e.revision<=prior||e.revision>order.revision||
       !date(e.occurred_at)||typeof e.note!=='string'||
       e.note.length>500||typeof e.kind!=='string'||
       typeof e.author!=='string')
      throw Error('unverified_message_thread');
    prior=e.revision;
    if(KINDS.has(e.kind)&&ACTORS.has(e.author)&&
       (e.kind==='merchant_message')===(e.author==='jill')&&e.note.trim()){
      last={author:e.author,occurred_at:e.occurred_at,
        revision:e.revision,note:e.note};
    }
  }
  return Object.freeze({submission_id:order.submission_id,
    revision:order.revision,status:order.status,
    updated_at:order.updated_at,timeline_version:2,
    // No preview of raw private notes, staff events or unverified payloads.
    last_message:last?Object.freeze(last):null,
    unread_count:null,read_receipt_verified:false,
    delivery_verified:false});
}
export function projectCustomerMessageInbox(orders){
  // Only AFTER the existing authenticated customer account reader returns
  // its public 20-request projection. No owner/email input accepted here.
  if(!Array.isArray(orders)||orders.length>20)
    throw Error('unverified_message_inbox');
  const seen=new Set();
  return Object.freeze(orders.map(order=>{
    const summary=summarizePublicOrderThread(order);
    if(seen.has(summary.submission_id))throw Error('duplicate_request');
    seen.add(summary.submission_id);
    return summary;
  }).sort((a,b)=>{
    const at=a.last_message?.occurred_at||a.updated_at;
    const bt=b.last_message?.occurred_at||b.updated_at;
    return Date.parse(bt)-Date.parse(at)||
      a.submission_id.localeCompare(b.submission_id);
  }));
}
export function summarizeMerchantPublicThread(thread,submissionId){
  if(!ID.test(submissionId||'')||thread?.submission_id!==submissionId)
    throw Error('unverified_message_thread');
  // The existing signed merchant thread route provides this same public
  // v2 projection; no second message ledger or new endpoint.
  return summarizePublicOrderThread(thread);
}
