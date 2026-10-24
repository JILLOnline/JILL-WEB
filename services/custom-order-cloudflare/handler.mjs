import {createHash} from 'node:crypto';
import {createCustomOrderWorkProxyRoute} from '../../backend/custom-order-work-proxy-route.mjs';
import {handleCustomOrderGatewayDiagnostic} from '../../backend/custom-order-gateway.mjs';
import {handleWorkCustomOrderAccountRead} from '../../backend/custom-order-account-read.mjs';
import {handleWorkCustomerReply} from '../../backend/custom-order-conversation.mjs';
import {handleWorkContactTicketIntake} from '../../backend/work-contact-ticket-intake.mjs';
import {handleWorkContactAccountRead} from '../../backend/work-contact-account-read.mjs';
import {handleWorkContactTicketClaim} from '../../backend/work-contact-ticket-claim.mjs';
import {readWorkCustomerContactThread} from '../../backend/work-contact-thread-read.mjs';
import {persistWorkCustomerContactReply}
 from '../../backend/work-contact-customer-reply.mjs';
import {readWorkContactConversationV2}
 from '../../backend/work-contact-conversation-v2.mjs';

const MAX_BYTES=256*1024;
const ROUTE='/jill-custom-order-proxy';
const CONTACT_ROUTE=ROUTE+'/contact';
// This is a non-sensitive deployment identifier, read from Cloudflare itself.
// NEVER derive attribution from the caller's version override header.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const VERSION_PROBE='jill_work_version_probe';
const VERSION_HEADER='x-jill-work-gateway-version';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'};

function reply(status,body) {
  return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
}
function config(env) {
  const shopifyAppSecret=env?.SHOPIFY_WORK_APP_SECRET;
  const googleGatewaySecret=env?.JILL_CUSTOM_ORDER_GATEWAY_SECRET;
  const googleQaEndpoint=env?.JILL_CUSTOM_ORDER_QA_BACKEND_URL;
  if(typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32 ||
     typeof googleGatewaySecret!=='string'||googleGatewaySecret.length<32 ||
     googleGatewaySecret===shopifyAppSecret ||
     !/^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/.test(googleQaEndpoint||'') ||
     typeof env?.RATE_LIMITER?.getByName!=='function') {
    throw new Error('Missing or invalid WORK Cloudflare private configuration.');
  }
  return {shopifyAppSecret,googleGatewaySecret,googleQaEndpoint};
}
async function boundedRequest(request) {
  const declared=Number(request.headers.get('content-length')||0);
  if(!Number.isFinite(declared)||declared<0||declared>MAX_BYTES)
    throw new Error('oversized');
  let size=0;const chunks=[];
  if(request.body) {
    const reader=request.body.getReader();
    try {
      while(true) {
        const {value,done}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>MAX_BYTES)throw new Error('oversized');
        chunks.push(value);
      }
    } finally {reader.releaseLock();}
  }
  const body=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  const headers=new Headers(request.headers);
  headers.set('content-length',String(size));
  return new Request(request.url,{method:'POST',headers,body});
}

