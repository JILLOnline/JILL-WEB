import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {handleCustomOrderProxy,receiptSignature,validateCustomOrderPayload} from '../backend/custom-order-gateway.mjs';

const id='jill:12345678-abcd-4def-abcd-111111111111';
const secret='qa-testing-secret-at-least-32-bytes-please';
const shop='jill-work.myshopify.com';
const endpoint='https://script.google.com/macros/s/AKfycbz1_test-only-project/exec';
const raw={version:1,operation:'custom_order.submit',submission_id:id,
  submitted_at:'2026-10-11T18:00:00.000Z',
  customer:{name:'QA',email:'qa@example.invalid'},
  items:[{item_id:'1',product_id:'123',quantity:1}]};
const form=()=>new URLSearchParams({
  source:'JILL custom order',submission_id:id,submitted_at:raw.submitted_at,
  name:'QA',email:raw.customer.email,products:'1 x QA item',
  raw_payload:JSON.stringify(raw),
});
const request=(body=form())=>new Request('https://jill-work.myshopify.com/apps/jill-custom-order',
  {method:'POST',headers:{origin:'https://jill-work.myshopify.com'},body});
const validResult=data=>new Response(JSON.stringify(data),{status:200});
const calls=[];
const upstream=async(_url,opts)=>{
  const params=new URLSearchParams(opts.body);
  calls.push(Object.fromEntries(params));
  const action=params.has('jill_order_receipt')?'receipt':'submit';
  const sig=receiptSignature({action,id:params.get('submission_id'),
    timestamp:params.get('jill_order_gateway_ts'),
    rawPayload:action==='submit'?params.get('raw_payload'):'',secret});
  assert.equal(params.get('jill_order_gateway_sig'),sig);
  return validResult(action==='submit'
    ? {operation:'custom_order.submit.result',ok:true,submission_id:id,status:'received',duplicate:false}
    : {operation:'custom_order.receipt.result',ok:true,submission_id:id,status:'received',revision:1});
};
const config={expectedShop:shop,appsScriptEndpoint:endpoint,receiptSecret:secret,
  authenticateProxy:async()=>({shop}),rateLimit:async()=>true,
  allowedOrigins:['https://jill-work.myshopify.com'],backendFetch:upstream,now:()=>1791741600000};
const run=(req=request(),extra={})=>handleCustomOrderProxy({...config,...extra,request:req});
const response=await run();
assert.equal(response.status,200);
assert.equal(response.headers.get('cache-control'),'no-store');
assert.deepEqual(await response.json(),{version:1,operation:'custom_order.submit.result',
  ok:true,submission_id:id,duplicate:false,status:'received',verified:true});
assert.equal(calls.length,2);
assert.equal(calls[1].jill_order_receipt,'1');
assert.equal('raw_payload' in calls[1],false);
assert.equal(receiptSignature({action:'receipt',id,timestamp:'1791741600000',secret}),
  createHmac('sha256',secret).update(['receipt',id,'1791741600000',''].join('\n')).digest('hex'));
