import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  verifyCanonicalQaList,verifyWorkCanaryBeforeStaging,assertSignedGoogleQaEnvelope,
} from './stage-work-hq-merchant-secret.mjs';

const active='49b10c46-8e00-4ef3-8075-74eea29e9c9e';
const manifest={
  name:'jill-order-desk-canary-work',
  vars:{
    JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
    JILL_WORK_OAUTH_ENABLED:'true',
  },
  compatibility_flags:['nodejs_compat'],
  d1_databases:[{
    binding:'JILL_ORDER_DESK_WORK_DB',
    database_id:'3f17c186-c794-4e00-8f20-017191373a19',
  }],
};
const names=[
  {name:'SHOPIFY_API_SECRET',type:'secret_text'},
  {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
];
const safe={
  branch:'jill/rewards-work',
  localSha:'abc123',remoteSha:'abc123',dirty:'',
  manifest,secretNames:names,workerVersion:active,
};
assert.equal(verifyWorkCanaryBeforeStaging(safe),true);
for(const bad of [
  {branch:'main'},
  {localSha:'drift'},
  {remoteSha:'drift'},
  {dirty:' M site.js'},
  {manifest:{...manifest,name:'jill-live'}},
  {manifest:{...manifest,vars:{...manifest.vars,
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}}},
  {manifest:{...manifest,vars:{...manifest.vars,JILL_WORK_OAUTH_ENABLED:'false'}}},
  {manifest:{...manifest,d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
    database_id:'bad-db'}]}},
  {secretNames:[...names,{name:'JILL_HQ_MERCHANT_READ_SECRET',type:'secret_text'}]},
  {workerVersion:'dcd17f20-7b76-4332-8ea2-37fe74931f63'},
])assert.throws(()=>verifyWorkCanaryBeforeStaging({...safe,...bad}),
  /refused|rollout refused|activation STOPPED/);
const record={submission_id:'jill:92b32355-900e-47ba-8946-ccd93190a3b7'};
assert.equal(verifyCanonicalQaList({
  state:'ready',requestsConnected:true,records:[record],
}),1);
for(const bad of [
  {state:'source_not_connected',requestsConnected:false,records:[]},
  {state:'ready',requestsConnected:true,records:[]},
  {state:'ready',requestsConnected:true,
    records:[{submission_id:'jill:00000000-1111-2222-3333-444444444444'}]},
  {state:'ready',requestsConnected:true,records:Array(51).fill(record)},
])assert.throws(()=>verifyCanonicalQaList(bad),/STOPPED/);

// Distinguish server-side source failure vs incorrect signature without
// disclosing records, secret text or raw backend error content.
const envelope={
  version:1,operation:'custom_order.merchant.list.result',
  shop:'jill-work.myshopify.com',ok:true,complete:true,records:[],
};
assert.equal(assertSignedGoogleQaEnvelope(envelope),true);
for(const code of ['unauthorized','private_read_unavailable']) {
  assert.throws(()=>assertSignedGoogleQaEnvelope({
    ok:false,error:{code,raw:'PRIVATE_CUSTOMER_EMAIL@EXAMPLE.COM'},
  }),err=>err.message.includes('returned '+code) &&
    !err.message.includes('PRIVATE_CUSTOMER_EMAIL'));
}
assert.throws(()=>assertSignedGoogleQaEnvelope({
  ok:false,error:{code:'sensitive secret detail',raw:'PRIVATE'},
}),err=>err.message.includes('returned unknown') &&
  !err.message.includes('PRIVATE') &&
  !err.message.includes('sensitive secret detail'));
assert.throws(()=>assertSignedGoogleQaEnvelope({
  ...envelope,complete:false,
}),/response contract mismatch/);

const src=readFileSync('scripts/stage-work-hq-merchant-secret.mjs','utf8');
assert.match(src,/randomBytes\(48\)\.toString\('base64url'\)/);
assert.match(src,/readWorkGoogleQaMerchantList\(\{secret\}\)/);
assert.match(src,/bad\?\.ok===false && bad\?\.error\?\.code==='unauthorized'/);
assert.match(src,/versions','secret','put'/);
assert.match(src,/STAGE WORK READ SECRET/);
assert.match(src,/Cloudflare secret staged in an INACTIVE version/);
assert.match(src,/--config',OAuth/);
assert.doesNotMatch(src,/versions','deploy'|wrangler','secret','put'|shopify app deploy|google\.script\.run/i);
assert.doesNotMatch(src,/writeFileSync\(.*secret|console\.log\(secret\)|env:\s*\{[^}]*secret/i);
console.log('PASS WORK HQ secret staging: correct WORK binding, no duplicate secret, invalid HMAC rejection, bounded request list, version staging only, no secret logging or LIVE writes.');
