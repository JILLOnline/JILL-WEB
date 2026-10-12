import {createHash} from 'node:crypto';
import {createCustomOrderWorkProxyRoute} from '../../backend/custom-order-work-proxy-route.mjs';

const MAX_BYTES=256*1024;
const ROUTE='/jill-custom-order-proxy';
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
      return reply(200,{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'});
    } catch {
      return reply(503,{ok:false});
    }
  }
  // Shopify may append "/" to the app-proxy destination when the
  // storefront requests /apps/jill-custom-order. Treat only these two
  // exact root spellings as the same route; never accept child paths,
  // lookalike suffixes, or unrelated endpoints.
  if((pathname!==ROUTE && pathname!==ROUTE+'/') || request.method!=='POST') {
    // Temporary WORK-only routing diagnostic. Never expose the signed
    // query string, client headers, body, customer data or any secret.
    // Only reflect a short, strictly sanitized pathname to the caller.
    const observed=/^\\/[A-Za-z0-9/_-]{0,159}$/.test(pathname)
      ? pathname : 'redacted';
    return reply(404,{ok:false,error:'not_found',
      work_route_diagnostic:{method:request.method,path:observed}});
  }
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
