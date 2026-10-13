#!/usr/bin/env node
// Execute the actual ACCOUNT theme submit handler against synthetic HTTP receipts.
// Never submit a real request or disclose customer/order data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/jill-custom-order.js','utf8');
const start=source.indexOf('  async function submitRequest(root, request) {');
const end=source.indexOf('\n  function text(bytes',start);
assert.ok(start>=0&&end>start,'Expected canonical WORK submit function');
const body=source.slice(start,end);
const expectedId='jill:qa-test-00000001';
const makeReceipt=(o={})=>({
  ok:true,verified:true,operation:'custom_order.submit.result',
  submission_id:expectedId,status:'received',...o
});
let reply;
const calls=[];
const context={
  URL, URLSearchParams,
  globalThis:{location:{origin:'https://jill-work.myshopify.com'}},
  endpointPayload:()=>({source:'JILL custom order',submission_id:expectedId}),
  fail:(message)=>{throw new Error('JILL custom order: '+message);},
  fetch:async(url,init)=>{calls.push({url,init});return reply;},
};
const {submitRequest}=vm.runInNewContext(body+'\n({submitRequest})',context);
const root={dataset:{verifiedSubmitEndpoint:'/apps/jill-custom-order'}};
const request={submission_id:expectedId};
const set=(status,value,parseError=false)=>{
  reply={ok:status>=200&&status<300,status,
    json:async()=>{if(parseError)throw Error('not JSON');return value;}};
};
set(200,makeReceipt());
await submitRequest(root,request);
assert.equal(calls[0].url,'https://jill-work.myshopify.com/apps/jill-custom-order');
assert.equal(calls[0].init.method,'POST');
assert.equal(calls[0].init.credentials,'same-origin');

set(503,{ok:false,error:{code:'receipt_unconfirmed'}});
await assert.rejects(()=>submitRequest(root,request),
  /WORK QA backend has not confirmed the saved request.*WORK 503 \/ receipt_unconfirmed/);
set(401,{ok:false,error:{code:'unauthenticated_proxy'}});
await assert.rejects(()=>submitRequest(root,request),
  /Shopify WORK did not authenticate the app proxy.*WORK 401 \/ unauthenticated_proxy/);
set(503,{ok:false,error:{code:'gateway_unavailable'}});
await assert.rejects(()=>submitRequest(root,request),
  /gateway is not fully configured or online.*WORK 503 \/ gateway_unavailable/);
set(404,{ok:false,error:'not_found'});
await assert.rejects(()=>submitRequest(root,request),
  /destination route was not found.*WORK 404 \/ not_found/);
set(200,makeReceipt({verified:false}));
await assert.rejects(()=>submitRequest(root,request),/unclassified_response/);
set(200,makeReceipt({submission_id:'different-id'}));
await assert.rejects(()=>submitRequest(root,request),/unclassified_response/);
set(403,{ok:false,error:{code:'unsafe-secret<script>alert(1)</script>'}});
await assert.rejects(()=>submitRequest(root,request),err=>{
  assert.match(err.message,/unclassified_response/);
  assert.ok(!err.message.includes('<script>'),'Do not echo upstream error content');
  return true;
});
set(302,null,true);
await assert.rejects(()=>submitRequest(root,request),
  /returned a page instead of a verified receipt \(HTTP 302\)/);
const wrong={dataset:{verifiedSubmitEndpoint:'https://jillonlinestore.com/apps/jill-custom-order'}};
set(200,makeReceipt());
await assert.rejects(()=>submitRequest(wrong,request),/WORK verified Shopify app proxy is not configured/);
console.log('Actual ACCOUNT submit handler: verified receipt, 401/404/503 codes, unsafe content, non-JSON, wrong ID and wrong endpoint PASS.');
