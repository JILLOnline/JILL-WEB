// WORK-only planned Contact Us intake. NOT routed or deployed.
// The current storefront Shopify-native contact form remains unchanged.
// Authenticates Shopify app-proxy SHOP, not the individual Customer.
// Every accepted ticket is GUEST/unclaimed. A separate signed Shopify
// Customer Account flow is required before My JILL ownership may exist.
import {createHash} from 'node:crypto';
import {verifyShopifyAppProxyRequest}
 from './shopify-work-app-proxy-auth.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const REASONS=new Set(['existing','shipping','product','custom','pickup',
 'business','website','other']);
const PREFS=new Set(['Email','Phone']);
const MAX=8192;
const CLAIM=/^[A-Za-z0-9_-]{43}$/;
const DETAIL_KEYS=['order_number','product_name','business_name',
 'business_link','website_area','device','reference_images'];
const HEADERS={'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store','x-content-type-options':'nosniff'};
const respond=(status,code,extra={})=>new Response(JSON.stringify({
 version:1,operation:'jill.contact.intake.result',
 ok:status===200||status===201,code,...extra,
}),{status,headers:HEADERS});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validatedBody(x){
 if(!object(x))return null;
 const keys=['ticket_id','name','email','phone','reason','message',
   'preferred_contact','reviewed','claim_token'];
 if(keys.some(k=>!Object.hasOwn(x,k))||
    Object.keys(x).some(k=>!keys.includes(k)&&k!=='details')||
    !ID.test(x.ticket_id||'')||typeof x.name!=='string'||
    x.name.trim()!==x.name||x.name.length<1||x.name.length>120||
    typeof x.email!=='string'||x.email.length>254||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)||
    typeof x.phone!=='string'||x.phone.length>40||
    !REASONS.has(x.reason)||typeof x.message!=='string'||
    x.message.trim()!==x.message||x.message.length<1||
    x.message.length>3000||!PREFS.has(x.preferred_contact)||
    (x.preferred_contact==='Phone'&&x.phone.trim().length<3)||
    x.reviewed!==true||!CLAIM.test(x.claim_token||'')||
    Buffer.from(x.claim_token,'base64url').length!==32||
    Buffer.from(x.claim_token,'base64url').toString('base64url')!==x.claim_token)
    return null;
 const supplied=x.details===undefined?{}:x.details;
 if(!object(supplied)||Object.keys(supplied).some(k=>!DETAIL_KEYS.includes(k)))
  return null;
 const details={};
 for(const key of DETAIL_KEYS){
  const value=Object.hasOwn(supplied,key)?supplied[key]:'';
  if(typeof value!=='string'||value.length>200||
     value.trim()!==value)return null;
  details[key]=value;
 }
 // The existing Shopify form requires an order reference for existing
 // order / shipping inquiries. The reference is NOT owner authority.
 if(['existing','shipping'].includes(x.reason)&&
    details.order_number.length===0)return null;
 if(!['','Yes','No'].includes(details.reference_images))return null;
 return {ticket_id:x.ticket_id,name:x.name,email:x.email,
  phone:x.phone,reason:x.reason,message:x.message,
  preferred_contact:x.preferred_contact,reviewed:true,details,
  claim_token:x.claim_token};
}
async function boundedJson(request){
 const declared=request.headers.get('content-length');
 if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||
    Number(declared)>MAX))throw Error('invalid_length');
 const reader=request.body?.getReader();
 if(!reader)throw Error('empty_body');
 const chunks=[];let total=0;
 try {
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>MAX)throw Error('too_large');
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const buffer=new Uint8Array(total);let index=0;
 for(const part of chunks){buffer.set(part,index);index+=part.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));
}
export async function handleWorkContactTicketIntake({
 request,enabled=false,shopifyAppSecret,db,rateLimit,
 now=Date.now,
}={}){
 // Disabled returns before any auth, storage, quota, or contact content read.
 if(enabled!==true)return respond(503,'not_connected');
 if(request?.method!=='POST')return respond(405,'method_not_allowed');
 if(typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32||
    typeof db?.prepare!=='function'||typeof rateLimit!=='function'||
    typeof now!=='function')
  return respond(503,'source_unavailable');
 let shop;
 try{
  const signed=verifyShopifyAppProxyRequest(request,{
   appSecret:shopifyAppSecret,expectedShop:SHOP,now,
  });
  shop=signed.shop;
  if(new URL(request.url).protocol!=='https:' ||
     !['','https://jill-work.myshopify.com'].includes(
       request.headers.get('origin')||'') ||
     !/^application\/json(?:;|$)/i.test(
       request.headers.get('content-type')||''))
   return respond(400,'invalid_request');
 }catch{return respond(401,'unauthorized');}
 let permitted;
 try{permitted=await rateLimit({shop});}
 catch{return respond(503,'rate_limit_unavailable');}
 if(permitted!==true)return respond(429,'rate_limited');
 let record;
 try{record=validatedBody(await boundedJson(request));}
 catch{return respond(400,'invalid_request');}
 if(!record)return respond(400,'invalid_request');
 const time=now();
 if(!Number.isSafeInteger(time)||time<=0)return respond(503,'invalid_clock');
 // The server deliberately DOES NOT use Shopify's signed but unverified
 // logged_in_customer_id to bind this ticket to a Customer Account.
 const {claim_token,...storedRecord}=record;
 const json=JSON.stringify(storedRecord);
 if(Buffer.byteLength(json,'utf8')>MAX)return respond(400,'invalid_request');
 const digest=createHash('sha256').update(
  'jill_work_contact_ticket_v1\n'+json,'utf8').digest('hex');
 const claimHash=createHash('sha256').update(
  'jill_work_contact_claim_v1\n'+claim_token,'utf8').digest('hex');
 try{
  const result=await db.prepare(
   'INSERT OR IGNORE INTO jill_work_contact_tickets '+
   '(shop,ticket_id,source,body_sha256,claim_sha256,contact_json,state,revision,'+
   'created_at_ms,updated_at_ms,owner_customer_gid) '+
   "VALUES (?,?,'shopify_contact_bridge',?,?,?,'received',1,?,?,NULL)"
  ).bind(SHOP,record.ticket_id,digest,claimHash,json,time,time).run();
  if(result?.success!==true)return respond(503,'source_unavailable');
  const stored=await db.prepare(
   'SELECT source,body_sha256,claim_sha256,owner_customer_gid,state '+
   'FROM jill_work_contact_tickets WHERE shop=? AND ticket_id=?'
  ).bind(SHOP,record.ticket_id).first();
  if(!stored||stored.source!=='shopify_contact_bridge'||
     stored.body_sha256!==digest||stored.claim_sha256!==claimHash)
   return respond(409,'ticket_conflict');
  return respond(result?.meta?.changes===1?201:200,
    result?.meta?.changes===1?'received':'already_received',
    {ticket_id:record.ticket_id});
 }catch{return respond(503,'source_unavailable');}
}
