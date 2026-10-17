// WORK-only synthetic acceptance rehearsal: fully local; never calls cloud providers.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {createCustomOrderWorkProxyRoute} from '../backend/custom-order-work-proxy-route.mjs';
import {handleWorkCustomOrderAccountRead} from '../backend/custom-order-account-read.mjs';
import {receiptSignature} from '../backend/custom-order-gateway.mjs';

const SHOP='jill-work.myshopify.com';
const ORIGIN='https://jill-work.myshopify.com';
const ENDPOINT='https://script.google.com/macros/s/AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V/exec';
const SHOPIFY_SECRET='synthetic-shopify-app-secret-32-chars-plus';
const GOOGLE_SECRET='synthetic-google-qa-secret-32-chars-plus';
const NOW=Date.parse('2026-10-17T23:30:00.000Z');
const CUSTOMER='gid://shopify/Customer/42';
const ID='jill:'+randomUUID();
let submits=0,receipts=0,lists=0;
const stored=new Map();
const signed=(parts)=>createHmac('sha256',SHOPIFY_SECRET).update(parts).digest('hex');
const encode=(obj)=>Buffer.from(JSON.stringify(obj)).toString('base64url');

function proxyUrl(customerId='42') {
  const url=new URL('https://gateway.invalid/jill-custom-order-proxy');
  url.searchParams.set('shop',SHOP);
  url.searchParams.set('timestamp',String(NOW/1000));
  url.searchParams.set('path_prefix','/apps/jill-custom-order');
  url.searchParams.set('logged_in_customer_id',customerId);
  const canon=[...url.searchParams].map(([k,v])=>k+'='+v).sort().join('');
  url.searchParams.set('signature',signed(canon));
  return url;
}
function session() {
  const header=encode({alg:'HS256',typ:'JWT'});
  const payload=encode({
    aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
    dest:SHOP,sub:CUSTOMER,
    iat:NOW/1000,nbf:NOW/1000,exp:NOW/1000+300,
    jti:'jill-work-synthetic-'+randomUUID(),
  });
  const body=header+'.'+payload;
  return body+'.'+createHmac('sha256',SHOPIFY_SECRET)
    .update(body).digest('base64url');
}
function response(data) {
  return new Response(JSON.stringify(data),{
    status:200,headers:{'content-type':'application/json'},
  });
}
// A stateful IN-MEMORY Google QA double verifies HMACs before persisting anything.
async function fakeGoogle(endpoint,init) {
  assert.equal(endpoint,ENDPOINT);
  assert.equal(init.method,'POST');
  const form=new URLSearchParams(init.body);
  const ts=form.get('jill_order_gateway_ts');
  const id=form.get('submission_id');
  const sig=form.get('jill_order_gateway_sig');
  assert.match(ts||'',/^\d{13}$/);
  assert.equal(typeof sig,'string');
  let action,raw='',owner='';
  if(form.get('jill_order_receipt')==='1') {
    action='receipt';
  } else if(form.get('jill_order_customer_list')==='1') {
    action='customer_list';
    owner=form.get('jill_order_owner_gid')||'';
    raw=owner;
  } else {
    action='submit';
    raw=form.get('raw_payload')||'';
    owner=form.get('jill_order_owner_gid')||'';
  }
  assert.equal(sig,receiptSignature({
    action,id,timestamp:ts,rawPayload:raw,secret:GOOGLE_SECRET,
    ownerGid:action==='submit'?owner:'',
  }), 'Google must reject invalid gateway HMAC');
  if(action==='submit') {
    submits++;
    assert.equal(id,ID);
    assert.equal(owner,CUSTOMER);
    assert.equal(stored.has(id),false,'one-time synthetic order only');
    stored.set(id,{owner,updated:'2026-10-17T23:30:00.000Z'});
    return response({operation:'custom_order.submit.result',ok:true,
      submission_id:id,status:'received',duplicate:false});
  }
  if(action==='receipt') {
    receipts++;
    assert.equal(stored.has(id),true);
    return response({operation:'custom_order.receipt.result',ok:true,
      submission_id:id,status:'received',revision:1});
  }
  lists++;
  assert.equal(owner,CUSTOMER);
  const orders=[...stored].filter(([,v])=>v.owner===owner).map(([key,v])=>({
    submission_id:key,revision:1,status:'received',updated_at:v.updated,
    summary:{items:[{title:'Synthetic QA item',quantity:1}],
      date_needed:'2026-11-01',fulfillment:'pickup'},
    timeline:[{status:'received',note:'Synthetic acceptance rehearsal',
      occurred_at:v.updated}],
  }));
  return response({version:1,operation:'custom_order.account.list.result',
    ok:true,orders});
}
const payload={
  version:1,operation:'custom_order.submit',submission_id:ID,
  submitted_at:'2026-10-17T23:30:00.000Z',
  customer:{name:'Synthetic JILL QA',email:'qa@example.invalid'},
  items:[{item_id:'synthetic-1',product_id:'synthetic',quantity:1}],
};
const body=new URLSearchParams({
  source:'JILL custom order',submission_id:ID,
  submitted_at:payload.submitted_at,
  email:payload.customer.email,raw_payload:JSON.stringify(payload),
});
const route=createCustomOrderWorkProxyRoute({
  shopifyAppSecret:SHOPIFY_SECRET,googleGatewaySecret:GOOGLE_SECRET,
  googleQaEndpoint:ENDPOINT,rateLimit:async()=>true,
  backendFetch:fakeGoogle,now:()=>NOW,
});
const incoming=new Request(proxyUrl(),{
  method:'POST',headers:{origin:ORIGIN},body,
});
const result=await route(incoming);
assert.equal(result.status,200);
assert.deepEqual(await result.json(),{
  version:1,operation:'custom_order.submit.result',
  ok:true,submission_id:ID,duplicate:false,status:'received',verified:true,
});
assert.equal(submits,1);
assert.equal(receipts,1);
assert.equal(stored.size,1);
const token=session();
const accountRequest=()=>new Request('https://gateway.invalid/jill-custom-order-account',{
  method:'POST',headers:{authorization:'Bearer '+token},
});
const account=await handleWorkCustomOrderAccountRead(accountRequest(),{
  shopifyAppSecret:SHOPIFY_SECRET,googleGatewaySecret:GOOGLE_SECRET,
  googleQaEndpoint:ENDPOINT,rateLimit:async()=>true,
  backendFetch:fakeGoogle,now:()=>NOW,
});
assert.equal(account.status,200);
const projected=await account.json();
assert.equal(projected.ok,true);
assert.equal(projected.orders.length,1);
assert.equal(projected.orders[0].submission_id,ID);
assert.equal(projected.orders[0].status,'received');
assert.equal(lists,1);
const denied=await handleWorkCustomOrderAccountRead(new Request(
  'https://gateway.invalid/jill-custom-order-account',{method:'POST'}),{
  shopifyAppSecret:SHOPIFY_SECRET,googleGatewaySecret:GOOGLE_SECRET,
  googleQaEndpoint:ENDPOINT,rateLimit:async()=>true,
  backendFetch:fakeGoogle,now:()=>NOW,
});
assert.equal(denied.status,401);
assert.equal(lists,1,'unauthenticated read cannot reach Google');
assert.equal(stored.size,1,'account read must not create another order');
console.log('PASS WORK synthetic acceptance OFFLINE: signed Shopify proxy -> HMAC-checked Google QA double -> independently signed receipt -> session-bound My JILL account list.');
console.log('PASS one synthetic request, one receipt, one owner-bound account projection, unauthenticated denial; NO real Google/Shopify/Cloudflare/D1/R2 calls.');
console.log('HOLD live repaired-version attribution, real Google receipt, Owner HQ readback, customer UI and any deployment/traffic changes.');
