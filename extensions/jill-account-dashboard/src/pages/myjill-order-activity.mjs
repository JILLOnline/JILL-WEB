// My JILL WORK — compact customer-facing Custom Order activity model.
// Consumes ONLY the canonical, already signed Customer Account order list.
// Returns status counts and canonical IDs, never personal or quote details.
// This is not a second ownership reader, ETA engine, or status writer.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const ACTIVE=new Set(['received','reviewing','awaiting_approval',
 'in_production','ready_pickup','on_hold']);
const FINISHED=new Set(['completed','cancelled']);
const STATUSES=new Set([...ACTIVE,...FINISHED]);
const validDate=x=>typeof x==='string'&&x.length<=40&&
 /^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));

export const MYJILL_ORDER_FILTERS=Object.freeze([
 Object.freeze({id:'all',label:'All requests'}),
 Object.freeze({id:'active',label:'Active'}),
 Object.freeze({id:'finished',label:'Completed & cancelled'}),
]);

export function projectMyJillOrderActivity(orders){
 if(!Array.isArray(orders)||orders.length>20)
  throw Error('myjill_order_activity_unverified');
 const seen=new Set();
 const rows=orders.map(order=>{
  if(!order||typeof order!=='object'||Array.isArray(order)||
   !ID.test(order.submission_id||'')||seen.has(order.submission_id)||
   !STATUSES.has(order.status)||!validDate(order.updated_at)||
   !Number.isSafeInteger(order.revision)||order.revision<1||
   order.revision>100)
   throw Error('myjill_order_activity_unverified');
  seen.add(order.submission_id);
  return {id:order.submission_id,status:order.status,ms:Date.parse(order.updated_at)};
 });
 rows.sort((a,b)=>b.ms-a.ms||a.id.localeCompare(b.id));
 const active=rows.filter(x=>ACTIVE.has(x.status)).length;
 const finished=rows.length-active;
 const waiting=rows.filter(x=>x.status==='awaiting_approval').length;
 const pickup=rows.filter(x=>x.status==='ready_pickup').length;
 return Object.freeze({
  total:rows.length,active,finished,
  awaiting_approval:waiting,ready_pickup:pickup,
  // These are sorted IDs only; the caller still holds the signed
  // response. No customer names, GIDs, notes, emails or internal quotes.
  all_ids:Object.freeze(rows.map(x=>x.id)),
  active_ids:Object.freeze(rows.filter(x=>ACTIVE.has(x.status)).map(x=>x.id)),
  finished_ids:Object.freeze(rows.filter(x=>FINISHED.has(x.status)).map(x=>x.id)),
 });
}
export function selectMyJillOrderIds(activity,filter='all'){
 if(!activity||typeof activity!=='object'||
   !['all','active','finished'].includes(filter))
  return Object.freeze([]);
 const key=filter==='active'?'active_ids':
  filter==='finished'?'finished_ids':'all_ids';
 return Array.isArray(activity[key])?activity[key]:Object.freeze([]);
}
