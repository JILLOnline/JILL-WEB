// My JILL WORK Contact Us account reader, SOURCE ONLY.
// A verified Shopify Customer Account JWT selects exact D1 owner GIDs;
// contact[email], storefront Liquid customer hints and typed order numbers
// are NOT authority. This route remains hard OFF until a separate, signed
// Contact ticket claim and D1 migration are certified. No private bodies.
import {verifyWorkCustomerAccountSession}
 from './customer-account-work-session.mjs';
import {hasEmptyHttpBody} from './empty-http-body.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const REASONS=new Set(['existing','shipping','product','custom',
 'pickup','business','website','other']);
const STATUS=new Set(['received','reviewing','waiting_customer','resolved']);
const HEADERS={'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'POST, OPTIONS',
 'access-control-allow-headers':'Authorization, Content-Type'};
const reply=(status,code,extra={})=>Response.json({
 version:1,operation:'jill.contact.account.list.result',
 ok:status===200,shop:SHOP,code,...extra,
},{status,headers:HEADERS});
const validMs=v=>Number.isSafeInteger(v)&&v>=1600000000000;
const timestamp=v=>{
 if(!validMs(v))throw Error('contact_timestamp_unverified');
 return new Date(v).toISOString();
};
export function projectVerifiedCustomerContactTickets(rows,customerGid){
 if(!GID.test(customerGid||'')||!Array.isArray(rows)||
    rows.length>20)throw Error('contact_account_unverified');
 const seen=new Set();
 return Object.freeze(rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||
     row.owner_customer_gid!==customerGid||
     !ID.test(row.ticket_id||'')||seen.has(row.ticket_id)||
     !Number.isSafeInteger(row.revision)||row.revision<1||
     row.revision>100||!REASONS.has(row.reason)||
     !STATUS.has(row.state)||!validMs(row.created_at_ms)||
     !validMs(row.updated_at_ms)||
     row.updated_at_ms<row.created_at_ms)
    throw Error('contact_account_unverified');
  seen.add(row.ticket_id);
  return Object.freeze({
   ticket_id:row.ticket_id,revision:row.revision,
   reason:row.reason,status:row.state,
   created_at:timestamp(row.created_at_ms),
   updated_at:timestamp(row.updated_at_ms),
   thread_version:1,reply_enabled:false,
  });
 }));
}
/** @param {{
 * request?:Request,enabled?:boolean,shopifyAppSecret?:string,
 * db?:any,rateLimit?:(x:{shop:string,customer:string})=>Promise<boolean>,
 * now?:()=>number
 * }} [options]
 */
export async function handleWorkContactAccountRead({
 request,enabled=false,shopifyAppSecret,db,rateLimit,now=Date.now,
}={}){
 // OFF before any request-body/session/D1/rate-limit operation.
 if(enabled!==true)return reply(503,'not_connected');
 if(request?.method==='OPTIONS')return new Response(null,{status:204,
  headers:HEADERS});
 if(request?.method!=='POST')return reply(405,'method_not_allowed');
 if(typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32||
    typeof db?.prepare!=='function'||typeof rateLimit!=='function'||
    typeof now!=='function')return reply(503,'source_unavailable');
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^[0-9]{1,9}$/.test(length)||Number(length)>0))
  return reply(400,'invalid_request');
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>8300)
  return reply(401,'unauthenticated_account');
 let identity;
 try{
  identity=verifyWorkCustomerAccountSession(auth.slice(7),{
   appSecret:shopifyAppSecret,now,
  });
  if(identity.shop!==SHOP||!GID.test(identity.customerGid||''))
    return reply(401,'unauthenticated_account');
 }catch{return reply(401,'unauthenticated_account');}
 if(!await hasEmptyHttpBody(request))return reply(400,'invalid_request');
 let allowed;
 try{allowed=await rateLimit({shop:SHOP,customer:identity.customerGid});}
 catch{return reply(503,'rate_limit_unavailable');}
 if(allowed!==true)return reply(429,'rate_limited');
 try{
  const response=await db.prepare(
   'SELECT ticket_id,state,revision,created_at_ms,updated_at_ms,'+
   "json_extract(contact_json,'$.reason') AS reason,"+
   'owner_customer_gid FROM jill_work_contact_tickets '+
   'WHERE shop=? AND owner_customer_gid=? '+
   'ORDER BY updated_at_ms DESC LIMIT 21'
  ).bind(SHOP,identity.customerGid).all();
  if(!Array.isArray(response?.results)||response.results.length>20)
   return reply(503,'contact_source_unverified');
  const tickets=projectVerifiedCustomerContactTickets(
    response.results,identity.customerGid);
  return reply(200,'ready',{tickets});
 }catch{return reply(503,'contact_source_unavailable');}
}
