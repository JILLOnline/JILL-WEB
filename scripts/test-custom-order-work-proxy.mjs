import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyShopifyAppProxyRequest} from '../backend/shopify-work-app-proxy-auth.mjs';
import {createCustomOrderWorkProxyRoute} from '../backend/custom-order-work-proxy-route.mjs';

const shop='jill-work.myshopify.com';
const appSecret='shopify-test-app-secret-32-plus-chars';
const googleSecret='different-google-qa-secret-over-32-characters';
const t=1791741600000;
const id='jill:12345678-abcd-4def-abcd-111111111111';
const raw={
  version:1,operation:'custom_order.submit',submission_id:id,
  submitted_at:'2026-10-11T18:00:00.000Z',
  customer:{name:'QA',email:'qa@example.invalid'},
  items:[{item_id:'1',product_id:'123',quantity:1}],
};
const form=new URLSearchParams({
  source:'JILL custom order',submission_id:id,submitted_at:raw.submitted_at,
  name:'QA',email:raw.customer.email,products:'QA',raw_payload:JSON.stringify(raw),
});
function signedUrl(extra={}) {
  const url=new URL('https://qa-gateway.example.test/custom-order');
  url.searchParams.set('shop',shop);
  url.searchParams.set('timestamp',String(t/1000));
  url.searchParams.set('logged_in_customer_id','');
  url.searchParams.set('path_prefix','/apps/jill-custom-order');
  url.searchParams.append('extra','1');
  url.searchParams.append('extra','2');
  for(const [k,v] of Object.entries(extra))url.searchParams.set(k,v);
  const sorted=[...new Map([...url.searchParams.keys()].map(key=>
    [key,url.searchParams.getAll(key)])).entries()]
    .map(([k,values])=>k+'='+values.join(',')).sort().join('');
  url.searchParams.set('signature',createHmac('sha256',appSecret)
    .update(sorted).digest('hex'));
  return url;
}
const req=(url=signedUrl(),body=form)=>new Request(url,{
  method:'POST',
  headers:{origin:'https://jill-work.myshopify.com'},
  body,
});
const config={appSecret,expectedShop:shop,now:()=>t};
assert.deepEqual(verifyShopifyAppProxyRequest(req(),config),
  {shop,loggedInCustomerId:null});
const logged=signedUrl({logged_in_customer_id:'42'});
assert.equal(verifyShopifyAppProxyRequest(req(logged),config).loggedInCustomerId,'42');
const tampered=signedUrl();
tampered.searchParams.set('shop','jqtdgr-1y.myshopify.com');
assert.throws(()=>verifyShopifyAppProxyRequest(req(tampered),config),
  /Invalid WORK Shopify app-proxy identity/);
const modifiedPrefix=signedUrl();
modifiedPrefix.searchParams.set('path_prefix','/apps/fake');
assert.throws(()=>verifyShopifyAppProxyRequest(req(modifiedPrefix),config),
  /Invalid WORK Shopify app-proxy identity/);
const missingSignature=signedUrl();
missingSignature.searchParams.delete('signature');
assert.throws(()=>verifyShopifyAppProxyRequest(req(missingSignature),config),
  /Missing or repeated signed Shopify field/);
const duplicateSignature=signedUrl();
duplicateSignature.searchParams.append('signature',duplicateSignature.searchParams.get('signature'));
assert.throws(()=>verifyShopifyAppProxyRequest(req(duplicateSignature),config),
  /Missing or repeated signed Shopify field/);
const stale=signedUrl({timestamp:String(t/1000-400)});
assert.throws(()=>verifyShopifyAppProxyRequest(req(stale),config),
  /timestamp/);
const invalidSig=signedUrl();
invalidSig.searchParams.set('signature','f'.repeat(64));
assert.throws(()=>verifyShopifyAppProxyRequest(req(invalidSig),config),
  /Invalid Shopify app-proxy HMAC/);
assert.throws(()=>verifyShopifyAppProxyRequest(req(),{...config,appSecret:'x'}),
  /Missing secure WORK/);

let attempts=0,backendCalls=0;
const route=createCustomOrderWorkProxyRoute({
  shopifyAppSecret:appSecret,googleGatewaySecret:googleSecret,
  googleQaEndpoint:'https://script.google.com/macros/s/AKfycbqa-test-project/exec',
  rateLimit:async()=>{attempts++;return true;},
  now:()=>t,
  backendFetch:async(_url,init)=>{
    backendCalls++;
    const body=new URLSearchParams(init.body);
    return new Response(JSON.stringify(body.has('jill_order_receipt')
      ? {operation:'custom_order.receipt.result',ok:true,submission_id:id,
          status:'received',revision:1}
      : {operation:'custom_order.submit.result',ok:true,
          submission_id:id,status:'received',duplicate:false}),
    {status:200,headers:{'content-type':'application/json'}});
  },
});
const accepted=await route(req());
assert.equal(accepted.status,200);
assert.equal((await accepted.json()).verified,true);
assert.equal(attempts,1);
assert.equal(backendCalls,2,'signed gateway needs independent persisted receipt');
const denied=await route(req(invalidSig));
assert.equal(denied.status,401);
assert.equal(backendCalls,2,'forged Shopify proxy must not reach Google');
assert.equal(attempts,1,'forged Shopify proxy must not consume the merchant limiter');
assert.throws(()=>createCustomOrderWorkProxyRoute({
  shopifyAppSecret:googleSecret,googleGatewaySecret:googleSecret,
  googleQaEndpoint:'https://script.google.com/macros/s/AKfycbqa-test-project/exec',
  rateLimit:async()=>true,
}),/Refusing an incomplete/);
assert.throws(()=>createCustomOrderWorkProxyRoute({
  shopifyAppSecret:appSecret,googleGatewaySecret:googleSecret,
  googleQaEndpoint:'https://script.google.com/macros/s/AKfycbqa-test-project/exec',
  rateLimit:async()=>true,expectedShop:'jqtdgr-1y.myshopify.com',
}),/Refusing an incomplete/);
console.log('Signed Shopify WORK app-proxy authentication, customer-identity isolation, and two-proof gateway tests passed.');
