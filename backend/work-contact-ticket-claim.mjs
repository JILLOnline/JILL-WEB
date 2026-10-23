// WORK My JILL Contact ticket ownership claim — SOURCE ONLY, hard OFF.
// Possession of a 256-bit form receipt code AND a verified Shopify customer
// JWT is necessary. Email, phone, Shopify app-proxy customer ID and a mere
// ticket_id must NEVER attach a guest inquiry to an account.
import {createHash,timingSafeEqual} from 'node:crypto';
import {verifyWorkCustomerAccountSession}
 from './customer-account-work-session.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const MAX=512;
const MAX_AGE_MS=90*24*60*60*1000;
const HEADER={'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'POST, OPTIONS',
 'access-control-allow-headers':'Authorization, Content-Type'};
const respond=(status,code,more={})=>Response.json({
 version:1,operation:'jill.contact.account.claim.result',
 ok:status===200,code,...more,
},{status,headers:HEADER});
function hash(token){
 return createHash('sha256')
  .update('jill_work_contact_claim_v1\n'+token,'utf8').digest('hex');
}
function sameDigest(a,b){
 if(typeof a!=='string'||!/^[0-9a-f]{64}$/.test(a))return false;
 const aa=Buffer.from(a,'hex'),bb=Buffer.from(b,'hex');
 return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
async function readSmallJson(request){
 const declared=request.headers.get('content-length');
 if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||
  Number(declared)>MAX))throw Error('invalid');
 const reader=request.body?.getReader();
 if(!reader)throw Error('invalid');
 let total=0;const chunks=[];
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>MAX)throw Error('invalid');
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const x of chunks){bytes.set(x,offset);offset+=x.byteLength;}
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).length!==2||
    !Object.hasOwn(data,'ticket_id')||!Object.hasOwn(data,'claim_token')||
    !ID.test(data.ticket_id||'')||!TOKEN.test(data.claim_token||'')||
    Buffer.from(data.claim_token,'base64url').length!==32||
    Buffer.from(data.claim_token,'base64url').toString('base64url')!==data.claim_token)
   throw Error('invalid');
 return data;
}
/** @param {{
 * request?:Request,enabled?:boolean,shopifyAppSecret?:string,db?:any,
 * rateLimit?:(x:{shop:string,customer:string})=>Promise<boolean>,
 * now?:()=>number
 * }} [options]
 */
export async function handleWorkContactTicketClaim({
 request,enabled=false,shopifyAppSecret,db,rateLimit,now=Date.now,
}={}){
 // OFF before session parsing, reading private codes or D1 mutations.
 if(enabled!==true)return respond(503,'not_connected');
 if(request?.method==='OPTIONS')return new Response(null,{
  status:204,headers:HEADER});
 if(request?.method!=='POST')return respond(405,'method_not_allowed');
 if(typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32||
    typeof db?.prepare!=='function'||typeof rateLimit!=='function'||
    typeof now!=='function')return respond(503,'source_unavailable');
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>8300)
  return respond(401,'unauthenticated_account');
 const clock=now();
 if(!Number.isSafeInteger(clock)||clock<1600000000000)
  return respond(503,'source_unavailable');
 let identity;
 try{
  identity=verifyWorkCustomerAccountSession(auth.slice(7),{
   appSecret:shopifyAppSecret,now:()=>clock,
  });
  if(identity.shop!==SHOP||!GID.test(identity.customerGid||''))
   return respond(401,'unauthenticated_account');
 }catch{return respond(401,'unauthenticated_account');}
 if(!/^application\/json(?:;|$)/i.test(
   request.headers.get('content-type')||''))
  return respond(400,'invalid_request');
 let permitted;
 try{permitted=await rateLimit({shop:SHOP,customer:identity.customerGid});}
 catch{return respond(503,'rate_limit_unavailable');}
 if(permitted!==true)return respond(429,'rate_limited');
 let data;
 try{data=await readSmallJson(request);}
 catch{return respond(400,'invalid_request');}
 const digest=hash(data.claim_token);
 const cutoff=clock-MAX_AGE_MS;
 try{
  // Single conditional D1 mutation: in races ONLY ONE account wins.
  // The capability and ticket are exact; no email lookup or owner POST.
  const updated=await db.prepare(
   'UPDATE jill_work_contact_tickets SET owner_customer_gid=? '+
   'WHERE shop=? AND ticket_id=? AND owner_customer_gid IS NULL '+
   'AND claim_sha256=? AND created_at_ms>=?'
  ).bind(identity.customerGid,SHOP,data.ticket_id,digest,cutoff).run();
  if(updated?.success!==true)
   return respond(503,'source_unavailable');
  if(updated.meta?.changes===1)
   return respond(200,'claimed',{ticket_id:data.ticket_id});
  if(updated.meta?.changes!==0)
   return respond(503,'source_unavailable');
  // Retry after a lost ACK: only SAME signed customer + SAME secret.
  const row=await db.prepare(
   'SELECT owner_customer_gid,claim_sha256,created_at_ms '+
   'FROM jill_work_contact_tickets WHERE shop=? AND ticket_id=?'
  ).bind(SHOP,data.ticket_id).first();
  if(row?.owner_customer_gid===identity.customerGid&&
     Number.isSafeInteger(row.created_at_ms)&&
     row.created_at_ms>=cutoff&&sameDigest(row.claim_sha256,digest))
   return respond(200,'already_claimed',{ticket_id:data.ticket_id});
  // No account existence or email information in this failure.
  return respond(409,'claim_unverified');
 }catch{return respond(503,'source_unavailable');}
}
