// Synthetic proof only: never contacts Wrangler, Google, Shopify or Cloudflare.
import assert from 'node:assert/strict';
import {verifyDetailOffRelease,detailOffReleaseArgs,
  requireAnonymousWorkSafety,DETAIL_OFF_CANDIDATE,DETAIL_OFF_APPROVAL}
  from './release-work-hq-detail-v9-off.mjs';
import {DETAIL_BASELINE,DETAIL_STAGE_MARKER}
  from './stage-work-hq-detail-v9.mjs';

const secrets=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const vars={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const bindings=[
  ...secrets.map(name=>({name,type:'secret_text',id:'unchanged-'+name})),
  ...Object.entries(vars).map(([name,text])=>({
    name,type:'plain_text',text,
  })),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
    database_id:'3f17c186-c794-4e00-8f20-017191373a19'},
];
const resources={
  bindings,script:{etag:'v4-code',handlers:['fetch']},
  script_runtime:{
    compatibility_date:'2026-10-14',
    assets:{html_handling:'auto-trailing-slash',
      not_found_handling:'none'},
  },
};
const active={id:DETAIL_BASELINE,
  metadata:{created_on:'2026-10-15T21:55:49Z'},
  resources};
const candidate={
  id:DETAIL_OFF_CANDIDATE,
  annotations:{'workers/message':DETAIL_STAGE_MARKER},
  metadata:{created_on:'2026-10-15T23:48:00Z'},
  resources:{...structuredClone(resources),script:{
    etag:'v9-detail-code',handlers:['fetch'],
  }},
};
const prior={
  id:'00000000-0000-4000-8000-000000000002',
  metadata:{created_on:'2026-10-15T20:00:00Z'},
};
const versions=[prior,active,candidate];
const valid={active,candidate,versions,current:DETAIL_BASELINE};
assert.equal(verifyDetailOffRelease(valid).candidate,DETAIL_OFF_CANDIDATE);
assert.deepEqual(detailOffReleaseArgs(DETAIL_OFF_CANDIDATE).slice(0,2),
  ['versions','deploy']);
assert.deepEqual(detailOffReleaseArgs(DETAIL_BASELINE).slice(0,2),
  ['versions','deploy']);
assert.ok(detailOffReleaseArgs(DETAIL_OFF_CANDIDATE).includes(
  DETAIL_OFF_CANDIDATE+'@100%'));
assert.throws(()=>detailOffReleaseArgs(prior.id),/unknown_work_version/);
assert.ok(DETAIL_OFF_APPROVAL.includes('DETAIL V9 OFF'));
const baseline={
  health:200,login:200,inbox:410,detail:410,owner:410,
  command:403,commandLocation:null,commandError:'invalid_origin',
};
assert.equal(requireAnonymousWorkSafety(baseline),true);
for(const [name,value] of [
  ['health',503],['login',503],['inbox',200],['detail',200],
  ['owner',200],['command',404],['commandLocation','/auth/login'],
  ['commandError','unknown'],
]){
  assert.throws(()=>requireAnonymousWorkSafety({
    ...baseline,[name]:value,
  }));
}
assert.equal(requireAnonymousWorkSafety({
  ...baseline,inbox:404,detail:404,
}),true);
const dup={
  ...candidate,id:'00000000-0000-4000-8000-000000000004',
};
for(const changed of [
  {...valid,current:'unknown-version'},
  {...valid,candidate:{...candidate,annotations:{
    'workers/message':'unknown-source',
  }}},
  {...valid,candidate:{...candidate,id:'wrong'}},
  {...valid,versions:[...versions,dup]},
  {...valid,versions:[...versions,{
    id:'00000000-0000-4000-8000-000000000003',
    metadata:{created_on:'2026-10-15T23:49:00Z'},
  }]},
  {...valid,versions:versions.map(v=>v===candidate?{
    ...v,metadata:{created_on:'2026-10-15T20:00:00Z'},
  }:v)},
  {...valid,candidate:{...candidate,resources:{
    ...candidate.resources,bindings:bindings.slice(1),
  }}},
  {...valid,candidate:{...candidate,resources:{
    ...candidate.resources,bindings:[
      ...bindings,{name:'JILL_WORK_HQ_DETAIL_ENABLED',
        type:'plain_text',text:'true'},
    ],
  }}},
  {...valid,candidate:{...candidate,resources:{
    ...candidate.resources,script:{etag:'v4-code',handlers:['fetch']},
  }}},
]){
  assert.throws(()=>verifyDetailOffRelease(changed));
}
console.log('PASS exact WORK detail v9 OFF release: immutable staged version, four-secret/D1/flag parity, no unknown newer uploads, verified traffic-only switch, post-release anonymous boundary and constrained rollback.');