assert.equal((await run(new Request('https://jill-work.myshopify.com/apps/jill-custom-order'))).status,405);
assert.equal((await run(request(new URLSearchParams({source:'JILL custom order'})))).status,400);
assert.equal((await run(request(new URLSearchParams([...form(),['submission_id',id]])))).status,400);
for(const key of ['jill_order_owner_gid','jill_order_customer_list',
  'jill_order_gateway_ts','jill_order_gateway_sig','owner_gid',
  'logged_in_customer_id','customer_id']) {
  const forgedForm=form();
  forgedForm.set(key,key==='jill_order_owner_gid'?'gid://shopify/Customer/999':'spoof');
  assert.equal((await run(request(forgedForm))).status,400,
    'Client may not inject reserved gateway identity field: '+key);
}
// An authenticated Shopify app-proxy query may bind the owner; the owner's
// GID is a mandatory fifth Google HMAC segment and is never copied from form.
const ownerGid='gid://shopify/Customer/123456';
const ownerCalls=[];
const authenticated=await run(request(),{
  authenticateProxy:async()=>({shop,loggedInCustomerId:'123456'}),
  backendFetch:async(_url,opts)=>{
    const params=new URLSearchParams(opts.body);
    ownerCalls.push(params);
    const action=params.has('jill_order_receipt')?'receipt':'submit';
    if(action==='submit') {
      assert.equal(params.get('jill_order_owner_gid'),ownerGid);
      const signed=receiptSignature({
        action,id,timestamp:params.get('jill_order_gateway_ts'),
        rawPayload:params.get('raw_payload'),ownerGid,secret,
      });
      assert.equal(params.get('jill_order_gateway_sig'),signed);
      assert.notEqual(signed,receiptSignature({
        action,id,timestamp:params.get('jill_order_gateway_ts'),
        rawPayload:params.get('raw_payload'),secret,
      }), 'Logged-in owner is cryptographically bound');
    } else {
      assert.equal(params.has('jill_order_owner_gid'),false);
    }
    return validResult(action==='submit'
      ? {operation:'custom_order.submit.result',ok:true,submission_id:id,
         status:'received',duplicate:false}
      : {operation:'custom_order.receipt.result',ok:true,submission_id:id,
         status:'received',revision:1});
  },
});
assert.equal(authenticated.status,200);
assert.equal(ownerCalls.length,2);
// The customer can choose another CONTACT email without transferring
// ownership. The immutable owner comes exclusively from Shopify's signed
// logged_in_customer_id, never from the browser's email field.
const alternateEmail='different-contact@example.invalid';
const differentContactBody=form();
const differentContactRaw={...raw,customer:{...raw.customer,email:alternateEmail}};
differentContactBody.set('email',alternateEmail);
differentContactBody.set('raw_payload',JSON.stringify(differentContactRaw));
const differentContactResponse=await run(request(differentContactBody),{
  authenticateProxy:async()=>({shop,loggedInCustomerId:'123456'}),
  backendFetch:async(_url,opts)=>{
    const params=new URLSearchParams(opts.body);
    const action=params.has('jill_order_receipt')?'receipt':'submit';
    if(action==='submit') {
      assert.equal(params.get('email'),alternateEmail);
      assert.equal(params.get('jill_order_owner_gid'),ownerGid);
      assert.equal(params.get('jill_order_gateway_sig'),receiptSignature({
        action,id,timestamp:params.get('jill_order_gateway_ts'),
        rawPayload:params.get('raw_payload'),ownerGid,secret,
      }));
    }
    return validResult(action==='submit'
      ? {operation:'custom_order.submit.result',ok:true,submission_id:id,
         status:'received',duplicate:false}
      : {operation:'custom_order.receipt.result',ok:true,submission_id:id,
         status:'received',revision:1});
  },
});
assert.equal(differentContactResponse.status,200);
assert.equal((await run(request(),{
  authenticateProxy:async()=>({shop,loggedInCustomerId:'gid://shopify/Customer/111'}),
})).status,401,'Only validated numeric Shopify app-proxy customer IDs accepted');

assert.equal((await run(request(),{authenticateProxy:async()=>{throw Error('bad signature');}})).status,401);
assert.equal((await run(request(),{authenticateProxy:async()=>({shop:'other.myshopify.com'})})).status,403);
assert.equal((await run(request(),{rateLimit:async()=>false})).status,429);
assert.equal((await run(request(),{rateLimit:async()=>{throw Error('redis down');}})).status,503);
assert.equal((await run(request(),{allowedOrigins:['https://other.myshopify.com']})).status,403);
await assert.rejects(run(request(),{rateLimit:undefined}),/missing secure configuration/);
await assert.rejects(run(request(),{receiptSecret:'short'}),/missing secure configuration/);
await assert.rejects(run(request(),{appsScriptEndpoint:'https://attacker.example/exec'}),/missing secure configuration/);
const changed=form();
changed.set('submission_id','jill:some-other-id');
assert.throws(()=>validateCustomOrderPayload(changed.toString()),/does not match/);
assert.equal((await run(request(new URLSearchParams([...form(),['fill','x'.repeat(300000)]])))).status,400);
assert.equal((await run(request(),{backendFetch:async()=>validResult({
  operation:'custom_order.submit.result',ok:true,submission_id:'jill:other-id',status:'received'})})).status,503);
assert.equal((await run(request(),{backendFetch:async(_url,opts)=>{
  const action=new URLSearchParams(opts.body).has('jill_order_receipt')?'receipt':'submit';
  return validResult(action==='submit'
    ? {operation:'custom_order.submit.result',ok:true,submission_id:id,status:'received'}
    : {operation:'custom_order.receipt.result',ok:false,error:{code:'not_found',retryable:true}});
}})).status,503);
assert.equal((await run(request(),{backendFetch:async()=>new Response('<html>login</html>')})).status,503);
assert.equal((await run(request(),{backendFetch:async()=>validResult({
  operation:'custom_order.submit.result',ok:false,error:{code:'submission_conflict',retryable:false}})})).status,409);

