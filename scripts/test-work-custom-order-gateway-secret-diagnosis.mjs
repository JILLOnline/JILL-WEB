// Offline-only fixtures. No Google/Cloudflare requests in CI.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import fs from 'node:fs';
import {
  readVerifiedWorkGatewayKey,makeFakeSignedReceipt,
  checkIsolatedQaGatewaySecret,
} from './diagnose-work-custom-order-gateway-secret.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';
let n=0;
const goodKey='work-gateway-hmac-owner-confirmed-test-secret-123';
const section='[WORK.GOOGLE_CUSTOM_ORDERS_QA]\n';
const vault=[
  '[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]',
  'JILL_CUSTOM_ORDER_GATEWAY_SECRET=different-live-unknown',
  '',
  '[WORK.GOOGLE_CUSTOM_ORDERS_QA]',
  'JILL_HQ_MERCHANT_READ_SECRET=separate-key',
  'JILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey,
  '',
  '[LIVE.UNVERIFIED]',
  'JILL_CUSTOM_ORDER_GATEWAY_SECRET=live-placeholder',
  '',
].join('\n');
const pass=fn=>{fn();n++;};
const deny=fn=>{assert.throws(fn,/work_gateway_diagnosis_/);n++;};
pass(()=>assert.equal(readVerifiedWorkGatewayKey(vault),goodKey));
for(const text of [
  '',section,
  section+'JILL_CUSTOM_ORDER_GATEWAY_SECRET=',
  section+'JILL_CUSTOM_ORDER_GATEWAY_SECRET=short',
  section+'JILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey+'\nJILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey,
  section+'JILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey+'\n'+section+'JILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey,
  '[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]\nJILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey,
  section+'JILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey+' ',
  section+'JILL_CUSTOM_ORDER_GATEWAY_SECRET='+goodKey+'\t',
])deny(()=>readVerifiedWorkGatewayKey(text));
const id='33333333-4444-4555-8666-777777777777';
const now=1792252800000;
const body=makeFakeSignedReceipt({secret:goodKey,now:()=>now,uuid:()=>id});
pass(()=>{
  assert.equal(body.get('jill_order_receipt'),'1');
  assert.equal(body.get('submission_id'),'jill:qa-gateway-diagnostic:'+id);
  assert.equal(body.get('jill_order_gateway_ts'),String(now));
  assert.equal(body.get('jill_order_gateway_sig'),
    createHmac('sha256',goodKey).update([
      'receipt','jill:qa-gateway-diagnostic:'+id,String(now),'',
    ].join('\n')).digest('hex'));
  assert.equal(body.has('raw_payload'),false);
  assert.equal(body.has('jill_order_merchant_command'),false);
  assert.equal(body.has('email'),false);
});
deny(()=>makeFakeSignedReceipt({secret:goodKey,now:()=>now,
  uuid:()=> 'fake-custom-order-id'}));
const reqs=[];
const fake=code=>async(url,options)=>{
  assert.equal(url,JILL_HQ_WORK_QA_GOOGLE_URL);
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'follow');
  const incoming=new URLSearchParams(options.body);
  assert.equal(incoming.get('jill_order_receipt'),'1');
  assert.ok(incoming.get('submission_id')
    .startsWith('jill:qa-gateway-diagnostic:'));
  assert.equal(incoming.has('raw_payload'),false);
  assert.equal(incoming.has('jill_order_owner_gid'),false);
  assert.equal(options.headers.accept,'application/json');
  reqs.push(incoming);
  const response={version:1,operation:'custom_order.receipt.result',
    ok:false,error:{
      code,retryable:code==='receipt_not_found',
    }};
  return new Response(JSON.stringify(response),{
    status:200,headers:{'content-type':'application/json'},
  });
};
const yes=await checkIsolatedQaGatewaySecret({secret:goodKey,
  backendFetch:fake('receipt_not_found'),
  now:()=>now,uuid:()=>id});
pass(()=>{
  assert.equal(yes.googleQaSigningKeyMatches,true);
  assert.equal(yes.syntheticRequestCreated,false);
  assert.equal(yes.noExistingReceiptRead,true);
  assert.equal(yes.cloudflareKeyCompared,false);
  assert.ok(Object.isFrozen(yes));
  assert.equal(reqs.length,1);
});
const no=await checkIsolatedQaGatewaySecret({secret:goodKey,
  backendFetch:fake('unauthorized_receipt'),
  now:()=>now,uuid:()=>id});
pass(()=>{
  assert.equal(no.googleQaSigningKeyMatches,false);
  assert.equal(no.cloudflareKeyCompared,false);
});
const invalidReply=(reply,status=200)=>async()=>new Response(
  typeof reply==='string'?reply:JSON.stringify(reply),
  {status,headers:{'content-type':'application/json'}});
for(const [response,status] of [
  ['not JSON',200],
  [{ok:true,version:1,operation:'custom_order.receipt.result'},200],
  [{ok:false,version:1,operation:'fake',
    error:{code:'receipt_not_found',retryable:true}},200],
  [{ok:false,version:1,operation:'custom_order.receipt.result',
    error:{code:'unauthorized_receipt',retryable:true}},200],
  [{ok:false,version:1,operation:'custom_order.receipt.result',
    error:{code:'receipt_not_ready',retryable:true}},200],
  [{ok:false,version:1,operation:'custom_order.receipt.result',
    error:{code:'receipt_not_found',retryable:true}},403],
  ['x'.repeat(2050),200],
]) {
  await assert.rejects(
    ()=>checkIsolatedQaGatewaySecret({secret:goodKey,
      backendFetch:invalidReply(response,status),now:()=>now,uuid:()=>id}),
    /work_gateway_diagnosis_/);
  n++;
}
const code=fs.readFileSync(
  new URL('./diagnose-work-custom-order-gateway-secret.mjs',import.meta.url),
  'utf8');
for(const str of [
  'auditWorkQaReadOnly','verifyLocalWorkQaIdentity',
  "jill_order_receipt:'1'",
  "action:'receipt'","private_catalog_missing",
  'readVerifiedWorkGatewayKey',
  "googleQaSigningKeyMatches:false",
  "googleQaSigningKeyMatches:true",
  "cloudflareKeyCompared:false",
  'NO submission created',
]){
  assert.ok(code.includes(str),'Missing read-only safety contract '+str);
  n++;
}
for(const forbidden of [
  /['"]d1['"],['"]execute['"]/,
  /['"]versions['"],['"]deploy['"]/,
  /['"]secret['"],['"]put['"]/,
  /['"]custom_order\.submit['"]/,
  /MailApp/,
  /ScriptApp\.newTrigger/,
  /console\.log\(\s*secret/,
]){
  assert.doesNotMatch(code,forbidden);n++;
}
console.log('PASS WORK custom-order gateway signed fake-receipt diagnosis OFFLINE: '+
  n+' vault segregation, HMAC, mismatch, strict Google response and no-order-write tests.');
console.log('HOLD: no actual Google QA secret or Cloudflare Worker value was read in CI.');
