import {URL} from 'node:url';

const MAX_BODY=256*1024;
const ROUTE='/jill-custom-order-proxy';
const noCache={'cache-control':'no-store','x-content-type-options':'nosniff'};

export function loadWorkGatewayConfig(env) {
  const required=[
    'SHOPIFY_WORK_APP_SECRET',
    'JILL_CUSTOM_ORDER_GATEWAY_SECRET',
    'JILL_CUSTOM_ORDER_QA_BACKEND_URL',
    'REDIS_URL',
  ];
  if(required.some(key=>!env[key]||typeof env[key]!=='string') ||
      env.SHOPIFY_WORK_APP_SECRET.length<32 ||
      env.JILL_CUSTOM_ORDER_GATEWAY_SECRET.length<32 ||
      env.SHOPIFY_WORK_APP_SECRET===env.JILL_CUSTOM_ORDER_GATEWAY_SECRET ||
      !/^rediss?:\/\//.test(env.REDIS_URL) ||
      !/^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/
        .test(env.JILL_CUSTOM_ORDER_QA_BACKEND_URL)) {
    throw new Error('Missing or incorrect private WORK gateway configuration.');
  }
  return Object.freeze({
    shopifyAppSecret:env.SHOPIFY_WORK_APP_SECRET,
    googleGatewaySecret:env.JILL_CUSTOM_ORDER_GATEWAY_SECRET,
    googleQaEndpoint:env.JILL_CUSTOM_ORDER_QA_BACKEND_URL,
    redisUrl:env.REDIS_URL,
  });
}

function writeResponse(res,status,body,headers={}) {
  res.writeHead(status,{...noCache,...headers});
  res.end(body);
}
export async function handleWorkGatewayHttp(req,res,{route,redis}) {
  const path=new URL(req.url||'/', 'https://jill-work-gateway.invalid');
  if(path.pathname==='/healthz' && req.method==='GET') {
    try {
      if(await redis.ping()!=='PONG')throw new Error('Redis unavailable');
      writeResponse(res,200,JSON.stringify({ok:true,environment:'WORK_CUSTOM_ORDERS_QA'}),
        {'content-type':'application/json; charset=utf-8'});
    } catch {
      writeResponse(res,503,JSON.stringify({ok:false}),
        {'content-type':'application/json; charset=utf-8'});
    }
    return;
  }
  if(path.pathname!==ROUTE || req.method!=='POST') {
    writeResponse(res,404,'Not found',{'content-type':'text/plain; charset=utf-8'});
    return;
  }
  let total=0;const chunks=[];
  try {
    for await(const chunk of req) {
      total+=chunk.length;
      if(total>MAX_BODY) {
        writeResponse(res,413,JSON.stringify({
          version:1,operation:'custom_order.submit.result',ok:false,
          error:{code:'payload_too_large',retryable:false},
        }),{'content-type':'application/json; charset=utf-8'});
        return;
      }
      chunks.push(chunk);
    }
    // Never forward untrusted public headers wholesale. The signed Shopify
    // query authenticates the shop, not the Host/Origin or client's IP.
    const headers=new Headers();
    for(const name of ['origin','x-forwarded-for','content-type']) {
      if(typeof req.headers[name]==='string')headers.set(name,req.headers[name]);
    }
    headers.set('content-length',String(total));
    const request=new Request('https://jill-work-gateway.internal'+
      (req.url||'/'),{
      method:'POST',headers,body:Buffer.concat(chunks,total),
    });
    const result=await route(request);
    const body=await result.text();
    writeResponse(res,result.status,body,{
      'content-type':'application/json; charset=utf-8',
    });
  } catch {
    // Never expose Shopify signatures, Google secrets, customer data or
    // raw upstream exceptions in the HTTP response or application logs.
    writeResponse(res,503,JSON.stringify({
      version:1,operation:'custom_order.submit.result',ok:false,
      error:{code:'gateway_unavailable',retryable:true},
    }),{'content-type':'application/json; charset=utf-8'});
  }
}

