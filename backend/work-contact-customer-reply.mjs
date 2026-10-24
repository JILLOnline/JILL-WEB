// JILL WORK: customer-authored replies to an EXACT claimed Contact ticket.
// Source-only. Separate table preserves immutable Owner merchant v1 ledger.
// A new double OFF flag + private service binding is required before release.
// No notifications, email, delivery/read receipts, Order or quote mutation.
import {createHash} from 'node:crypto';
import {verifyWorkCustomerAccountSession}
 from './customer-account-work-session.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const OP=/^jill:customer:contact:reply:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const HEADERS={
 'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'POST, OPTIONS',
 'access-control-allow-headers':'Authorization, Content-Type',
};
const respond=(status,code,extra={})=>Response.json({
 ok:status===200,version:1,operation:'jill.contact.customer.reply.result',
 code,...extra,
},{status,headers:HEADERS});
const sha=text=>createHash('sha256').update(
 'jill_work_customer_contact_reply_v1\n'+text,'utf8').digest('hex');
async function readCommand(request){
 if(!/^application\/json(?:;|$)/i.test(
  request.headers.get('content-type')||''))throw Error('invalid');
 const len=request.headers.get('content-length');
 if(len!==null&&(!/^(0|[1-9][0-9]*)$/.test(len)||Number(len)>2200))
  throw Error('invalid');
 const stream=request.body?.getReader();
 if(!stream)throw Error('invalid');
 const parts=[];let used=0;
 try{
  while(true){
   const {done,value}=await stream.read();
   if(done)break;
   used+=value.byteLength;
   if(used>2200)throw Error('invalid');
   parts.push(value);
  }
 }finally{stream.releaseLock();}
 const bytes=new Uint8Array(used);let n=0;
 for(const part of parts){bytes.set(part,n);n+=part.byteLength;}
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(data===null||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).length!==4||!ID.test(data.ticket_id||'')||
    !OP.test(data.operation_id||'')||
    !Number.isSafeInteger(data.expected_reply_sequence)||
    data.expected_reply_sequence<0||data.expected_reply_sequence>49||
    typeof data.message!=='string'||data.message.length<1||
    data.message.length>500||data.message!==data.message.trim()||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(data.message))
  throw Error('invalid');
 return data;
}
/** @param {{
 * request?:Request,enabled?:boolean,shopifyAppSecret?:string,
 * db?:any,rateLimit?:(x:{shop:string,customer:string})=>Promise<boolean>,
 * now?:()=>number
 * }} [options] */
