import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {
  handleWorkCustomOrderAccountRead,onlyPublicCustomOrderProjection,
} from '../backend/custom-order-account-read.mjs';
import {handleCloudflareCustomOrderWork} from '../services/custom-order-cloudflare/handler.mjs';

const shopifySecret='shopify-work-test-secret-not-a-real-key-of-length-42';
const googleSecret='google-qa-gateway-test-secret-completely-distinct';
const t=1791800000;
const opts={
  shopifyAppSecret:shopifySecret,googleGatewaySecret:googleSecret,
  googleQaEndpoint:'https://script.google.com/macros/s/AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V/exec',
  now:()=>t*1000,
  rateLimit:async()=>true,
};
const claims={
  aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
  dest:'jill-work.myshopify.com',
  sub:'gid://shopify/Customer/111',
  iat:t-60,nbf:t-60,exp:t+240,jti:'unique-test-session-qa-123',
};
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function jwt(payload=claims) {
  const signed=enc({alg:'HS256',typ:'JWT'})+'.'+enc(payload);
  return signed+'.'+createHmac('sha256',shopifySecret)
    .update(signed).digest('base64url');
}
const path='https://qa.workers.dev/jill-custom-order-account';
function req(token=jwt(),body='') {
  return new Request(path,{method:'POST',
    headers:{'authorization':'Bearer '+token,'content-type':'application/json'},
    body, // Model the real extension's explicit empty-string POST body.
  });
}
const publicOrder={
  submission_id:'jill:qa:order-111',revision:2,status:'reviewing',
  summary:{items:[{title:'Coloring Books',quantity:1}],
    date_needed:'2026-10-30',fulfillment:'pickup'},
  updated_at:'2026-10-12T19:00:00.000Z',
  timeline:[
    {status:'received',note:'',occurred_at:'2026-10-12T18:00:00.000Z'},
    {status:'reviewing',note:'We are reviewing your request.',
      occurred_at:'2026-10-12T19:00:00.000Z'},
  ],
};
const withSecrets={
  ...publicOrder,
  internal_note:'NEVER RETURN TO CUSTOMER',
  customer_email:'another-person@example.test',
  evidence_ref:'private-evidence',
  timeline:publicOrder.timeline.map(x=>({...x,internal_note:'HIDDEN'})),
};
const safe=onlyPublicCustomOrderProjection([withSecrets]);
assert.deepEqual(safe,[publicOrder],'only the customer public projection may leave Cloudflare');
assert.equal(JSON.stringify(safe).includes('NEVER'),false);
assert.equal(JSON.stringify(safe).includes('HIDDEN'),false);
assert.equal(JSON.stringify(safe).includes('another-person'),false);
assert.deepEqual(safe[0].summary,publicOrder.summary);
assert.throws(()=>onlyPublicCustomOrderProjection([{
  ...publicOrder,summary:{...publicOrder.summary,
    items:[{title:'private',quantity:0}]}
}]),/summary|item/);
assert.throws(()=>onlyPublicCustomOrderProjection([{
  ...publicOrder,summary:{...publicOrder.summary,date_needed:'bad'}
}]),/summary/);
assert.throws(()=>onlyPublicCustomOrderProjection([{...publicOrder,revision:3}]),/projection/);
assert.throws(()=>onlyPublicCustomOrderProjection([publicOrder,publicOrder]),/projection/);
assert.throws(()=>onlyPublicCustomOrderProjection([{...publicOrder,timeline:[]}]),/projection/);
assert.throws(()=>onlyPublicCustomOrderProjection([{...publicOrder,status:'internal'}]),/projection/);
assert.throws(()=>onlyPublicCustomOrderProjection([{...publicOrder,updated_at:'not a date'}]),/timeline|date/);

