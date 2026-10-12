import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {
  loadWorkGatewayConfig,handleWorkGatewayHttp,
} from '../services/custom-order-work-gateway/http-handler.mjs';
import {
  createCustomOrderWorkRateLimiter,RATE_LIMIT_LUA,
} from '../services/custom-order-work-gateway/rate-limit.mjs';
import {createCustomOrderWorkProxyRoute} from '../backend/custom-order-work-proxy-route.mjs';
import {createHmac} from 'node:crypto';

const qaUrl='https://script.google.com/macros/s/AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V/exec';
const config={
  SHOPIFY_WORK_APP_SECRET:'fake-shopify-app-secret-qa-at-least-32-chars',
  JILL_CUSTOM_ORDER_GATEWAY_SECRET:'fake-different-google-gateway-secret-qa-only',
  JILL_CUSTOM_ORDER_QA_BACKEND_URL:qaUrl,
  REDIS_URL:'redis://private-render-keyvalue:6379',
};
const local=loadWorkGatewayConfig(config);
assert.equal(local.googleQaEndpoint,qaUrl);
assert.throws(()=>loadWorkGatewayConfig({...config,SHOPIFY_WORK_APP_SECRET:''}),/Missing or incorrect/);
assert.throws(()=>loadWorkGatewayConfig({...config,
  SHOPIFY_WORK_APP_SECRET:config.JILL_CUSTOM_ORDER_GATEWAY_SECRET}),/Missing or incorrect/);
assert.throws(()=>loadWorkGatewayConfig({...config,
  JILL_CUSTOM_ORDER_QA_BACKEND_URL:'https://jillonlinestore.com/'}),/Missing or incorrect/);
assert.throws(()=>loadWorkGatewayConfig({...config,
  REDIS_URL:'https://public.example.com'}),/Missing or incorrect/);

const t=1791741600000;
const id='jill:12345678-abcd-4def-abcd-111111111111';
const raw=JSON.stringify({
  version:1,operation:'custom_order.submit',submission_id:id,
  submitted_at:'2026-10-11T18:00:00.000Z',customer:{email:'qa@example.invalid'},
  items:[{product_id:'123',quantity:1}],
});
const payload=new URLSearchParams({
  source:'JILL custom order',submission_id:id,submitted_at:'2026-10-11T18:00:00.000Z',
  email:'qa@example.invalid',raw_payload:raw,
}).toString();
function signedPath() {
  const params=new URLSearchParams({
    shop:'jill-work.myshopify.com',timestamp:String(t/1000),
    logged_in_customer_id:'',path_prefix:'/apps/jill-custom-order',
  });
  const canonical=[...params].map(([k,v])=>k+'='+v).sort().join('');
  params.set('signature',createHmac('sha256',config.SHOPIFY_WORK_APP_SECRET)
    .update(canonical).digest('hex'));
  return '/jill-custom-order-proxy?'+params.toString();
}
function serverReq(path,method='POST',body='',headers={}){
  const data=Buffer.isBuffer(body)?body:Buffer.from(body);
  const req=Readable.from(data.length?[data]:[]);
  req.url=path;req.method=method;
  req.headers={origin:'https://jill-work.myshopify.com',
    'x-forwarded-for':'203.0.113.7, 198.51.100.6',
    'content-type':'application/x-www-form-urlencoded',
    ...headers};
  return req;
}
function serverRes() {
  return {
    status:0,headers:{},body:'',
    writeHead(status,headers){this.status=status;this.headers=headers;},
    end(body){this.body=String(body||'');},
  };
}
const counters=new Map();
const redis={
  async ping(){return 'PONG';},
  async eval(script,count,shopKey,ipKey,ttl,maxShop,maxClient) {
    assert.equal(script,RATE_LIMIT_LUA);
    assert.equal(count,2);
    assert.ok(Number(ttl)>=60);
    const sh=(counters.get(shopKey)||0)+1, ip=(counters.get(ipKey)||0)+1;
    counters.set(shopKey,sh);counters.set(ipKey,ip);
    return sh>Number(maxShop)||ip>Number(maxClient)?0:1;
  },
};
const limiter=createCustomOrderWorkRateLimiter(redis,{now:()=>t,shopLimit:3,clientLimit:2});
const request=new Request('https://jill-work-gateway.internal'+signedPath(),{
  method:'POST',headers:{'x-forwarded-for':'203.0.113.7'},
});
assert.equal(await limiter({shop:'jill-work.myshopify.com',request}),true);
assert.equal(await limiter({shop:'jill-work.myshopify.com',request}),true);
assert.equal(await limiter({shop:'jill-work.myshopify.com',request}),false,
  'client rate cap must be enforced by shared Redis');
