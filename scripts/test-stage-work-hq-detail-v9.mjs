// Offline, synthetic: no Git, Google, Cloudflare or Shopify operations.
import assert from 'node:assert/strict';
import {prepareInactiveDetailManifest,verifyInactiveDetailCandidate,
  DETAIL_BASELINE,DETAIL_STAGE_MARKER}
  from './stage-work-hq-detail-v9.mjs';

const SHOP_DB='3f17c186-c794-4e00-8f20-017191373a19';
const VARS={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
};
const oauth={
  name:'jill-order-desk-canary-work',
  compatibility_flags:['nodejs_compat'],
  d1_databases:[{
    binding:'JILL_ORDER_DESK_WORK_DB',database_name:'jill-order-desk-work',
    database_id:SHOP_DB,
  }],
  vars:VARS,main:'./index.js',
};
const locked=prepareInactiveDetailManifest(oauth);
assert.equal(locked.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
assert.equal(locked.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(locked.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
assert.ok(!Object.hasOwn(locked.vars,'JILL_WORK_HQ_DETAIL_ENABLED'));
assert.deepEqual(oauth.vars,VARS,'input manifest must remain unchanged');
assert.ok(DETAIL_STAGE_MARKER.includes('detail OFF'));
for(const bad of [
  {...oauth,name:'jill-order-desk-work'},
  {...oauth,vars:{...VARS,JILL_WORK_OAUTH_ENABLED:'false'}},
  {...oauth,vars:{...VARS,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
  {...oauth,vars:{...VARS,JILL_WORK_HQ_DETAIL_ENABLED:'true'}},
  {...oauth,d1_databases:[{...oauth.d1_databases[0],database_id:'wrong'}]},
  {...oauth,vars:{...VARS,SHOPIFY_API_SECRET:'plaintext'}},
])assert.throws(()=>prepareInactiveDetailManifest(bad));

const SECRETS=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const expected=[
  ...SECRETS.map(name=>({name,type:'secret_text',id:'synthetic-'+name})),
  ...Object.entries({...VARS,JILL_WORK_MERCHANT_WRITES_ENABLED:'true'})
    .map(([name,text])=>({name,type:'plain_text',text})),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:SHOP_DB},
];
const resources={
  bindings:expected,
  script:{etag:'old-asset',handlers:['fetch']},
  script_runtime:{
    compatibility_date:'2026-10-14',
    assets:{html_handling:'auto-trailing-slash',
      not_found_handling:'none'},
  },
};
const active={id:DETAIL_BASELINE,resources};
const candidate={id:'00000000-0000-4000-8000-000000000001',
  resources:{...structuredClone(resources),
    script:{etag:'new-asset',handlers:['fetch']},
  },
};
assert.equal(verifyInactiveDetailCandidate({active,candidate}).active,
  DETAIL_BASELINE);
const fake=(modify)=>{
  const copy=structuredClone(candidate);
  modify(copy);
  return copy;
};
for(const changed of [
  fake(v=>v.resources.bindings[0].id='changed-secret-ref'),
  fake(v=>v.resources.bindings=v.resources.bindings.slice(1)),
  fake(v=>v.resources.bindings.push({
    name:'JILL_WORK_HQ_DETAIL_ENABLED',type:'plain_text',text:'true'})),
  fake(v=>v.resources.bindings.find(b=>b.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false'),
  fake(v=>v.resources.bindings.find(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true'),
  fake(v=>v.resources.bindings.find(b=>b.name==='JILL_ORDER_DESK_WORK_DB').id='LIVE_DB'),
  fake(v=>v.resources.script.handlers=['fetch','scheduled']),
  fake(v=>v.resources.script.etag='old-asset'),
  fake(v=>v.resources.script_runtime.compatibility_date='2026-10-15'),
  fake(v=>v.resources.script_runtime.assets.html_handling='drop-trailing-slash'),
]){
  assert.throws(()=>verifyInactiveDetailCandidate({active,candidate:changed}));
}
assert.throws(()=>verifyInactiveDetailCandidate({
  active:{...active,id:'wrong'},candidate,
}));
console.log('PASS WORK detail v9 INACTIVE candidate: exact WORK origin/D1/four secret bindings, OAuth ON, Owner OFF, existing status writes ON, detail OFF; version/runtime/asset drift denied.');
