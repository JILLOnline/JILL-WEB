import http from 'node:http';
import Redis from 'ioredis';
import {createCustomOrderWorkProxyRoute} from '../../backend/custom-order-work-proxy-route.mjs';
import {createCustomOrderWorkRateLimiter} from './rate-limit.mjs';

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

export async function startWorkGateway(env=process.env,{createRedis}={}) {
  const settings=loadWorkGatewayConfig(env);
  const redis=createRedis
    ? createRedis(settings.redisUrl)
    : new Redis(settings.redisUrl,{
        lazyConnect:true,
        enableOfflineQueue:false,
        maxRetriesPerRequest:1,
        connectTimeout:5000,
        retryStrategy:()=>null,
      });
  try {
    if(typeof redis.connect==='function')await redis.connect();
    if(await redis.ping()!=='PONG')throw new Error('WORK Redis did not pass preflight.');
  } catch {
    if(typeof redis.disconnect==='function')redis.disconnect();
    throw new Error('WORK gateway cannot start without shared Redis.');
  }
  const rateLimit=createCustomOrderWorkRateLimiter(redis);
  const route=createCustomOrderWorkProxyRoute({
    shopifyAppSecret:settings.shopifyAppSecret,
    googleGatewaySecret:settings.googleGatewaySecret,
    googleQaEndpoint:settings.googleQaEndpoint,
    rateLimit,
  });
  const server=http.createServer((req,res)=>{
    void handleWorkGatewayHttp(req,res,{route,redis});
  });
  const port=Number(env.PORT||10000);
  if(!Number.isSafeInteger(port)||port<1||port>65535){
    if(typeof redis.disconnect==='function')redis.disconnect();
    throw new Error('Invalid WORK gateway listening port.');
  }
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'0.0.0.0',resolve);
  });
  // No credentials or user-supplied request details in logs.
  console.log('JILL Custom Orders WORK HTTPS upstream listening, health + signed proxy only.');
  const shutdown=()=>{
    server.close();
    if(typeof redis.disconnect==='function')redis.disconnect();
  };
  process.once('SIGTERM',shutdown);
  process.once('SIGINT',shutdown);
  return {server,redis};
}

if(process.argv[1] && import.meta.url===new URL(
    'file://'+process.argv[1].replace(/\\/g,'/')).href) {
  startWorkGateway().catch(()=>{
    console.error('JILL WORK gateway startup blocked by configuration or shared Redis.');
    process.exitCode=1;
  });
}
