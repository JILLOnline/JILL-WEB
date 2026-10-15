import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  prepareWorkWriteManifest,assertWriteReleaseVersion,selectWriteCandidate,
  RELEASE_MARKER,
} from './stage-work-hq-write-release.mjs';

const activeId='e67a2209-f6d9-4671-b6fc-33994015af30';
const stagedId='6b70350e-0a5f-4630-8888-fe8a356a0a54';
const candidateId='987fe012-8bc6-4dfe-b2be-f03158fe77c9';
const db='3f17c186-c794-4e00-8f20-017191373a19';
const secret='JILL_HQ_MERCHANT_WRITE_SECRET';
const bindings=[
  {name:'JILL_HQ_MERCHANT_READ_SECRET',type:'secret_text'},
  {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
  {name:'SHOPIFY_API_SECRET',type:'secret_text'},
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:db},
  {name:'JILL_WORK_HOST_STAGE',type:'plain_text',text:'canary'},
  {name:'JILL_WORK_OAUTH_ENABLED',type:'plain_text',text:'true'},
  {name:'JILL_WORK_OWNER_BOOTSTRAP_ENABLED',type:'plain_text',text:'false'},
];
const base={
  name:'jill-order-desk-canary-work',
  vars:{
    JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OAUTH_ENABLED:'true',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  },
  d1_databases:[{
    binding:'JILL_ORDER_DESK_WORK_DB',
    database_id:db,database_name:'jill-order-desk-work',
  }],
  compatibility_flags:['nodejs_compat'],main:'worker.js',
};
const prepared=prepareWorkWriteManifest(base);
assert.equal(prepared.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
assert.equal(base.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,undefined);
assert.deepEqual(Object.keys(prepared.vars).sort(),[
  ...Object.keys(base.vars),'JILL_WORK_MERCHANT_WRITES_ENABLED'].sort());
assert.throws(()=>prepareWorkWriteManifest({
  ...base,vars:{...base.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'},
}));
assert.throws(()=>prepareWorkWriteManifest({
  ...base,vars:{...base.vars,JILL_WORK_MERCHANT_WRITES_ENABLED:'true'},
}));

const scriptRuntime={
  compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
  usage_model:'standard',assets:{binding:'ASSETS',run_worker_first:true},
};
const active={id:activeId,
  metadata:{created_on:'2026-10-14T00:00:00Z'},
  resources:{bindings,script:{etag:'before',handlers:['fetch']},
    script_runtime:scriptRuntime},
};
const staged=structuredClone(active);
staged.id=stagedId;
staged.metadata.created_on='2026-10-15T14:00:00Z';
staged.resources.bindings.push({name:secret,type:'secret_text'});
const candidate=structuredClone(staged);
candidate.id=candidateId;
candidate.metadata.created_on='2026-10-15T20:00:00Z';
candidate.annotations={'workers/message':RELEASE_MARKER};
candidate.resources.bindings.push({
  name:'JILL_WORK_MERCHANT_WRITES_ENABLED',type:'plain_text',text:'true',
});
candidate.resources.script.etag='reviewed_new_code';
candidate.resources.script_runtime.assets={
  binding:'ASSETS',run_worker_first:true,
  html_handling:'auto-trailing-slash',not_found_handling:'none',
};
assert.deepEqual(assertWriteReleaseVersion({
  active,stagedKey:staged,candidate,
}),{activeId,stagedId,candidateId});
const superseded={id:'e7bad727-b876-4895-866d-bc4dc583e280',
  metadata:{created_on:'2026-10-15T19:00:00Z'},
  annotations:{'workers/message':
    'JILL HQ WORK verified inline commands and source-cache v1; inactive'},
};
assert.equal(selectWriteCandidate([active,staged,superseded,candidate],active),candidateId);
assert.throws(()=>selectWriteCandidate([active,staged,superseded],active),
  /write_candidate_not_unique/);
assert.equal(selectWriteCandidate([active,staged,candidate],active),candidateId);
const mutate=[
  v=>{v.resources.bindings.find(x=>x.name==='JILL_WORK_OAUTH_ENABLED').text='false';},
  v=>{v.resources.bindings.find(x=>x.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true';},
  v=>{v.resources.bindings.find(x=>x.name==='JILL_ORDER_DESK_WORK_DB').id='LIVE';},
  v=>{v.resources.bindings.find(x=>x.name===secret).type='plain_text';},
  v=>{v.resources.bindings.pop();},
  v=>{v.resources.bindings.push({name:'extra_secret',type:'secret_text'});},
  v=>{v.resources.bindings.find(x=>x.name==='SHOPIFY_API_SECRET').type='plain_text';},
  v=>{v.resources.bindings.find(x=>x.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false';},
  v=>{v.resources.script.etag='before';},
  v=>{v.resources.script.handlers=['scheduled'];},
  v=>{v.resources.script_runtime.compatibility_flags=[];},
  v=>{v.resources.script_runtime.assets.run_worker_first=false;},
  v=>{v.resources.script_runtime.assets.not_found_handling='single-page-application';},
  v=>{v.resources.script_runtime.assets.html_handling='none';},
];
for(const fn of mutate){
  const wrong=structuredClone(candidate);fn(wrong);
  assert.throws(()=>assertWriteReleaseVersion({
    active,stagedKey:staged,candidate:wrong,
  }),'Must fail-closed on '+fn.toString());
}
assert.throws(()=>selectWriteCandidate([active,staged,candidate,{
  id:'later',metadata:{created_on:'2026-10-15T21:00:00Z'},
}],active),/newer_unknown/);
const file=readFileSync('scripts/stage-work-hq-write-release.mjs','utf8');
for(const pattern of [
  /versions','upload','--dry-run'/,
  /versions','upload','--config'/,
  /--secrets-file/,
  /work_source_not_synced/,
  /deployed\(\)===ACTIVE/,
  /STAGED_KEY/,
  /fs\.rmSync\(temp/,
  /JILL_HQ_MERCHANT_WRITE_SECRET/,
  /writeOAuthManifest/,
  /test:work-hq-merchant-command/,
  /test:work-hq-mail-outbox/,
])assert.match(file,pattern);
assert.doesNotMatch(file,/['"]versions['"],['"]deploy['"]|['"]secret['"],['"]put['"]|['"]shopify['"],['"]app['"],['"]deploy['"]/);
console.log('PASS isolated WORK write candidate: staged-only upload, original bindings, exact OAuth/Owner/D1, code-change proof, runtime/asset routes, private secret cleanup and fail-closed drift.');
