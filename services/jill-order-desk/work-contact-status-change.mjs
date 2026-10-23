// JILL WORK HQ Contact Us status commands: SOURCE ONLY, feature OFF.
// Exact Shopify online Owner + protected WORK D1 authority required BEFORE
// reading any private ticket state. SQLite triggers persist an immutable
// revision timeline atomically with the status update.
import {readWorkMerchantPermission} from './merchant-access.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const OP=/^jill:work:contact:status:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const STAFF=/^[1-9][0-9]{0,19}$/;
const STATUS=new Set(['received','reviewing','waiting_customer','resolved']);
const NEXT=Object.freeze({
 received:new Set(['reviewing','waiting_customer','resolved']),
 reviewing:new Set(['waiting_customer','resolved']),
 waiting_customer:new Set(['reviewing','resolved']),
 resolved:new Set(['reviewing']),
});
const HEADERS={'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff'};
const response=(status,code,extra={})=>Response.json({
 ok:status===200,code,kind:'contact',...extra,
},{status,headers:HEADERS});
async function parseBounded(request){
 const type=request.headers.get('content-type')||'';
 if(!/^application\/json(?:;|$)/i.test(type))throw Error('invalid');
 const size=request.headers.get('content-length');
 if(size!==null&&(!/^(0|[1-9][0-9]*)$/.test(size)||Number(size)>768))
  throw Error('invalid');
 const reader=request.body?.getReader();
 if(!reader)throw Error('invalid');
 const chunks=[];let count=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   count+=value.byteLength;
   if(count>768)throw Error('invalid');
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(count);let i=0;
 for(const part of chunks){bytes.set(part,i);i+=part.byteLength;}
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!data||typeof data!=='object'||Array.isArray(data)||
   Object.keys(data).length!==5||!Object.hasOwn(data,'ticket_id')||
   !Object.hasOwn(data,'operation_id')||
   !Object.hasOwn(data,'expected_revision')||
   !Object.hasOwn(data,'expected_status')||
   !Object.hasOwn(data,'next_status')||
   !ID.test(data.ticket_id||'')||!OP.test(data.operation_id||'')||
   !Number.isSafeInteger(data.expected_revision)||
   data.expected_revision<1||data.expected_revision>=100||
   !STATUS.has(data.expected_status)||!STATUS.has(data.next_status)||
   !NEXT[data.expected_status].has(data.next_status))
  throw Error('invalid');
 return data;
}
/** @param {{
 * request?:Request,enabled?:boolean,authenticate?:{admin:(request:Request)=>Promise<any>},
 * authorize?:typeof readWorkMerchantPermission,db?:any,now?:()=>number
 * }} [options]
 */
export async function handleWorkContactStatusChange({
 request,enabled=false,authenticate,authorize=readWorkMerchantPermission,
 db,now=Date.now,
}={}){
 // Explicit WORK flag: no session, body, DB, or clock access while OFF.
 if(enabled!==true)return response(503,'not_connected');
 if(request?.method!=='POST')return response(405,'method_not_allowed');
 if(typeof authenticate?.admin!=='function'||
   typeof authorize!=='function'||typeof db?.prepare!=='function'||
   typeof now!=='function')return response(503,'source_unavailable');
 try{
  const origin=request.headers.get('origin');
  if(origin!==new URL(request.url).origin)
   return response(400,'invalid_request');
 }catch{return response(400,'invalid_request');}
 let access;
 try{
  const {session}=await authenticate.admin(request);
  access=await authorize({db,session,action:'requests.write'});
 }catch{return response(403,'access_denied');}
 if(access?.allowed!==true||access.role!=='owner'||
    !STAFF.test(access.staffId||''))return response(403,'access_denied');
 let body;
 try{body=await parseBounded(request);}
 catch{return response(400,'invalid_request');}
 const time=now();
 if(!Number.isSafeInteger(time)||time<1600000000000)
  return response(503,'source_unavailable');
 try{
  // Compare-and-swap ensures no stale merchant tab overwrites a newer
  // contact decision; a database trigger writes the SAME revision to audit.
  const result=await db.prepare(
   'UPDATE jill_work_contact_tickets SET state=?,revision=revision+1,'+
   'updated_at_ms=?,status_actor_staff_id=?,last_status_operation_id=? '+
   'WHERE shop=? AND ticket_id=? AND revision=? AND state=? '+
   'AND updated_at_ms<?'
  ).bind(body.next_status,time,access.staffId,body.operation_id,SHOP,
    body.ticket_id,body.expected_revision,body.expected_status,time).run();
  if(result?.success!==true)return response(503,'source_unavailable');
  if(![0,1].includes(result?.meta?.changes))
   return response(503,'source_unavailable');
  const stored=await db.prepare(
   'SELECT state,revision,status_actor_staff_id,last_status_operation_id '+
   'FROM jill_work_contact_tickets WHERE shop=? AND ticket_id=?'
  ).bind(SHOP,body.ticket_id).first();
  // If a post-write confirmation is lost, return NO success. The caller
  // retries the SAME operation ID; the readback then confirms it.
  if(stored?.state===body.next_status&&
     stored.revision===body.expected_revision+1&&
     stored.status_actor_staff_id===access.staffId&&
     stored.last_status_operation_id===body.operation_id)
   return response(200,result.meta.changes===1?'updated':'already_updated',{
    ticket_id:body.ticket_id,revision:stored.revision,status:stored.state,
   });
  return response(409,'stale_or_unverified_status');
 }catch{return response(503,'source_unavailable');}
}