export async function persistWorkCustomerContactReply({
 request,enabled=false,shopifyAppSecret,db,rateLimit,now=Date.now,
}={}){
 // OFF takes precedence over method, token, D1 and quotas.
 if(enabled!==true)return respond(503,'not_connected');
 if(request?.method==='OPTIONS')
  return new Response(null,{status:204,headers:HEADERS});
 if(request?.method!=='POST')return respond(405,'method_not_allowed');
 if(typeof db?.prepare!=='function'||typeof rateLimit!=='function'||
    typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32||
    typeof now!=='function')return respond(503,'source_unavailable');
 const authorization=request.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer ')||authorization.length>8300)
  return respond(401,'unauthenticated_account');
 let gid;
 try{
  const identity=verifyWorkCustomerAccountSession(authorization.slice(7),{
   appSecret:shopifyAppSecret,now,
  });
  if(identity.shop!==SHOP||!GID.test(identity.customerGid||''))
   return respond(401,'unauthenticated_account');
  gid=identity.customerGid;
 }catch{return respond(401,'unauthenticated_account');}
 try{
  if(await rateLimit({shop:SHOP,customer:gid})!==true)
   return respond(429,'rate_limited');
 }catch{return respond(503,'rate_limit_unavailable');}
 let data;
 try{data=await readCommand(request);}
 catch{return respond(400,'invalid_request');}
 const at=now();
 if(!Number.isSafeInteger(at)||at<1600000000000||at>253402300799999)
  return respond(503,'source_unavailable');
 try{
  const ticket=await db.prepare(
   'SELECT ticket_id,state FROM jill_work_contact_tickets '+
   'WHERE shop=? AND ticket_id=? AND owner_customer_gid=?'
  ).bind(SHOP,data.ticket_id,gid).first();
  if(!ticket)return respond(404,'contact_thread_unavailable');
  // Idempotency never generates a second public message and operation IDs
  // cannot be reassigned across tickets or customer JWT identities.
  const digest=sha(data.message);
  const existing=await db.prepare(
   'SELECT ticket_id,reply_sequence,actor_customer_gid,body_sha256 '+
   'FROM jill_work_contact_customer_replies WHERE shop=? AND operation_id=?'
  ).bind(SHOP,data.operation_id).first();
  if(existing)return existing.ticket_id===data.ticket_id&&
     existing.actor_customer_gid===gid&&existing.body_sha256===digest&&
     existing.reply_sequence===data.expected_reply_sequence+1
    ?respond(200,'already_persisted',{
       ticket_id:data.ticket_id,operation_id:data.operation_id,
       sequence:existing.reply_sequence,
     }):respond(409,'reply_operation_conflict');
  if(!['received','reviewing','waiting_customer'].includes(ticket.state))
   return respond(409,'reply_not_available');
  const result=await db.prepare(
   'INSERT OR IGNORE INTO jill_work_contact_customer_replies '+
   '(shop,ticket_id,reply_sequence,operation_id,actor_customer_gid,'+
   'body_text,body_sha256,created_at_ms) '+
   'SELECT ?,?,COALESCE((SELECT MAX(reply_sequence) '+
   'FROM jill_work_contact_customer_replies WHERE shop=? AND ticket_id=?),0)+1,'+
   '?,?,?,?,? FROM jill_work_contact_tickets t '+
   'WHERE t.shop=? AND t.ticket_id=? AND t.owner_customer_gid=? '+
   'AND t.state IN (\'received\',\'reviewing\',\'waiting_customer\') '+
   'AND COALESCE((SELECT MAX(reply_sequence) '+
   'FROM jill_work_contact_customer_replies WHERE shop=? AND ticket_id=?),0)=? '+
   'AND ((SELECT COUNT(*) FROM jill_work_contact_messages m '+
   'WHERE m.shop=? AND m.ticket_id=?)+ '+
   '(SELECT COUNT(*) FROM jill_work_contact_customer_replies r '+
   'WHERE r.shop=? AND r.ticket_id=?))<50'
  ).bind(SHOP,data.ticket_id,SHOP,data.ticket_id,
   data.operation_id,gid,data.message,digest,at,
   SHOP,data.ticket_id,gid,SHOP,data.ticket_id,
   data.expected_reply_sequence,SHOP,data.ticket_id,
   SHOP,data.ticket_id).run();
  if(result?.success!==true||![0,1].includes(result?.meta?.changes))
   return respond(503,'source_unavailable');
  const persisted=await db.prepare(
   'SELECT ticket_id,reply_sequence,actor_customer_gid,body_sha256 '+
   'FROM jill_work_contact_customer_replies WHERE shop=? AND operation_id=?'
  ).bind(SHOP,data.operation_id).first();
  if(persisted?.ticket_id===data.ticket_id&&
     persisted?.actor_customer_gid===gid&&
     persisted?.body_sha256===digest&&
     persisted?.reply_sequence===data.expected_reply_sequence+1)
   return respond(200,result.meta.changes===1?'reply_saved':'already_persisted',{
    ticket_id:data.ticket_id,operation_id:data.operation_id,
    sequence:persisted.reply_sequence,
   });
  return respond(409,'reply_revision_changed');
 }catch{
  // No SQL, token, owner GID or private ticket data in public errors.
  return respond(503,'source_unavailable');
 }
}