let called=0;
async function fakeGoogle(url,init) {
  called++;
  assert.equal(url,opts.googleQaEndpoint);
  assert.equal(init.method,'POST');
  const body=new URLSearchParams(init.body);
  assert.equal(body.get('jill_order_customer_list'),'1');
  assert.equal(body.get('submission_id'),'jill:account-orders');
  const owner=body.get('jill_order_owner_gid');
  assert.match(owner,/^gid:\/\/shopify\/Customer\/(111|222)$/);
  const expected=createHmac('sha256',googleSecret).update([
    'customer_list','jill:account-orders',body.get('jill_order_gateway_ts'),owner,
  ].join('\n')).digest('hex');
  assert.equal(body.get('jill_order_gateway_sig'),expected,
    'backend can only read user specified by signed server-derived sub');
  const orders=owner.endsWith('/111')?[withSecrets]:[];
  return new Response(JSON.stringify({
    version:1,operation:'custom_order.account.list.result',ok:true,orders,
  }),{status:200});
}
const success=await handleWorkCustomOrderAccountRead(req(),{
  ...opts,backendFetch:fakeGoogle,
});
assert.equal(success.status,200);
assert.equal(success.headers.get('access-control-allow-origin'),'*');
assert.match(success.headers.get('cache-control'),/no-store/);
const response=await success.json();
assert.deepEqual(response.orders,[publicOrder]);
assert.equal(called,1);
const another=await handleWorkCustomOrderAccountRead(
  req(jwt({...claims,sub:'gid://shopify/Customer/222'})),
  {...opts,backendFetch:fakeGoogle},
);
assert.equal(another.status,200);
assert.deepEqual((await another.json()).orders,[],
  'Customer B never receives Customer A data');
assert.equal(called,2);

async function denied(request,expected,overrides={}) {
  const result=await handleWorkCustomOrderAccountRead(request,{
    ...opts,backendFetch:fakeGoogle,...overrides,
  });
  assert.equal(result.status,expected);
  assert.equal(result.headers.get('access-control-allow-origin'),'*');
  return result.json();
}
await denied(req(jwt({...claims,sub:''})),401);
await denied(req(jwt({...claims,sub:'gid://shopify/Customer/333',
  dest:'jqtdgr-1y.myshopify.com'})),401);
await denied(req(jwt({...claims,aud:'ebf1a69d82f46619d2f2945faab78afa'})),401);
await denied(req(jwt({...claims,exp:t-1})),401);
await denied(new Request(path,{method:'POST'}),401);
await denied(req(jwt().slice(0,-1)+'z'),401);
await denied(req(jwt(),JSON.stringify({customer_id:'222'})),400);
await denied(req(jwt(),JSON.stringify({submission_id:publicOrder.submission_id})),400);
await denied(req(),429,{rateLimit:async()=>false});
await denied(req(),503,{rateLimit:async()=>{throw Error('down');}});
await denied(req(),503,{backendFetch:async()=>new Response('{}',{status:502})});
await denied(req(),503,{backendFetch:async()=>new Response(JSON.stringify({
  version:1,operation:'custom_order.account.list.result',ok:false,
}),{status:200})});
await denied(req(),503,{backendFetch:async()=>new Response(JSON.stringify({
  version:1,operation:'custom_order.account.list.result',ok:true,
  orders:[{...publicOrder,revision:1,internal_status:'needs_quote'}],
}),{status:200})});
assert.equal(called,2,'denied token/payload/rate limit never calls Google');
const preflight=await handleWorkCustomOrderAccountRead(
  new Request(path,{method:'OPTIONS'}),{});
assert.equal(preflight.status,204);
assert.equal(preflight.headers.get('access-control-allow-headers'),
  'Authorization, Content-Type');
assert.equal((await handleWorkCustomOrderAccountRead(
  new Request(path),opts)).status,405);
// Real Cloudflare router must never expose private routes through the
// storefront app-proxy path, guest GET, or wrong account route.
const workerEnv={
  SHOPIFY_WORK_APP_SECRET:shopifySecret,
  JILL_CUSTOM_ORDER_GATEWAY_SECRET:googleSecret,
  JILL_CUSTOM_ORDER_QA_BACKEND_URL:opts.googleQaEndpoint,
  RATE_LIMITER:{getByName:()=>({allow:async()=>true})},
};
const workerReply=await handleCloudflareCustomOrderWork(
  new Request(path,{method:'POST'}),workerEnv);
assert.equal(workerReply.status,401);
assert.equal(workerReply.headers.get('access-control-allow-origin'),'*');
const unrelated=await handleCloudflareCustomOrderWork(
  new Request(path+'/another'),workerEnv);
assert.equal(unrelated.status,404);
console.log('WORK private account reader JWT, scoped signed Google ownership, cross-customer privacy, CORS and fail-closed tests passed.');