const newClient=new Request(request.url,{
  method:'POST',headers:{'x-forwarded-for':'203.0.113.8'},
});
assert.equal(await limiter({shop:'jill-work.myshopify.com',request:newClient}),false,
  'shop-wide cap must apply despite changing client IP');
assert.equal(await limiter({shop:'jqtdgr-1y.myshopify.com',request:newClient}),false);
assert.equal(counters.size,3);
await assert.rejects(createCustomOrderWorkRateLimiter({eval:async()=>{throw Error('Redis down');}})
  ({shop:'jill-work.myshopify.com',request}),/Redis down/);

const got=[];
const route=createCustomOrderWorkProxyRoute({
  shopifyAppSecret:config.SHOPIFY_WORK_APP_SECRET,
  googleGatewaySecret:config.JILL_CUSTOM_ORDER_GATEWAY_SECRET,
  googleQaEndpoint:qaUrl,
  now:()=>t,
  rateLimit:async()=>true,
  backendFetch:async(url,init)=>{
    assert.equal(url,qaUrl);
    const params=new URLSearchParams(init.body);
    got.push(params.has('jill_order_receipt')?'receipt':'submission');
    return new Response(JSON.stringify(params.has('jill_order_receipt')
      ? {operation:'custom_order.receipt.result',ok:true,submission_id:id,
          status:'received',revision:1}
      : {operation:'custom_order.submit.result',ok:true,submission_id:id,
          status:'received',duplicate:false}),{status:200});
  },
});
let res=serverRes();
await handleWorkGatewayHttp(serverReq('/healthz','GET'),res,{route,redis});
assert.equal(res.status,200);
assert.equal(JSON.parse(res.body).environment,'WORK_CUSTOM_ORDERS_QA');
res=serverRes();
await handleWorkGatewayHttp(serverReq('/healthz','GET'),res,{
  route,redis:{ping:async()=>{throw Error('Redis down');}},
});
assert.equal(res.status,503);
res=serverRes();
await handleWorkGatewayHttp(serverReq('/other','POST',payload),res,{route,redis});
assert.equal(res.status,404);
res=serverRes();
await handleWorkGatewayHttp(serverReq(signedPath(),'POST',payload),res,{route,redis});
assert.equal(res.status,200);
assert.equal(JSON.parse(res.body).verified,true);
assert.deepEqual(got,['submission','receipt']);
res=serverRes();
await handleWorkGatewayHttp(serverReq(signedPath(),'POST','x'.repeat(256*1024+1)),
  res,{route,redis});
assert.equal(res.status,413);
assert.equal(got.length,2,'oversized body must never reach Apps Script');
res=serverRes();
const forged=signedPath().replace('jill-work.myshopify.com','jqtdgr-1y.myshopify.com');
await handleWorkGatewayHttp(serverReq(forged,'POST',payload),res,{route,redis});
assert.equal(res.status,401);
assert.equal(got.length,2,'wrong shop must not reach Google');
res=serverRes();
await handleWorkGatewayHttp(serverReq(signedPath(),'POST',payload),
  res,{route:async()=>{throw Error('private-secret-do-not-show');},redis});
assert.equal(res.status,503);
assert.ok(!res.body.includes('private-secret-do-not-show'));

console.log('WORK Render HTTP gateway: signed POST, Google two-proof receipt, atomic Redis limits, health, size and failure paths passed.');
