import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validateCopiedExistingKey,classifyGoogleMerchantEnvelope,
  testExistingMerchantSecret,
} from './probe-work-hq-existing-merchant-key.mjs';

const key='A'.repeat(64);
const wrong='B'.repeat(64);
assert.equal(validateCopiedExistingKey('  '+key+'\r\n'),key);
for(const bad of ['',null,undefined,'short','A'.repeat(63),'A'.repeat(65),
  '<private key>','A'.repeat(63)+'!',0])
  assert.throws(()=>validateCopiedExistingKey(bad),/No valid existing/);

const id='jill:92b32355-900e-47ba-8946-ccd93190a3b7';
const valid={
  version:1,operation:'custom_order.merchant.list.result',
  ok:true,shop:'jill-work.myshopify.com',complete:true,
  records:[{
    submission_id:id,revision:1,customer_status:'received',
    internal_status:'new',submitted_at:'2026-10-13T21:13:57.364Z',
    updated_at:'2026-10-13T21:13:57.364Z',
    date_needed:'2026-10-29',fulfillment:'pickup',item_count:1,
    name:'PRIVATE NAME',email:'private@example.invalid',
    internal_note:'SHOULD NEVER BE LOGGED',
  }],
};
const sanitized=classifyGoogleMerchantEnvelope(valid);
assert.equal(sanitized.ok,true);
assert.equal(sanitized.requestCount,1);
assert.ok(!JSON.stringify(sanitized).includes('PRIVATE'));
for(const code of ['unauthorized','private_read_unavailable']) {
  const result=classifyGoogleMerchantEnvelope({
    ok:false,error:{code,raw:'PRIVATE CUSTOMER EMAIL'},
  });
  assert.deepEqual(result,{ok:false,code});
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
}
assert.equal(classifyGoogleMerchantEnvelope({ok:false,error:{code:'secrets'}}).code,
  'unexpected_google_error');
assert.equal(classifyGoogleMerchantEnvelope(null).code,'invalid_google_response');
assert.equal(classifyGoogleMerchantEnvelope({...valid,complete:false}).code,
  'invalid_google_projection');
assert.equal(classifyGoogleMerchantEnvelope({...valid,records:[]}).code,
  'incomplete_verified_records');

const calls=[];
const result=await testExistingMerchantSecret({
  secret:key,invalidKey:()=>wrong,
  reader:async({secret})=>{
    calls.push(secret);
    return secret===key?valid:{ok:false,error:{code:'unauthorized'}};
  },
});
assert.deepEqual(result,{ok:true,requestCount:1});
assert.deepEqual(calls,[wrong,key]);
const refused=await testExistingMerchantSecret({
  secret:key,invalidKey:()=>wrong,
  reader:async()=>valid,
});
assert.deepEqual(refused,{ok:false,code:'bad_signature_not_denied'});
const badSecret=await testExistingMerchantSecret({
  secret:key,invalidKey:()=>wrong,
  reader:async({secret})=>secret===key
    ?{ok:false,error:{code:'unauthorized'}}
    :{ok:false,error:{code:'unauthorized'}},
});
assert.deepEqual(badSecret,{ok:false,code:'unauthorized'});
await assert.rejects(()=>testExistingMerchantSecret({
  secret:key,invalidKey:()=>key,reader:async()=>valid,
}),/independent negative-control/);

const source=readFileSync('scripts/probe-work-hq-existing-merchant-key.mjs','utf8');
assert.match(source,/Get-Clipboard -Raw/);
assert.match(source,/clearClipboardIfUnchanged/);
assert.match(source,/readWorkGoogleQaMerchantList/);
assert.match(source,/jill\/rewards-work/);
assert.doesNotMatch(source,/versions','secret','put'|secret put|versions deploy|wrangler.*deploy|update-deployment|setProperty\(|getProperty\(|console\.log\(secret\)|console\.error\(error\)/i);
assert.doesNotMatch(source,/randomBytes\(48\)\.toString\('base64url'\).*writeFile/i);
console.log('PASS existing WORK QA key probe: read-only, negative-control HMAC, scoped ID, PII redaction, no secret duplication or Cloudflare mutation.');
