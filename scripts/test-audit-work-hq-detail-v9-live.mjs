// Synthetic post-release safety regression; never contacts live services.
import assert from 'node:assert/strict';
import {verifyWorkDetailLive}
  from './audit-work-hq-detail-v9-live.mjs';
import {DETAIL_ON_CANDIDATE}
  from './release-work-hq-detail-v9-on.mjs';
import {DETAIL_OFF_CANDIDATE}
  from './release-work-hq-detail-v9-off.mjs';
import {DETAIL_ON_MARKER,DETAIL_ON_FLAG}
  from './stage-work-hq-detail-v9-on.mjs';

const d1='3f17c186-c794-4e00-8f20-017191373a19';
const flags={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const names=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const bindings=[
  ...names.map(name=>({name,type:'secret_text',id:'synthetic-'+name})),
  ...Object.entries(flags).map(([name,text])=>({
    name,type:'plain_text',text,
  })),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:d1},
];
const baseResources={
  bindings,
  script:{etag:'same-code',handlers:['fetch']},
  script_runtime:{
    compatibility_date:'2026-10-14',
    assets:{html_handling:'auto-trailing-slash',not_found_handling:'none'},
  },
};
const baseline={
  id:DETAIL_OFF_CANDIDATE,
  metadata:{created_on:'2026-10-15T23:50:38Z'},
  resources:baseResources,
};
const candidate={
  id:DETAIL_ON_CANDIDATE,
  annotations:{'workers/message':DETAIL_ON_MARKER},
  metadata:{created_on:'2026-10-16T02:07:45Z'},
  resources:{
    ...structuredClone(baseResources),
    bindings:[...structuredClone(bindings),
      {name:DETAIL_ON_FLAG,type:'plain_text',text:'true'}],
  },
};
const input={activeVersion:DETAIL_ON_CANDIDATE,baseline,candidate,
  versions:[baseline,candidate]};
const receipt=verifyWorkDetailLive(input);
assert.equal(receipt.version,DETAIL_ON_CANDIDATE);
assert.equal(receipt.fallback,DETAIL_OFF_CANDIDATE);
assert.equal(receipt.detailFlag,DETAIL_ON_FLAG);
assert.ok(Object.isFrozen(receipt));
const edit=fn=>{const v=structuredClone(candidate);fn(v);return v;};
for(const mutation of [
  {...input,activeVersion:DETAIL_OFF_CANDIDATE},
  {...input,activeVersion:'UNKNOWN'},
  {...input,candidate:{...candidate,id:'UNKNOWN'}},
  {...input,versions:[baseline,candidate,{...candidate,id:'DUPLICATE'}]},
  {...input,versions:[baseline,candidate,{
    id:'newer',metadata:{created_on:'2026-10-16T02:08:00Z'},
  }]},
  {...input,candidate:edit(v=>v.resources.bindings[0].id='different-secret')},
  {...input,candidate:edit(v=>v.resources.bindings.find(
    x=>x.name===DETAIL_ON_FLAG).text='false')},
  {...input,candidate:edit(v=>v.resources.bindings.find(
    x=>x.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false')},
  {...input,candidate:edit(v=>v.resources.bindings.find(
    x=>x.name==='JILL_ORDER_DESK_WORK_DB').id='LIVE')},
  {...input,candidate:edit(v=>v.resources.script.etag='changed')},
]){
  assert.throws(()=>verifyWorkDetailLive(mutation));
}
console.log('PASS post-release WORK v34 LIVE audit contract: v34 active, v33 rollback, exact v9 detail flag, untouched four secrets/WORK D1/OAuth/writes, no unknown newer versions or code drift.');
