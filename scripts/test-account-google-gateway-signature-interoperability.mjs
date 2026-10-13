#!/usr/bin/env node
// Cross-runtime interoperability test: Node/Cloudflare signer versus
// Google Apps Script verifier, including Shopify-signed customer binding.
// Uses an explicitly fake local key. No network, Google, customer records,
// or production credentials are accessed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {receiptSignature} from '../backend/custom-order-gateway.mjs';

const source=fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const start=source.indexOf('function jillCustomOrderGatewaySignature_(');
const end=source.indexOf('function jillCustomOrderGatewaySubmissionAllowed_(',start);
assert.ok(start>=0 && end>start,'Expected canonical GAS signature verifier');
const fakeSecret='test-only-qa-secret-never-used-by-a-real-store-000001';
let simulatedNow=Date.now();
const properties={JILL_CUSTOM_ORDER_GATEWAY_SECRET:fakeSecret};
const context={
  JILL_REWARDS_RUNTIME:'WORK',
  JILL_CUSTOM_ORDER_SANDBOX:true,
  clean_:x=>x==null?'':String(x).trim(),
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]||''})},
  Utilities:{computeHmacSha256Signature:(message,key)=>[...createHmac('sha256',key).update(message).digest()].map(x=>x>127?x-256:x)},
  Date:{now:()=>simulatedNow},
  constantTimeEqual_:(a,b)=>{
    const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));
    return aa.length===bb.length && timingSafeEqual(aa,bb);
  },
};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
const googleVerify=context.jillCustomOrderGatewayVerified_;
const payload=JSON.stringify({
  version:1,operation:'custom_order.submit',submission_id:'jill:qa:interop-123',
  items:[{product_id:'test-product'}],customer:{email:'test@example.invalid'}
});
const id='jill:qa:interop-123';
const ownerGid='gid://shopify/Customer/123456';
function request(secret,owner='') {
  const timestamp=String(simulatedNow);
  const params={
    submission_id:id,
    raw_payload:payload,
    jill_order_gateway_ts:timestamp,
    jill_order_gateway_sig:receiptSignature({
      action:'submit',id,timestamp,rawPayload:payload,secret,ownerGid:owner,
    })
  };
  if(owner)params.jill_order_owner_gid=owner;
  // Simulate the POST URL-encoding and Apps Script e.parameter reconstruction.
  return {parameter:Object.fromEntries(new URLSearchParams(new URLSearchParams(params).toString()))};
}
assert.equal(googleVerify(request(fakeSecret),'submit'),true,'Guest signed payload must verify');
assert.equal(googleVerify(request(fakeSecret,ownerGid),'submit'),true,'Owned signed payload must verify');
const changed=request(fakeSecret,ownerGid);
changed.parameter.jill_order_owner_gid='gid://shopify/Customer/999999';
assert.equal(googleVerify(changed,'submit'),false,'Changing signed owner must fail');
const tampered=request(fakeSecret,ownerGid);
tampered.parameter.raw_payload+=' ';
assert.equal(googleVerify(tampered,'submit'),false,'Changing raw payload must fail');
const missingOwner=request(fakeSecret,ownerGid);
delete missingOwner.parameter.jill_order_owner_gid;
assert.equal(googleVerify(missingOwner,'submit'),false,'Signed-in signature must not verify as guest');
assert.equal(googleVerify(request(fakeSecret+'-DIFFERENT',ownerGid),'submit'),false,
  'Mismatched Worker/Google secrets must fail despite both being configured');
const staleRequest=request(fakeSecret,ownerGid);
simulatedNow+=121000;
assert.equal(googleVerify(staleRequest,'submit'),false,
  'Out-of-window signatures must fail');
console.log('WORK Node/Google QA HMAC interop PASS: guest, owned, encoded fields, tampering, mismatched secret and expiry.');