// Contact Us never binds the public gateway to HQ D1. The only future
// provider connection is an explicit WORK-only named-entrypoint binding;
// until it is reviewed, installed and BOTH Workers' flags are enabled,
// these routes refuse without touching a customer record.
const CONTACT_MAX_BYTES=8192;
async function forwardContactToPrivateHq(request,env){
 const service=env?.JILL_WORK_HQ_CONTACT_PRIVATE;
 if(typeof service?.fetch!=='function'||
    typeof env?.RATE_LIMITER?.getByName!=='function')
  return reply(503,{ok:false,error:'contact_unavailable'});
 // For account OPTIONS, let HQ's exact handler decide the CORS contract.
 if(request.method==='POST'){
  let permitted;
  try{
   permitted=await env.RATE_LIMITER
    .getByName('jill-work-custom-orders-global').allow({
     shop:'jill-work.myshopify.com',client:clientId(request),
     minute:Math.floor(Date.now()/60000),
    });
  }catch{return reply(503,{ok:false,error:'contact_unavailable'});}
  if(permitted!==true)return reply(429,{ok:false,error:'rate_limited'});
 }
 let forwarded;
 try{
  // Never pass caller-supplied IP, cookies or arbitrary forwarding headers
  // to the privileged private HQ runtime.
  const headers=new Headers();
  for(const key of ['authorization','content-type','origin']){
   const val=request.headers.get(key);
   if(val!==null)headers.set(key,val);
  }
  let body;
  if(request.method==='POST'){
   // Account list POST legitimately has no payload; others must have JSON.
   const emptyList=new URL(request.url).pathname==='/jill-contact-account';
   const declared=request.headers.get('content-length');
   if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||
     Number(declared)>CONTACT_MAX_BYTES))
    return reply(413,{ok:false,error:'contact_payload_too_large'});
   const reader=request.body?.getReader();
   if(!reader&&!emptyList)return reply(400,{ok:false,error:'contact_invalid_body'});
   const chunks=[];let n=0;
   if(reader){
    try{
     while(true){
      const {value,done}=await reader.read();
      if(done)break;
      n+=value.byteLength;
      if(n>CONTACT_MAX_BYTES)
       return reply(413,{ok:false,error:'contact_payload_too_large'});
      chunks.push(value);
     }
    }finally{reader.releaseLock();}
   }
   if(n===0&&!emptyList)return reply(400,{ok:false,error:'contact_invalid_body'});
   if(n>0){
    body=new Uint8Array(n);
    let pos=0;
    for(const chunk of chunks){body.set(chunk,pos);pos+=chunk.length;}
   }
  }
  forwarded=new Request(request.url,{
   method:request.method,headers,
   ...(body?{body}:{}),
  });
 }catch{return reply(400,{ok:false,error:'contact_invalid_body'});}
 try{
  const result=await service.fetch(forwarded);
  if(!(result instanceof Response))
   return reply(503,{ok:false,error:'contact_unavailable'});
  return result;
 }catch{return reply(503,{ok:false,error:'contact_unavailable'});}
}

