// Offline tests of exact WORK ON promotion; no cloud calls or secrets.
import assert from 'node:assert/strict';
import {verifyExactDetailOnRelease,detailOnReleaseArgs,
  DETAIL_ON_CANDIDATE,DETAIL_ON_RELEASE_APPROVAL,
  DETAIL_ON_ROLLBACK_APPROVAL}
  from './release-work-hq-detail-v9-on.mjs';
import {DETAIL_OFF_CANDIDATE}
  from './release-work-hq-detail-v9-off.mjs';
import {DETAIL_ON_FLAG,DETAIL_ON_MARKER}
  from './stage-work-hq-detail-v9-on.mjs';
const d1='3f17c186-c794-4e00-8f20-017191373a19';
const secrets=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const flags={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const bindings=[
  ...secrets.map(name=>({name,type:'secret_text',id:'ref-'+name})),
  ...Object.entries(flags).map(([name,text])=>({
    name,type:'plain_text',text,
  })),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:d1},
];
const resources={
  bindings,script:{etag:'immutable-v33-v34-source',handlers:['fetch']},
  script_runtime:{
    compatibility_date:'2026-10-14',
    assets:{html_handling:'auto-trailing-slash',
      not_found_handling:'none'},
  },
};
const baseline={
  id:DETAIL_OFF_CANDIDATE,
  metadata:{created_on:'2026-10-15T23:50:38Z'},
  resources,
};
const candidate={
  id:DETAIL_ON_CANDIDATE,
  annotations:{'workers/message':DETAIL_ON_MARKER},
  metadata:{created_on:'2026-10-16T02:07:45Z'},
  resources:{
    ...structuredClone(resources),
    bindings:[...structuredClone(bindings),
      {name:DETAIL_ON_FLAG,type:'plain_text',text:'true'}],
  },
};
const old={
  id:'00000000-0000-4000-8000-000000000001',
  metadata:{created_on:'2026-10-15T10:00:00Z'},
};
const versions=[old,baseline,candidate];
const payload={baseline,candidate,versions,current:DETAIL_OFF_CANDIDATE};
const verified=verifyExactDetailOnRelease(payload);
assert.equal(verified.from,DETAIL_OFF_CANDIDATE);
assert.equal(verified.to,DETAIL_ON_CANDIDATE);
assert.equal(verified.flag,DETAIL_ON_FLAG);
const rollback=verifyExactDetailOnRelease({
  ...payload,current:DETAIL_ON_CANDIDATE,mode:'rollback',
});
assert.equal(rollback.from,DETAIL_ON_CANDIDATE);
assert.equal(rollback.to,DETAIL_OFF_CANDIDATE);
assert.ok(detailOnReleaseArgs(DETAIL_ON_CANDIDATE).includes(
  DETAIL_ON_CANDIDATE+'@100%'));
assert.ok(detailOnReleaseArgs(DETAIL_OFF_CANDIDATE).includes(
  DETAIL_OFF_CANDIDATE+'@100%'));
assert.ok(detailOnReleaseArgs(DETAIL_ON_CANDIDATE).includes('--yes'));
assert.throws(()=>detailOnReleaseArgs('UNKNOWN'),
  /unknown_work_release_target/);
assert.match(DETAIL_ON_RELEASE_APPROVAL,/V9 ON$/);
assert.match(DETAIL_ON_ROLLBACK_APPROVAL,/V9$/);

const changed=fn=>{
  const copy=structuredClone(candidate);fn(copy);return copy;
};
for(const attempt of [
  {...payload,current:DETAIL_ON_CANDIDATE},
  {...payload,current:'THIRD_PARTY'},
  {...payload,mode:'invalid'},
  {...payload,candidate:{...candidate,id:'UNKNOWN'}},
  {...payload,versions:[...versions,{...candidate,id:'DUPLICATE'}]},
  {...payload,versions:[...versions,{
    id:'newer',metadata:{created_on:'2026-10-16T02:08:00Z'},
  }]},
  {...payload,candidate:changed(v=>v.resources.bindings[0].id='other-secret')},
  {...payload,candidate:changed(v=>v.resources.bindings.pop())},
  {...payload,candidate:changed(v=>v.resources.bindings.push({
    name:'UNEXPECTED',type:'plain_text',text:'true',
  }))},
  {...payload,candidate:changed(v=>v.resources.bindings.find(
    b=>b.name===DETAIL_ON_FLAG).text='false')},
  {...payload,candidate:changed(v=>v.resources.bindings.find(
    b=>b.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false')},
  {...payload,candidate:changed(v=>v.resources.bindings.find(
    b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true')},
  {...payload,candidate:changed(v=>v.resources.bindings.find(
    b=>b.name==='JILL_ORDER_DESK_WORK_DB').id='LIVE_DB')},
  {...payload,candidate:changed(v=>v.resources.script.etag='other-code')},
  {...payload,candidate:changed(v=>v.resources.script.handlers=['scheduled'])},
  {...payload,candidate:changed(v=>v.resources.script_runtime.compatibility_date='2026-10-16')},
]){
  assert.throws(()=>verifyExactDetailOnRelease(attempt));
}
assert.throws(()=>verifyExactDetailOnRelease({
  ...payload,current:DETAIL_OFF_CANDIDATE,mode:'rollback',
}));
console.log('PASS recovered WORK detail v9 ON exact v34 release: flags/secret/D1/code/routing parity; unknown/newer versions and mixed traffic denied; rollback only exact v33.');
