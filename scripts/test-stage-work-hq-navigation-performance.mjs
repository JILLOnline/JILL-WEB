import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  NAVIGATION_RELEASE_MARKER,preparePerformanceManifest,
  assertPerformanceWorkerVersion,selectPerformanceCandidate,
} from './stage-work-hq-navigation-performance.mjs';

const activeId='e818c639-f962-4a09-9399-54ab521531c3';
const newId='15f2a08c-96e0-4cc5-9602-326b2425295e';
const db='3f17c186-c794-4e00-8f20-017191373a19';
const flags={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const base={
  name:'jill-order-desk-canary-work',vars:{
    ...flags,JILL_WORK_MERCHANT_WRITES_ENABLED:undefined,
  },
  compatibility_flags:['nodejs_compat'],
  d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
    database_id:db,database_name:'jill-order-desk-work'}],
};
delete base.vars.JILL_WORK_MERCHANT_WRITES_ENABLED;
const output=preparePerformanceManifest(base);
assert.deepEqual(output.vars,flags);
assert.equal(base.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,undefined);
for(const wrong of [
  {...base,name:'jill-order-desk-live'},
  {...base,vars:{...base.vars,JILL_WORK_OAUTH_ENABLED:'false'}},
  {...base,vars:{...base.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
  {...base,vars:{...base.vars,SHOPIFY_API_SECRET:'oops'}},
  {...base,d1_databases:[{
    binding:'JILL_ORDER_DESK_WORK_DB',database_id:'LIVE',
  }]},
])assert.throws(()=>preparePerformanceManifest(wrong));

const secrets=[
  'SHOPIFY_API_SECRET','JILL_HQ_MERCHANT_READ_SECRET',
  'JILL_WORK_SESSION_KEY_B64','JILL_HQ_MERCHANT_WRITE_SECRET',
].map(name=>({name,type:'secret_text'}));
const bindings=[
  ...secrets,
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
    database_id:db},
  ...Object.entries(flags).map(([name,text])=>({
    name,type:'plain_text',text,
  })),
];
const runtime={
  compatibility_date:'2026-10-14',
  compatibility_flags:['nodejs_compat'],
  usage_model:'standard',
  assets:{binding:'ASSETS',run_worker_first:true},
};
const active={
  id:activeId,
  metadata:{created_on:'2026-10-15T19:57:25.000Z'},
  resources:{bindings,script:{etag:'old-code',handlers:['fetch']},
    script_runtime:runtime},
};
const candidate=structuredClone(active);
candidate.id=newId;
candidate.resources.script.etag='new-code';
candidate.metadata.created_on='2026-10-15T20:30:00Z';
candidate.resources.script_runtime.assets={
  ...runtime.assets,
  html_handling:'auto-trailing-slash',
  not_found_handling:'none',
};
candidate.annotations={'workers/message':NAVIGATION_RELEASE_MARKER};
assert.deepEqual(assertPerformanceWorkerVersion({active,candidate}),{
  active:activeId,candidate:newId,
});
assert.equal(selectPerformanceCandidate([active,candidate],active),newId);
// The previously active navigation v1 is now the only allowed release baseline,
// not a new candidate for the v2 stability release.
assert.equal(active.id,'e818c639-f962-4a09-9399-54ab521531c3');
assert.equal(NAVIGATION_RELEASE_MARKER,
  'JILL HQ WORK auth-safe single-reader v3; inactive');
assert.throws(()=>selectPerformanceCandidate([active],active),
  /navigation_candidate_not_unique/);
assert.throws(()=>selectPerformanceCandidate([active,candidate,candidate],active),
  /navigation_candidate_not_unique/);
assert.throws(()=>selectPerformanceCandidate([active,candidate,{
  id:'later',metadata:{created_on:'2026-10-15T21:00:00Z'},
}],active),/unexpected_newer_worker_version/);
for(const change of [
  c=>c.resources.bindings.pop(),
  c=>c.resources.bindings.push({name:'UNEXPECTED',type:'secret_text'}),
  c=>c.resources.bindings.find(b=>b.name==='SHOPIFY_API_SECRET').type='plain_text',
  c=>c.resources.bindings.find(b=>b.name==='JILL_HQ_MERCHANT_WRITE_SECRET').type='plain_text',
  c=>c.resources.bindings.find(b=>b.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false',
  c=>c.resources.bindings.find(b=>b.name==='JILL_WORK_OAUTH_ENABLED').text='false',
  c=>c.resources.bindings.find(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true',
  c=>c.resources.bindings.find(b=>b.name==='JILL_ORDER_DESK_WORK_DB').database_id='LIVE',
  c=>c.resources.script.etag='old-code',
  c=>c.resources.script.handlers=['scheduled'],
  c=>c.resources.script_runtime.compatibility_flags=[],
  c=>c.resources.script_runtime.assets.run_worker_first=false,
  c=>c.resources.script_runtime.assets.not_found_handling='single-page-application',
]){
  const wrong=structuredClone(candidate);
  change(wrong);
  assert.throws(()=>assertPerformanceWorkerVersion({
    active,candidate:wrong,
  }),'Must reject '+change.toString());
}
const source=readFileSync('scripts/stage-work-hq-navigation-performance.mjs','utf8');
for(const re of [
  /active_worker_changed/,
  /--secrets-file/,
  /versions','upload','--dry-run'/,
  /versions','upload',\.\.\.upload/,
  /fs\.rmSync\(temporary/,
  /test:work-hq-request-detail/,
  /test:work-hq-merchant-command/,
  /test:workerd-oauth/,
  /work_source_not_synced/,
  /privateWorkWriteKey/,
  /JILL_WORK_MERCHANT_WRITES_ENABLED/,
  /selectPerformanceCandidate/,
])assert.match(source,re);
assert.doesNotMatch(source,
  /versions','deploy|secret','put|shopify','app','deploy/);
console.log('PASS WORK navigation staging: exact active navigation v1, unchanged four secrets/WORK D1/OAuth/Owner/write flags, new code only, no traffic switch, local key disposal and drift denial.');
