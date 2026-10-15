import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {
  privateQaMerchantReadKey,detailProbeEndpoint,
  signedMissingDetailBody,probeIsolatedWorkQaDetail,
} from './probe-work-hq-qa-detail-v9.mjs';
const id='AKfycbTestOnlyExactDetailDeployment1234567890123';
const correct='TEST_ONLY_WORK_QA_MERCHANT_READ_SECRET_123456';
const section='[WORK.GOOGLE_CUSTOM_ORDERS_QA]';
const vault=[
  '[LIVE.UNVERIFIED]','JILL_HQ_MERCHANT_READ_SECRET=LIVE_SHOULD_NOT_USE',
  section,'JILL_HQ_MERCHANT_READ_SECRET='+correct,
  '[WORK.CLOUDFLARE_ORDER_DESK]',
  'JILL_HQ_MERCHANT_READ_SECRET=WRONG_CLOUDFLARE_VALUE_123456',
].join('\n');
assert.equal(privateQaMerchantReadKey(vault),correct);
for(const bad of [
  vault.replace(section,'[WORK.GOOGLE_CUSTOM_ORDERS_QA_WRONG]'),
  vault+'\n'+section+'\nJILL_HQ_MERCHANT_READ_SECRET='+correct,
  vault.replace('JILL_HQ_MERCHANT_READ_SECRET='+correct,
    'JILL_HQ_MERCHANT_READ_SECRET=short'),
  vault.replace('JILL_HQ_MERCHANT_READ_SECRET='+correct,
    'JILL_HQ_MERCHANT_READ_SECRET='+correct+'\nJILL_HQ_MERCHANT_READ_SECRET='+correct),
])assert.throws(()=>privateQaMerchantReadKey(bad));
const endpoint=detailProbeEndpoint(id,9);
assert.equal(endpoint,'https://script.google.com/macros/s/'+id+'/exec');
assert.throws(()=>detailProbeEndpoint(id,8));
assert.throws(()=>detailProbeEndpoint('https://evil.example',9));
assert.throws(()=>detailProbeEndpoint('AKfycb???',9));
const fakeId='jill:hq:detail-diagnostic:09e67134-cd3e-47d4-b371-555a121b5f99';
const ts='1792100000000',nonce='M'.repeat(32);
const params=signedMissingDetailBody({
  secret:correct,submissionId:fakeId,timestamp:ts,nonce,
});
assert.equal(params.get('shop'),'jill-work.myshopify.com');
assert.equal(params.get('submission_id'),fakeId);
assert.equal(params.has('customer'),false);
assert.equal(params.has('raw_payload'),false);
const expected=createHmac('sha256',correct).update(
  ['merchant_detail_v1','jill-work.myshopify.com',fakeId,ts,nonce]
    .join('\n')).digest('hex');
assert.equal(params.get('jill_hq_read_sig'),expected);
assert.throws(()=>signedMissingDetailBody({
  secret:correct,submissionId:'jill:92b32355-900e-47ba-8946-ccd93190a3b7',
  timestamp:ts,nonce,
}),/invalid_diagnostic_id/);
const calls=[];
const mock=async(url,options)=>{
  assert.equal(url,endpoint);
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'follow');
  assert.ok(options.signal);
  const p=options.body;
  assert.equal(p.get('submission_id'),fakeId);
  assert.equal(p.get('jill_order_merchant_detail'),'1');
  assert.equal(p.get('shop'),'jill-work.myshopify.com');
  assert.equal(p.get('raw_payload'),null);
  const kind=p.get('jill_hq_read_sig')===expected?'not_found':'unauthorized';
  calls.push(kind);
  return Response.json({
    version:1,operation:'custom_order.merchant.detail.source.result',
    ok:false,error:{code:kind,retryable:false},
  });
};
const known={
  deploymentId:id,secret:correct,
  createId:()=>fakeId,now:()=>Number(ts),makeNonce:()=>nonce,
  wrongSecret:()=> 'TEST_ONLY_WRONG_QA_MERCHANT_READ_SECRET_123456',
};
const pass=await probeIsolatedWorkQaDetail({...known,backendFetch:mock});
assert.equal(pass.verified,true);
assert.deepEqual(calls,['unauthorized','not_found']);
assert.equal(pass.existingRecordsReturned,0);
assert.equal(pass.mutations,0);
for(const [negative,positive] of [
  ['not_found','not_found'],
  ['unauthorized','unauthorized'],
  ['unauthorized','private_read_unavailable'],
  ['unauthorized','received'],
]){
  let n=0;
  await assert.rejects(()=>probeIsolatedWorkQaDetail({...known,
    backendFetch:async()=>Response.json({
      version:1,operation:'custom_order.merchant.detail.source.result',
      ok:false,error:{code:[negative,positive][n++],retryable:false},
    }),
  }));
}
await assert.rejects(()=>probeIsolatedWorkQaDetail({...known,
  backendFetch:async()=>new Response('Z'.repeat(4097)),
}),/invalid_detail_qa_ack/);
await assert.rejects(()=>probeIsolatedWorkQaDetail({...known,
  backendFetch:async()=>new Response('<html>Google login</html>'),
}),/invalid_detail_qa_ack/);
await assert.rejects(()=>probeIsolatedWorkQaDetail({
  ...known,version:8,backendFetch:mock,
}),/uncertified_qa_detail_deployment/);
const script=readFileSync('scripts/probe-work-hq-qa-detail-v9.mjs','utf8');
assert.match(script,/reconcileWorkQaDetailRemote/);
assert.match(script,/localFilePath/);
assert.match(script,/privateQaMerchantReadKey/);
assert.match(script,/negativeDenied:true/);
assert.doesNotMatch(script,/['"]create-deployment['"]|['"]update-deployment['"]|['"]push['"]|['"]delete-deployment['"]/);
assert.doesNotMatch(script,/console\.(?:log|error)\([^)]*(?:secret|body|raw_payload)/);
console.log('PASS WORK QA detail v9 probe: isolated local key only, separate exact-ID HMAC signature, negative unauthorized/positive not_found, bounded ack, no customer data or mutations.');
