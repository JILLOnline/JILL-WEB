import {customOrderRequestedQuantity} from './custom-order-presentation.mjs';

// My JILL: source-only overview projection for already signed Custom Orders.
// Never infer account identity from email/name, manufacture status counts,
// or present a failed/partial signed read as "zero requests".
const VALID_ID=/^[A-Za-z0-9._:-]{8,128}$/;
const isValidDate=value=>typeof value==='string'&&
 value.length<=40&&Number.isFinite(Date.parse(value))&&
 /^\d{4}-\d{2}-\d{2}T/.test(value);
// Only canonical public request states can produce a Home attention item.
// Awaiting approval here is an INFORMATIONAL status, never a live consent
// button, bill, or Shopify payment instruction.
const FOCUS_PRIORITY=Object.freeze({
 on_hold:0,ready_pickup:1,awaiting_approval:2,
});

export function projectMyJillRecentRequests(orders,{limit=3}={}){
 if(!Array.isArray(orders)||orders.length>20||
  !Number.isSafeInteger(limit)||limit<1||limit>5)
  throw Error('myjill_recent_requests_unverified');
 const seen=new Set();
 const sorted=orders.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||
    !VALID_ID.test(row.submission_id||'')||
    seen.has(row.submission_id)||!isValidDate(row.updated_at)||
    !Number.isSafeInteger(row.revision)||row.revision<1||
    row.revision>100||
    !['received','reviewing','awaiting_approval','in_production',
      'ready_pickup','on_hold','cancelled','completed'].includes(row.status)||
    !row.summary||typeof row.summary!=='object'||
    !Array.isArray(row.summary.items)||row.summary.items.length>20)
    throw Error('myjill_recent_requests_unverified');
  const needed=row.summary.date_needed;
  const method=row.summary.fulfillment;
  if(needed!==undefined&&(typeof needed!=='string'||
    (needed!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(needed)))||
    method!==undefined&&!['','pickup','shipping'].includes(method))
    throw Error('myjill_recent_requests_unverified');
  seen.add(row.submission_id);
  const title=row.summary.items.find(item=>
    typeof item?.title==='string'&&item.title.trim().length>0)?.title;
  return Object.freeze({
   submission_id:row.submission_id,
   revision:row.revision,status:row.status,
   updated_at:row.updated_at,
   title:typeof title==='string'?title.trim().slice(0,90):'Custom request',
   requested_quantity:customOrderRequestedQuantity(row.summary),
   date_needed:needed||'',fulfillment:method||'',
   updated_at_ms:Date.parse(row.updated_at),
  });
 });
 sorted.sort((a,b)=>b.updated_at_ms-a.updated_at_ms||
  a.submission_id.localeCompare(b.submission_id));
 // Find the most relevant verified active request, even if it is older
 // than the three recent cards. Read-only navigation still re-verifies ID.
 const focus=sorted.filter(row=>Object.hasOwn(FOCUS_PRIORITY,row.status))
  .sort((a,b)=>FOCUS_PRIORITY[a.status]-FOCUS_PRIORITY[b.status]||
    b.updated_at_ms-a.updated_at_ms||a.submission_id.localeCompare(b.submission_id))[0];
 return Object.freeze({
  total:sorted.length,
  focus:focus?Object.freeze({
   submission_id:focus.submission_id,status:focus.status,
  }):null,
  recent:Object.freeze(sorted.slice(0,limit).map(({updated_at_ms,...rest})=>
   Object.freeze(rest))),
 });
}
