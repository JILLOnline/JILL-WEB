import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CANDIDATE,APPROVAL,assertReleaseCandidate,releaseArgs,
  anonymousCommandSafe,
} from './release-work-hq-write-management.mjs';
import {RELEASE_MARKER} from './stage-work-hq-write-release.mjs';

const ACTIVE='e67a2209-f6d9-4671-b6fc-33994015af30';
const STAGED='6b70350e-0a5f-4630-8888-fe8a356a0a54';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const original=[
  {name:'SHOPIFY_API_SECRET',type:'secret_text'},
  {name:'JILL_HQ_MERCHANT_READ_SECRET',type:'secret_text'},
  {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:D1},
  {name:'JILL_WORK_HOST_STAGE',type:'plain_text',text:'canary'},
  {name:'JILL_WORK_OAUTH_ENABLED',type:'plain_text',text:'true'},
  {name:'JILL_WORK_OWNER_BOOTSTRAP_ENABLED',type:'plain_text',text:'false'},
];
const asset={binding:'ASSETS',run_worker_first:true};
const active={
  id:ACTIVE,metadata:{created_on:'2026-10-14T20:00:00Z'},
  resources:{bindings:original,
    script:{etag:'old-code',handlers:['fetch']},
    script_runtime:{compatibility_date:'2026-10-14',
      compatibility_flags:['nodejs_compat'],assets:asset},
  },
};
const staged=structuredClone(active);
staged.id=STAGED;staged.metadata.created_on='2026-10-15T14:00:00Z';
staged.resources.bindings.push({
  name:'JILL_HQ_MERCHANT_WRITE_SECRET',type:'secret_text',
});
const candidate=structuredClone(staged);
candidate.id=CANDIDATE;candidate.metadata.created_on='2026-10-15T17:44:00Z';
candidate.resources.script.etag='new-code';
candidate.resources.script_runtime.assets={
  ...asset,html_handling:'auto-trailing-slash',not_found_handling:'none',
};
candidate.resources.bindings.push({
  name:'JILL_WORK_MERCHANT_WRITES_ENABLED',type:'plain_text',text:'true',
});
candidate.annotations={'workers/message':RELEASE_MARKER};
const superseded={
  id:'e7bad727-b876-4895-866d-bc4dc583e280',
  metadata:{created_on:'2026-10-15T17:25:00Z'},
  annotations:{'workers/message':
    'JILL HQ WORK verified inline commands and source-cache v1; inactive'},
};
const versions=[active,staged,superseded,candidate];
const valid={active,staged,candidate,versions,current:ACTIVE};
assert.deepEqual(assertReleaseCandidate(valid),{
  active:ACTIVE,candidate:CANDIDATE,
});
assert.throws(()=>assertReleaseCandidate({...valid,current:CANDIDATE}),
  /active_worker_changed/);
assert.throws(()=>assertReleaseCandidate({...valid,
  candidate:{...candidate,id:'other'}}),/candidate_version_mismatch/);
assert.throws(()=>assertReleaseCandidate({...valid,
  candidate:{...candidate,annotations:{'workers/message':'unknown'}}}),
  /candidate_version_mismatch/);
assert.throws(()=>assertReleaseCandidate({...valid,versions:[
  ...versions,{id:'later',metadata:{created_on:'2026-10-16T00:00:00Z'}}
]}),/newer_unknown_worker_version/);
const mutate=[
  c=>c.resources.bindings.push({name:'EXTRA',type:'secret_text'}),
  c=>c.resources.bindings.find(x=>x.name==='SHOPIFY_API_SECRET').type='plain_text',
  c=>c.resources.bindings.find(x=>x.name==='JILL_HQ_MERCHANT_WRITE_SECRET').type='plain_text',
  c=>c.resources.bindings.find(x=>x.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true',
  c=>c.resources.bindings.find(x=>x.name==='JILL_WORK_OAUTH_ENABLED').text='false',
  c=>c.resources.bindings.find(x=>x.name==='JILL_ORDER_DESK_WORK_DB').id='LIVE',
  c=>c.resources.bindings.find(x=>x.name==='JILL_WORK_MERCHANT_WRITES_ENABLED').text='false',
  c=>c.resources.script.etag='old-code',
  c=>c.resources.script.handlers=['scheduled'],
  c=>c.resources.script_runtime.compatibility_flags=[],
  c=>c.resources.script_runtime.assets.run_worker_first=false,
];
for(const change of mutate){
  const wrong=structuredClone(candidate);change(wrong);
  assert.throws(()=>assertReleaseCandidate({...valid,candidate:wrong}),
    'must block '+change.toString());
}
assert.deepEqual(releaseArgs(CANDIDATE),[
  'versions','deploy',CANDIDATE+'@100%','--name',
  'jill-order-desk-canary-work','--config','./wrangler.canary.jsonc',
  '--yes','--message','JILL HQ WORK verified request management',
]);
assert.deepEqual(releaseArgs(ACTIVE,
  'JILL HQ WORK rollback to verified prior version').slice(0,3),
  ['versions','deploy',ACTIVE+'@100%']);
assert.throws(()=>releaseArgs('unknown'),/unknown_work/);
// The corrected Worker is required to return exact 403 (invalid Origin)
 // before Shopify handles the anonymous POST. Redirects and 404/410 MUST
 // fail, even if some previous SDK deployments used those statuses.
assert.equal(anonymousCommandSafe(403,null),true);
for(const [code,location] of [
  [200,null],[401,null],[404,null],[410,null],[500,null],
  [302,'/auth/login'],
  [302,'https://admin.shopify.com/store/jill-work'],
  [403,'https://admin.shopify.com/store/jill-work'],
  [302,'https://evil.example/steal'],
]){
  assert.throws(()=>anonymousCommandSafe(code,location),
    /anonymous_command_not_denied/);
}
assert.equal(CANDIDATE,'a57b9b91-84e8-44db-bd2b-144646d5b342');
assert.notEqual(CANDIDATE,superseded.id);
assert.equal(APPROVAL,'RELEASE JILL HQ WORK MANAGEMENT');
const source=readFileSync('scripts/release-work-hq-write-management.mjs','utf8');
for(const re of [
  /work_source_not_synced/,
  /work:hq:qa:write-key:probe/,
  /release_not_approved/,
  /assertWriteReleaseVersion/,
  /selectWriteCandidate/,
  /versions','deploy'/,
  /check\('\/app\/requests\/command'/,
  /anonymousCommandSafe/,
  /anonymous_command_bad_ack/,
  /reply\?\.error==='invalid_origin'/,
  /PASS automatic WORK rollback/,
])assert.match(source,re);
assert.doesNotMatch(source,/secret put|versions','upload|Get-Clipboard|LIVE\\.SHOPIFY/);
console.log('PASS WORK HQ activation: exact staged code+key version, four preserved secrets, Owner/OAuth/D1 boundaries, explicit approval, anonymous command denial, rollback, no LIVE deploy.');
