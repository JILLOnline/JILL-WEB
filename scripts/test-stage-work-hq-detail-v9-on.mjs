// Synthetic isolation tests: no Google, Shopify or Cloudflare connection.
import assert from 'node:assert/strict';
import {prepareWorkDetailOnManifest,verifyWorkDetailOnCandidate,
  selectInactiveDetailOnVersion,DETAIL_ON_FLAG,DETAIL_ON_MARKER}
  from './stage-work-hq-detail-v9-on.mjs';
import {DETAIL_OFF_CANDIDATE}
  from './release-work-hq-detail-v9-off.mjs';

const d1='3f17c186-c794-4e00-8f20-017191373a19';
const oauth={
  name:'jill-order-desk-canary-work',
  compatibility_flags:['nodejs_compat'],
  main:'./index.js',
  d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
    database_name:'jill-order-desk-work',database_id:d1}],
  vars:{JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
    JILL_WORK_OAUTH_ENABLED:'true'},
};
const on=prepareWorkDetailOnManifest(oauth);
assert.equal(on.vars[DETAIL_ON_FLAG],'true');
assert.equal(on.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
assert.equal(on.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
assert.equal(on.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(on.vars.JILL_WORK_HOST_STAGE,'canary');
assert.equal(on.name,'jill-order-desk-canary-work');
assert.ok(!Object.hasOwn(oauth.vars,DETAIL_ON_FLAG));
assert.equal(Object.keys(on.vars).length,5);
for(const wrong of [
  {...oauth,name:'jill-order-desk-work'},
  {...oauth,vars:{...oauth.vars,JILL_WORK_OAUTH_ENABLED:'false'}},
  {...oauth,vars:{...oauth.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
  {...oauth,vars:{...oauth.vars,JILL_WORK_HQ_DETAIL_ENABLED:'true'}},
  {...oauth,vars:{...oauth.vars,SHOPIFY_API_SECRET:'PLAINTEXT'}},
  {...oauth,d1_databases:[{...oauth.d1_databases[0],database_id:'LIVE'}]},
])assert.throws(()=>prepareWorkDetailOnManifest(wrong));

const secrets=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const v={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const base=[
  ...secrets.map(name=>({name,type:'secret_text',id:'opaque-'+name})),
  ...Object.entries(v).map(([name,text])=>({name,type:'plain_text',text})),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:d1},
];
const runtime={compatibility_date:'2026-10-14',
  assets:{html_handling:'auto-trailing-slash',not_found_handling:'none'}};
const active={id:DETAIL_OFF_CANDIDATE,
  metadata:{created_on:'2026-10-15T23:50:00Z'},
  resources:{bindings:base,script:{etag:'same-code',handlers:['fetch']},
    script_runtime:runtime}};
const candidate={
  id:'00000000-0000-4000-8000-000000000008',
  annotations:{'workers/message':DETAIL_ON_MARKER},
  metadata:{created_on:'2026-10-15T23:55:00Z'},
  resources:{bindings:[...structuredClone(base),
    {name:DETAIL_ON_FLAG,type:'plain_text',text:'true'}],
    script:{etag:'same-code',handlers:['fetch']},
    script_runtime:structuredClone(runtime)},
};
const checked=verifyWorkDetailOnCandidate({active,candidate});
assert.equal(checked.addition,DETAIL_ON_FLAG);
assert.equal(selectInactiveDetailOnVersion([active,candidate],active),candidate.id);
function mutation(fn){const c=structuredClone(candidate);fn(c);return c;}
for(const changed of [
  mutation(c=>c.resources.bindings[0].id='different-secret'),
  mutation(c=>c.resources.bindings.pop()),
  mutation(c=>c.resources.bindings.push({
    name:'UNREVIEWED_BINDING',type:'secret_text'})),
  mutation(c=>c.resources.bindings.find(b=>b.name===DETAIL_ON_FLAG).text='false'),
  mutation(c=>c.resources.bindings.find(b=>b.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false'),
  mutation(c=>c.resources.bindings.find(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true'),
  mutation(c=>c.resources.bindings.find(b=>b.name==='JILL_ORDER_DESK_WORK_DB').id='LIVE'),
  mutation(c=>c.resources.script.etag='changed-code'),
  mutation(c=>c.resources.script.handlers=['scheduled']),
  mutation(c=>c.resources.script_runtime.compatibility_date='2026-10-16'),
  mutation(c=>c.resources.script_runtime.assets.html_handling='force-trailing-slash'),
])assert.throws(()=>verifyWorkDetailOnCandidate({active,candidate:changed}));
assert.throws(()=>verifyWorkDetailOnCandidate({
  active:{...active,id:'UNKNOWN'},candidate}));
assert.throws(()=>selectInactiveDetailOnVersion(
  [active,candidate,{...candidate,id:'DUPLICATE'}],active));
assert.throws(()=>selectInactiveDetailOnVersion(
  [active,candidate,{id:'NEWER',metadata:{created_on:'2026-10-15T23:56:00Z'}}],active));
console.log('PASS WORK full-detail ON INACTIVE stage: sole explicit flag addition, identical four secret bindings, WORK D1, OAuth ON, Owner OFF, writes ON, same code/runtime/routing, unknown/newer candidates refused.');
