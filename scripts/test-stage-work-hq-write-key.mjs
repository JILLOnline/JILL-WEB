import assert from 'node:assert/strict';
import {
  privateWorkWriteKey,verifyWorkSecretCandidate,
} from './stage-work-hq-write-key.mjs';
const key='W'.repeat(64);
const input=[
  '[WORK.GOOGLE_CUSTOM_ORDERS_QA]',
  'JILL_HQ_MERCHANT_READ_SECRET='+'R'.repeat(64),
  'JILL_HQ_MERCHANT_WRITE_SECRET='+key,
  '[WORK.CLOUDFLARE_ORDER_DESK]',
  'SHOPIFY_API_SECRET='+'S'.repeat(64),
  'JILL_WORK_SESSION_KEY_B64='+'K'.repeat(64),
  'JILL_HQ_MERCHANT_WRITE_SECRET='+key,
  '[LIVE.UNVERIFIED]',
  'JILL_HQ_MERCHANT_WRITE_SECRET='+'L'.repeat(64),
].join('\n');
assert.equal(privateWorkWriteKey(input),key);
assert.throws(()=>privateWorkWriteKey(input.replace(
  '[WORK.CLOUDFLARE_ORDER_DESK]\n','[WORK.CLOUDFLARE_ORDER_DESK]\nJILL_HQ_MERCHANT_WRITE_SECRET='+key+'\n')),/missing_or_invalid/);
assert.throws(()=>privateWorkWriteKey(input.replace(
  '[WORK.GOOGLE_CUSTOM_ORDERS_QA]',
  '[KEEP.GOOGLE_CUSTOM_ORDERS_QA]')),/invalid_work_section/);
assert.throws(()=>privateWorkWriteKey(input.replace(
  '[WORK.CLOUDFLARE_ORDER_DESK]\nSHOPIFY_API_SECRET',
  '[WORK.CLOUDFLARE_ORDER_DESK]\nJILL_HQ_MERCHANT_WRITE_SECRET='+'X'.repeat(64)+'\nSHOPIFY_API_SECRET')),
  /missing_or_invalid/);
const named=(name,type,text)=>({name,type,...(text!==undefined?{text}:{})});
const bindings=[
  named('JILL_HQ_MERCHANT_READ_SECRET','secret_text'),
  named('JILL_WORK_SESSION_KEY_B64','secret_text'),
  named('SHOPIFY_API_SECRET','secret_text'),
  named('JILL_ORDER_DESK_WORK_DB','d1',{uuid:'3f17c186-c794-4e00-8f20-017191373a19'}),
  named('JILL_WORK_HOST_STAGE','plain_text','canary'),
  named('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text','false'),
  named('JILL_WORK_OAUTH_ENABLED','plain_text','true'),
];
const active={id:'active',resources:{bindings,script:{etag:'unchanged-code'}}};
const candidate={id:'staged',resources:{bindings:[
  ...bindings,named('JILL_HQ_MERCHANT_WRITE_SECRET','secret_text'),
],script:{etag:'unchanged-code'}}};
assert.equal(verifyWorkSecretCandidate(active,candidate),true);
assert.throws(()=>verifyWorkSecretCandidate(active,active),/candidate_not_inactive/);
assert.throws(()=>verifyWorkSecretCandidate(active,{
  ...candidate,resources:{...candidate.resources,
    bindings:[...candidate.resources.bindings,named('UNKNOWN','secret_text')]},
}),/invalid_secret_change/);
assert.throws(()=>verifyWorkSecretCandidate(active,{
  ...candidate,resources:{...candidate.resources,
    bindings:candidate.resources.bindings.map(item=>
      item.name==='JILL_WORK_HOST_STAGE'?{...item,text:'live'}:item)},
}),/binding_changed/);
assert.throws(()=>verifyWorkSecretCandidate(active,{
  ...candidate,resources:{...candidate.resources,script:{etag:'changed-code'}},
}),/unexpected_worker_code/);
console.log('PASS WORK secret-only inactive staging: matching local vault entries, no LIVE bleed, exact binding preservation, unchanged Worker code.');
