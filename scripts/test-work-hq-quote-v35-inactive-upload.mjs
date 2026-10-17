// No Cloudflare calls — adversarial inspection of inactive Worker upload
// candidate. Must not execute the operator entrypoint.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  prepareInactiveQuoteManifest as prepare,
  inspectInactiveQuoteVersion as inspect,
  selectQuoteCandidate as select,
  ACTIVE,FALLBACK,FLAG,RELEASE_MESSAGE_PREFIX,
} from './stage-work-hq-quote-inactive-v35.mjs';
let cases=0;
const pass=(fn)=>{fn();cases++};
const deny=(fn)=>{assert.throws(fn,/work_quote_stage_|WORK canary OAuth preparation refused/);cases++};
const DB='3f17c186-c794-4e00-8f20-017191373a19';
const key=['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET'];
const vars={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_HQ_DETAIL_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const base={
  name:'jill-order-desk-canary-work',
  main:'./index.js',
  compatibility_date:'2026-10-14',
  compatibility_flags:['nodejs_compat'],
  workers_dev:true,
  assets:{directory:'../client'},
  vars:{
    JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
    JILL_WORK_OAUTH_ENABLED:'false',
  },
  d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
    database_name:'jill-order-desk-work',database_id:DB}],
};
pass(()=>{
  const candidate=prepare(base);
  assert.deepEqual(Object.keys(candidate.vars).sort(),
    [...Object.keys(vars),FLAG].sort());
  assert.equal(candidate.vars[FLAG],'true');
  assert.equal(candidate.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
  assert.equal(candidate.vars.JILL_WORK_OAUTH_ENABLED,'true');
  assert.deepEqual(candidate.d1_databases,base.d1_databases);
  assert.deepEqual(base.vars.JILL_WORK_OAUTH_ENABLED,'false');
});
for(const bad of [
  null,[],{},
  {...base,name:'jill-order-desk-live'},
  {...base,vars:{...base.vars,JILL_WORK_HOST_STAGE:'live'}},
  {...base,vars:{...base.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
  {...base,vars:{...base.vars,JILL_WORK_OAUTH_ENABLED:'true'}},
  {...base,vars:{...base.vars,[FLAG]:'true'}},
  {...base,vars:{...base.vars,JILL_WORK_MERCHANT_WRITES_ENABLED:'true'}},
  {...base,vars:{...base.vars,SHOPIFY_API_SECRET:'leaked'}},
  {...base,d1_databases:[{...base.d1_databases[0],database_id:'fake'}]},
  {...base,d1_databases:[]},
  {...base,d1_databases:[...base.d1_databases,...base.d1_databases]},
  {...base,r2_buckets:[{binding:'ART',bucket_name:'art'}]},
  {...base,kv_namespaces:[{binding:'X',id:'x'}]},
  {...base,services:[{binding:'BACKDOOR',service:'live'}]},
  {...base,routes:['*/*']},
  {...base,images:{binding:'IMAGES'}},
  {...base,durable_objects:{bindings:[{name:'X'}]}},
])deny(()=>prepare(bad));
const binding=(name,text)=>({name,type:'plain_text',text});
const activeBindings=[
  ...Object.entries(vars).map(([k,v])=>binding(k,v)),
  ...key.map(name=>({name,type:'secret_text'})),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:DB},
];
const runtime={
  compatibility_date:'2026-10-14',
  compatibility_flags:['nodejs_compat'],
  exports:{default:['fetch']},
  assets:{html_handling:'auto-trailing-slash',
    not_found_handling:'none',run_worker_first:false,
    revision_id:'active-static-assets'},
};
const active={
  id:ACTIVE,metadata:{created_on:'2026-10-14T12:00:00.000Z'},
  resources:{
    bindings:activeBindings,
    script:{etag:'sha-active',handlers:['fetch']},
    script_runtime:runtime,
  },
};
const candidate={
  id:'dddddddd-1111-4222-8333-eeeeeeeeeeee',
  metadata:{created_on:'2026-10-17T16:00:00.000Z'},
  annotations:{'workers/message':RELEASE_MESSAGE_PREFIX+'a'.repeat(40)},
  resources:{
    bindings:[...activeBindings,binding(FLAG,'true')],
    script:{etag:'sha-candidate',handlers:['fetch']},
    script_runtime:{...runtime,
      assets:{...runtime.assets,revision_id:'candidate-static-assets'}},
  },
};
pass(()=>{
  const out=inspect({active,candidate});
  assert.equal(out.activeId,ACTIVE);
  assert.equal(out.candidateId,candidate.id);
  assert.equal(out.extraFlag,FLAG);
});
for(const modified of [
  {...candidate,id:ACTIVE},
  {...candidate,id:FALLBACK},
  {...candidate,resources:{...candidate.resources,bindings:activeBindings}},
  {...candidate,resources:{...candidate.resources,
    bindings:[...activeBindings,binding(FLAG,'false')]}},
  {...candidate,resources:{...candidate.resources,
    bindings:[...activeBindings.filter(x=>x.name!==key[0]),
      binding(FLAG,'true')]}},
  {...candidate,resources:{...candidate.resources,
    bindings:[...activeBindings.map(x=>x.name===vars.JILL_WORK_OAUTH_ENABLED?
      x:{...x}),binding(FLAG,'true'),binding('ROUTE','*/*')]}},
  {...candidate,resources:{...candidate.resources,
    bindings:[...activeBindings.map(x=>
      x.name==='JILL_WORK_HOST_STAGE'?binding(x.name,'live'):x),
      binding(FLAG,'true')]}},
  {...candidate,resources:{...candidate.resources,
    script:{...candidate.resources.script,etag:'sha-active'}}},
  {...candidate,resources:{...candidate.resources,
    script:{...candidate.resources.script,handlers:['fetch','scheduled']}}},
  {...candidate,resources:{...candidate.resources,
    script_runtime:{...runtime,compatibility_date:'2026-10-15'}}},
  {...candidate,resources:{...candidate.resources,
    script_runtime:{...runtime,assets:{...runtime.assets,
      run_worker_first:true}}}},
])deny(()=>inspect({active,candidate:modified}));
const marker=RELEASE_MESSAGE_PREFIX+'a'.repeat(40);
pass(()=>assert.equal(select([active,candidate],active,marker),candidate.id));
for(const pairs of [
  [active],
  [active,{...candidate,annotations:{'workers/message':'other'}}],
  [active,candidate,{...candidate,id:'extra'}],
  [active,{...candidate,metadata:{created_on:'2026-10-13T01:00:00Z'}}],
  [active,candidate,{id:'newer',metadata:{created_on:'2026-10-18T12:00:00Z'}}],
])deny(()=>select(pairs,active,marker));

const code=readFileSync(new URL(
  './stage-work-hq-quote-inactive-v35.mjs',import.meta.url),'utf8');
for(const required of [
  "'versions','upload','--dry-run'",
  "'versions','upload','--config'",
  "'deployments','status'",
  "'versions','view'",
  "'versions','list'",
  'checkCurrentActive();',
  'quoteTables();',
  'uploadAttempted=true',
  'No traffic switch was requested',
  'DO NOT retry',
  "JILL_BUILD_TARGET:'canary'",
  'work_checkout_not_synced',
  'work_quote_tables_unverified',
  'quote_flag_already_active',
  'quote_release_flag_missing',
]){
  assert.ok(code.includes(required),'Missing inactive-upload guard '+required);
  cases++;
}
for(const unsafe of [
  /cli\(\['deploy'/,
  /cli\(\['versions','deploy'/,
  /cli\(\['secret','put'/,
  /cli\(\['versions','secret','put'/,
  /cli\(\['d1','execute'.*--file/,
  /cli\(\['r2'/,
]){
  assert.doesNotMatch(code,unsafe);
  cases++;
}
console.log('PASS WORK v35 inactive quote upload OFFLINE: '+cases+
  ' candidate/manifests/bindings/canonical metadata/uniqueness/source & no-traffic tests.');
console.log('HOLD: no Cloudflare credential used, no actual version upload or deployment; user explicitly approved inspection-only upload on Owner Windows.');