// Same protocol in the actual Google Apps Script source, tested without
// a second hand-coded verifier implementation.
const canonical=fs.readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8').replace(/\r\n?/g,'\n');
const start=canonical.indexOf('function jillCustomOrderGatewaySignature_');
const stop=canonical.indexOf('/* END CUSTOM ORDER WORKFLOW V1 */',start);
assert.ok(start>=0&&stop>start);
const properties={JILL_CUSTOM_ORDER_GATEWAY_SECRET:secret,JILL_CUSTOM_ORDER_REQUIRE_GATEWAY:'1'};
const sandbox={
  JILL_REWARDS_RUNTIME:'LIVE',
  JILL_CUSTOM_ORDER_SANDBOX:false,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k]||''})},
  Utilities:{computeHmacSha256Signature:(message,key)=>
    [...createHmac('sha256',key).update(message).digest()].map(x=>x>127?x-256:x)},
  constantTimeEqual_:(a,b)=>a===b,
  clean_:v=>String(v??'').trim(),
  Date,Math,Number,String,JSON,Array,Object,RegExp,Error,
};
vm.createContext(sandbox);
vm.runInContext(canonical.slice(start,stop),sandbox);
const now=String(Date.now());
const signed=(action,payload='')=>({parameter:{
  submission_id:id,raw_payload:payload,jill_order_gateway_ts:now,
  jill_order_gateway_sig:receiptSignature({
    action,id,timestamp:now,rawPayload:payload,secret})
}});
assert.equal(sandbox.jillCustomOrderGatewayVerified_(signed('submit',JSON.stringify(raw)),'submit'),true);
assert.equal(sandbox.jillCustomOrderGatewayVerified_(signed('receipt'),'receipt'),true);
const signedOwner=signed('submit',JSON.stringify(raw));
signedOwner.parameter.jill_order_owner_gid=ownerGid;
signedOwner.parameter.jill_order_gateway_sig=receiptSignature({
  action:'submit',id,timestamp:now,rawPayload:JSON.stringify(raw),
  ownerGid,secret,
});
assert.equal(sandbox.jillCustomOrderGatewayVerified_(signedOwner,'submit'),true);
signedOwner.parameter.jill_order_owner_gid='gid://shopify/Customer/7890';
assert.equal(sandbox.jillCustomOrderGatewayVerified_(signedOwner,'submit'),false,
  'Altering owner in Google input fails the gateway signature');

assert.equal(sandbox.jillCustomOrderGatewaySubmissionAllowed_(signed('submit',JSON.stringify(raw))),true);
assert.equal(sandbox.jillCustomOrderGatewaySubmissionAllowed_({parameter:{submission_id:id}}),false);
const tampered=signed('submit',JSON.stringify(raw));
tampered.parameter.raw_payload='{"attacker":true}';
assert.equal(sandbox.jillCustomOrderGatewayVerified_(tampered,'submit'),false);
sandbox.JILL_REWARDS_RUNTIME='WORK';
assert.equal(sandbox.jillCustomOrderGatewayVerified_(signed('submit',JSON.stringify(raw)),'submit'),false);
sandbox.JILL_CUSTOM_ORDER_SANDBOX=true;
assert.equal(sandbox.jillCustomOrderGatewayVerified_(signed('submit',JSON.stringify(raw)),'submit'),true,
  'isolated Custom Order QA accepts its own signed gateway only');
properties.JILL_CUSTOM_ORDER_REQUIRE_GATEWAY='';
assert.equal(sandbox.jillCustomOrderGatewaySubmissionAllowed_({parameter:{submission_id:id}}),false,
  'QA cannot accept anonymous direct POST even before merchant policy rollout');
properties.JILL_CUSTOM_ORDER_REQUIRE_GATEWAY='1';
sandbox.JILL_CUSTOM_ORDER_SANDBOX=false;
sandbox.JILL_REWARDS_RUNTIME='LIVE';
properties.JILL_CUSTOM_ORDER_REQUIRE_GATEWAY='';
assert.equal(sandbox.jillCustomOrderGatewaySubmissionAllowed_({parameter:{submission_id:id}}),true);
console.log('Custom Order signed gateway + verified receipt + Apps Script HMAC parity passed.');
