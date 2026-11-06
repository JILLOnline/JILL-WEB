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
// Local search over ONLY the already authenticated, status-verified order
// projection. No new Shopify fetch, email matching, notes or guest claim.
// We return canonical IDs in the original verified sort order, never PII.
export function searchVerifiedMyJillOrders(activity,orders,filter,query=''){
 const ids=selectMyJillOrderIds(activity,filter);
 if(!Array.isArray(activity?.all_ids)||!Array.isArray(orders)||
    orders.length>20||orders.length!==activity.all_ids.length||
    typeof query!=='string'||query.length>80||
    !['all','active','finished'].includes(filter))return Object.freeze([]);
 const all=new Set(activity.all_ids);
 const byId=new Map();
 for(const order of orders){
  const id=order?.submission_id;
  if(typeof id!=='string'||!ID.test(id)||!all.has(id)||
     byId.has(id)||!Array.isArray(order?.summary?.items)||
     order.summary.items.length>20)return Object.freeze([]);
  byId.set(id,order);
 }
 if(byId.size!==all.size)return Object.freeze([]);
 const needle=query.trim().toLocaleLowerCase('en-US').replace(/^#/,'');
 if(!needle)return ids;
 return Object.freeze(ids.filter(id=>{
  const items=byId.get(id).summary.items;
  return id.toLocaleLowerCase('en-US').includes(needle)||
    items.some(item=>typeof item?.title==='string'&&
      item.title.toLocaleLowerCase('en-US').includes(needle));
 }));
}

export function selectMyJillOrderIds(activity,filter='all'){
 if(!activity||typeof activity!=='object'||
   !['all','active','finished'].includes(filter))
  return Object.freeze([]);
 const key=filter==='active'?'active_ids':
  filter==='finished'?'finished_ids':'all_ids';
 return Array.isArray(activity[key])?activity[key]:Object.freeze([]);
}
