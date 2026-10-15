import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ACTIVE,CANDIDATE,APPROVAL,assertNavigationRelease,
  releaseArgs,requireCommandDenial,
} from './release-work-hq-navigation-performance.mjs';
import {NAVIGATION_RELEASE_MARKER}
  from './stage-work-hq-navigation-performance.mjs';

const db='3f17c186-c794-4e00-8f20-017191373a19';
const flags={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const bindings=[
  ...[
    'SHOPIFY_API_SECRET','JILL_HQ_MERCHANT_READ_SECRET',
    'JILL_WORK_SESSION_KEY_B64','JILL_HQ_MERCHANT_WRITE_SECRET',
  ].map(name=>({name,type:'secret_text'})),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',database_id:db},
  ...Object.entries(flags).map(([name,text])=>({
    name,type:'plain_text',text,
  })),
];
const active={
  id:ACTIVE,metadata:{created_on:'2026-10-15T17:43:59.179Z'},
  resources:{
    bindings,
    script:{etag:'management-v2',handlers:['fetch']},
    script_runtime:{
      compatibility_date:'2026-10-14',
      compatibility_flags:['nodejs_compat'],
      assets:{binding:'ASSETS',run_worker_first:true},
    },
  },
};
const candidate=structuredClone(active);
candidate.id=CANDIDATE;
candidate.metadata.created_on='2026-10-15T19:57:25Z';
candidate.annotations={'workers/message':NAVIGATION_RELEASE_MARKER};
candidate.resources.script.etag='fast-navigation';
candidate.resources.script_runtime.assets={
  ...active.resources.script_runtime.assets,
  html_handling:'auto-trailing-slash',
  not_found_handling:'none',
};
const versions=[active,{id:'superseded',
  metadata:{created_on:'2026-10-15T18:00:00Z'}},candidate];
const inputs={active,candidate,versions,current:ACTIVE};
assert.deepEqual(assertNavigationRelease(inputs),
  {active:ACTIVE,candidate:CANDIDATE});
assert.throws(()=>assertNavigationRelease({...inputs,current:CANDIDATE}),
  /active_worker_changed/);
assert.throws(()=>assertNavigationRelease({...inputs,
  candidate:{...candidate,id:'superseded'}}),/candidate_version_mismatch/);
assert.throws(()=>assertNavigationRelease({...inputs,
  candidate:{...candidate,annotations:{'workers/message':'wrong'}}}),
  /candidate_version_mismatch/);
assert.throws(()=>assertNavigationRelease({...inputs,versions:[
  ...versions,{id:'future',
    metadata:{created_on:'2026-10-16T00:00:00Z'}},
]}),/unexpected_newer_worker_version/);
for(const change of [
  v=>v.resources.bindings.pop(),
  v=>v.resources.bindings.push({name:'EXTRA',type:'secret_text'}),
  v=>v.resources.bindings.find(b=>b.name==='SHOPIFY_API_SECRET').type='plain_text',
  v=>v.resources.bindings.find(b=>b.name==='JILL_HQ_MERCHANT_WRITE_SECRET').type='plain_text',
  v=>v.resources.bindings.find(b=>b.name==='JILL_WORK_OAUTH_ENABLED').text='false',
  v=>v.resources.bindings.find(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true',
  v=>v.resources.bindings.find(b=>b.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false',
  v=>v.resources.bindings.find(b=>b.name==='JILL_ORDER_DESK_WORK_DB').database_id='LIVE',
  v=>v.resources.script.etag='management-v2',
  v=>v.resources.script.handlers=['scheduled'],
  v=>v.resources.script_runtime.compatibility_flags=[],
  v=>v.resources.script_runtime.assets.run_worker_first=false,
  v=>v.resources.script_runtime.assets.not_found_handling='single-page-application',
]){
  const altered=structuredClone(candidate);
  change(altered);
  assert.throws(()=>assertNavigationRelease({
    ...inputs,candidate:altered,
  }),'must reject: '+change.toString());
}
assert.deepEqual(releaseArgs(CANDIDATE),[
  'versions','deploy',CANDIDATE+'@100%','--name',
  'jill-order-desk-canary-work','--config','./wrangler.canary.jsonc',
  '--yes','--message','JILL HQ WORK faster verified navigation',
]);
assert.deepEqual(releaseArgs(ACTIVE,'rollback').slice(0,3),[
  'versions','deploy',ACTIVE+'@100%',
]);
assert.throws(()=>releaseArgs('unknown'),/unapproved_worker_version/);
assert.equal(requireCommandDenial({
  status:403,location:null,body:{ok:false,error:'invalid_origin'},
}),true);
for(const args of [
  {status:200,location:null,body:{ok:false,error:'invalid_origin'}},
  {status:401,location:null,body:{ok:false,error:'invalid_origin'}},
  {status:404,location:null,body:{ok:false,error:'invalid_origin'}},
  {status:410,location:null,body:{ok:false,error:'invalid_origin'}},
  {status:302,location:'/auth/login',body:{ok:false,error:'invalid_origin'}},
  {status:403,location:'https://evil.test',body:{ok:false,error:'invalid_origin'}},
  {status:403,location:null,body:{ok:false,error:'unauthorized'}},
  {status:403,location:null,body:{ok:true,error:'invalid_origin'}},
  {status:403,location:null,body:undefined},
])
  assert.throws(()=>requireCommandDenial(args),/anonymous_command_not_denied/);
assert.equal(APPROVAL,'RELEASE JILL HQ WORK NAVIGATION V1');
const src=readFileSync('scripts/release-work-hq-navigation-performance.mjs','utf8');
for(const expression of [
  /--inspect/,/work_source_not_synced/,/qa_write_key_probe_failed/,
  /work:hq:qa:write-key:probe/,/assertPerformanceWorkerVersion/,
  /selectPerformanceCandidate/,/NAVIGATION_RELEASE_MARKER/,
  /reply\.json\(\)/,/\/app\/requests\/command/,
  /\/app\/setup-owner/,/\/healthz/,/\/auth\/login/,
  /PASS automatic WORK rollback to management v2/,
  /if\(phase==='release'\|\|phase==='post_release'\)/,
  /versions','deploy'/,
]) assert.match(src,expression);
assert.doesNotMatch(src,/versions','upload|secret','put|shopify','app','deploy/);
console.log('PASS WORK navigation activation: exact staged v1 candidate, full 4-secret/WORK D1/OAuth/Owner/write invariants, explicit approval, strict 403, safe rollback after deploy errors and zero LIVE operations.');