function clientId(request) {
  // CF-Connecting-IP is Cloudflare-managed on incoming HTTP requests.
  // Its value only subdivides the global shop quota, never grants access.
  // Global quota still applies to every request even if IP is unknown.
  const ip=request.headers.get('cf-connecting-ip')||'';
  if(ip.length<3||ip.length>64)return 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0,32);
}
export async function handleCloudflareCustomOrderWork(request,env) {
  const pathname=new URL(request.url).pathname;
  if(pathname==='/healthz' && request.method==='GET') {
    try {
      config(env);
      const stub=env.RATE_LIMITER.getByName('jill-work-custom-orders-global');
      if(await stub.ping()!==true)throw Error('limiter unavailable');
      const result=reply(200,{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'});
      const query=new URL(request.url).searchParams;
      // An opt-in GET-only probe preserves the ordinary health contract.
      // The *running* Worker version must supply the ID; client headers
      // and the code's compiled version must never be trusted as evidence.
      if(query.has(VERSION_PROBE)) {
        const values=query.getAll(VERSION_PROBE);
        const version=env?.CF_VERSION_METADATA?.id;
        if(query.size!==1||values.length!==1||!UUID.test(values[0])||
           typeof version!=='string'||!UUID.test(version))
          return reply(503,{ok:false});
        result.headers.set(VERSION_HEADER,version);
      }
      return result;
    } catch {
      return reply(503,{ok:false});
    }
  }
  if(pathname==='/jill-work-gateway-diagnostic') {
    let settings;
    try {settings=config(env);}
    catch {return reply(503,{ok:false,code:'diagnostic_unverified'});}
    const result=await handleCustomOrderGatewayDiagnostic({
      request,receiptSecret:settings.googleGatewaySecret,
      appsScriptEndpoint:settings.googleQaEndpoint,
      rateLimit:async()=>{
        const limiter=env.RATE_LIMITER.getByName('jill-work-custom-orders-global');
        return limiter.allow({shop:'jill-work.myshopify.com',
          client:clientId(request),minute:Math.floor(Date.now()/60000)});
      },
    });
    const version=env?.CF_VERSION_METADATA?.id;
    if(typeof version==='string'&&UUID.test(version))
      result.headers.set(VERSION_HEADER,version);
    return result;
  }
  // Account claims never use email; the private HQ service owns the D1
  // and remains independently hard-OFF until Customer A/B/guest acceptance.
  if(pathname==='/jill-contact-claim'){
    if(env?.JILL_WORK_CONTACT_CLAIM_ENABLED!=='true')
      return handleWorkContactTicketClaim({request,enabled:false});
    return forwardContactToPrivateHq(request,env);
  }
  // Exact signed customer account + claimed contact owner is REQUIRED.
  // This route is separate from Shopify public app-proxy submissions and
  // remains hard OFF until D1 and customer A/B integration are certified.
  if(pathname==='/jill-contact-thread'){
    if(env?.JILL_WORK_CONTACT_THREAD_ENABLED!=='true')
      return readWorkCustomerContactThread({request,enabled:false});
    return forwardContactToPrivateHq(request,env);
  }
  // Customer-authored Contact replies are a separate private D1 ledger.
  // Even if other Contact features are ON, this remains hard OFF unless
  // its own explicit WORK-only gateway and HQ flags are commissioned.
  if(pathname==='/jill-contact-reply'){
    if(env?.JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED!=='true')
      return persistWorkCustomerContactReply({request,enabled:false});
    return forwardContactToPrivateHq(request,env);
  }
  if(pathname==='/jill-contact-conversation-v2'){
    if(env?.JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED!=='true'||
       env?.JILL_WORK_CONTACT_THREAD_ENABLED!=='true')
      return readWorkContactConversationV2({request,enabled:false});
    return forwardContactToPrivateHq(request,env);
  }
  // A separate signed Shopify Customer Account JWT is the ONLY owner
  // authority for My JILL Contact Requests. No D1 binding exists here.
  if(pathname==='/jill-contact-account'){
    if(env?.JILL_WORK_CONTACT_ACCOUNT_ENABLED!=='true')
      return handleWorkContactAccountRead({request,enabled:false});
    return forwardContactToPrivateHq(request,env);
  }
  // Account reads are a distinct, bearer-JWT-authenticated endpoint.
  // Unlike Shopify app-proxy submissions, extension fetches do NOT pass
  // through the storefront and may originate in a null-origin sandbox.
  if(pathname==='/jill-custom-order-account') {
    let settings;
    try {settings=config(env);}
    catch {return handleWorkCustomOrderAccountRead(request,{});}
    try {
      const limiter=env.RATE_LIMITER.getByName('jill-work-custom-orders-global');
      return await handleWorkCustomOrderAccountRead(request,{
        ...settings,
        shopifyAppSecret:settings.shopifyAppSecret,
        googleGatewaySecret:settings.googleGatewaySecret,
        googleQaEndpoint:settings.googleQaEndpoint,
        rateLimit:async({shop})=>limiter.allow({
          shop,client:clientId(request),minute:Math.floor(Date.now()/60000),
        }),
      });
    } catch {
      return handleWorkCustomOrderAccountRead(request,{});
    }
  }
  if(pathname==='/jill-custom-order-reply') {
    let settings;
    try{settings=config(env);}catch{return handleWorkCustomerReply(request,{});}
    return handleWorkCustomerReply(request,{
      ...settings,enabled:env.JILL_WORK_CONVERSATION_ENABLED==='true',
      rateLimit:async({shop})=>env.RATE_LIMITER
        .getByName('jill-work-custom-orders-global').allow({
          shop,client:clientId(request),minute:Math.floor(Date.now()/60000)}),
    });
  }
  // WORK Contact Us candidate: a distinct signed Shopify app-proxy child.
  // HARD OFF until the private HQ binding, dual flags, quotas and signed
  // Customer Account acceptance are certified. Native Contact Us unchanged.
  if(pathname===CONTACT_ROUTE && request.method==='POST') {
    if(env?.JILL_WORK_CONTACT_INTAKE_ENABLED!=='true')
      return handleWorkContactTicketIntake({request,enabled:false});
    return forwardContactToPrivateHq(request,env);
  }
  // Shopify may append "/" to the app-proxy destination when the
  // storefront requests /apps/jill-custom-order. Treat only these two
  // exact root spellings as the same route; never accept child paths,
  // lookalike suffixes, or unrelated endpoints.
  if((pathname!==ROUTE && pathname!==ROUTE+'/') || request.method!=='POST')
    return reply(404,{ok:false,error:'not_found'});
  let settings;
  try {settings=config(env);}
  catch {return reply(503,{ok:false,error:'gateway_unavailable'});}
  let verified;
  try {verified=await boundedRequest(request);}
  catch{return reply(413,{ok:false,error:'payload_too_large'});}
  try {
    const limiter=env.RATE_LIMITER.getByName('jill-work-custom-orders-global');
    const route=createCustomOrderWorkProxyRoute({
      ...settings,rateLimit:async({shop})=>limiter.allow({
        shop,client:clientId(request),minute:Math.floor(Date.now()/60000),
      }),
    });
    return await route(verified);
  } catch {
    // Fail closed. Never leak secrets, signed parameters or customer payloads.
    return reply(503,{ok:false,error:'gateway_unavailable'});
  }
}
