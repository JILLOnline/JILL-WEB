import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  selectVerifiedCandidate,inspectVersions,rolloutArguments,
} from './release-work-hq-merchant-inbox.mjs';

const A='49b10c46-8e00-4ef3-8075-74eea29e9c9e';
const C='3a201239-78cf-49f4-a8a6-d22a569f5343';
const MSG='JILL HQ WORK existing Google QA read key; NOT released';
const db='3f17c186-c794-4e00-8f20-017191373a19';
const bindings=[
  {name:'JILL_WORK_HOST_STAGE',type:'plain_text',text:'canary'},
  {name:'JILL_WORK_OAUTH_ENABLED',type:'plain_text',text:'true'},
  {name:'JILL_WORK_OWNER_BOOTSTRAP_ENABLED',type:'plain_text',text:'false'},
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:db},
  {name:'SHOPIFY_API_SECRET',type:'secret_text'},
  {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
];
const active={
  id:A,metadata:{created_on:'2026-10-14T23:49:25.230Z'},
  resources:{
    script:{etag:'checksum-of-unchanged-worker',handlers:['fetch']},
    script_runtime:{compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],usage_model:'standard',limits:{}},
    bindings,
  },
};
const candidate={
  ...structuredClone(active),id:C,
  metadata:{created_on:'2026-10-15T01:48:00.000Z'},
  annotations:{'workers/message':MSG},
  resources:{...structuredClone(active.resources),
    bindings:[...bindings,{name:'JILL_HQ_MERCHANT_READ_SECRET',type:'secret_text'}]},
};
const list=[candidate,{id:A,metadata:active.metadata,annotations:{}}];
assert.equal(selectVerifiedCandidate(list,active),C);
const okay=inspectVersions({active,candidate});
assert.equal(okay.candidateId,C);
assert.equal(okay.bindingCount,7);
assert.deepEqual(okay.secretNames,[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]);

const alter=(changed)=>({...structuredClone(candidate),...changed});
function invalid(x,pattern){assert.throws(()=>inspectVersions({active,candidate:x}),pattern);}
invalid(alter({resources:{...candidate.resources,
  script:{...candidate.resources.script,etag:'NEW_CODE'}}}),/worker_code_fingerprint_changed/);
invalid(alter({resources:{...candidate.resources,
  script_runtime:{...candidate.resources.script_runtime,compatibility_flags:[]}}}),/worker_runtime_changed/);
invalid(alter({resources:{...candidate.resources,
  bindings:candidate.resources.bindings.map(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED'
    ?{...b,text:'true'}:b)}}),/worker_stage_binding_invalid/);
invalid(alter({resources:{...candidate.resources,
  bindings:candidate.resources.bindings.filter(b=>b.name!=='JILL_HQ_MERCHANT_READ_SECRET')}}),/unexpected_binding_change/);
invalid(alter({resources:{...candidate.resources,
  bindings:candidate.resources.bindings.filter(b=>b.name!=='SHOPIFY_API_SECRET')}}),/unexpected_binding_change/);
invalid(alter({resources:{...candidate.resources,
  bindings:candidate.resources.bindings.map(b=>b.name==='JILL_ORDER_DESK_WORK_DB'
    ?{...b,id:'LIVE_DB'}:b)}}),/binding_changed/);
invalid(alter({resources:{...candidate.resources,
  bindings:[...candidate.resources.bindings,{name:'LIVE_API',type:'secret_text'}]}}),/unexpected_binding_change/);
invalid(alter({annotations:{'workers/message':'not the right candidate'}}),/candidate_message_mismatch/);
invalid(alter({metadata:{created_on:'2026-10-14T00:00:00Z'}}),/candidate_not_newer/);
assert.throws(()=>selectVerifiedCandidate([{
  id:C,metadata:candidate.metadata,annotations:{'workers/message':'DIFFERENT'},
},list[1]],active),/candidate_not_unique_or_missing/);
assert.throws(()=>selectVerifiedCandidate([candidate,candidate,list[1]],active),
  /candidate_not_unique_or_missing/);
assert.throws(()=>selectVerifiedCandidate([candidate,{
  id:'7a222222-70b0-4a0c-88e0-e942ec991997',
  metadata:{created_on:'2026-10-15T01:49:00.000Z'},
},list[1]],active),/candidate_not_latest/);
assert.throws(()=>selectVerifiedCandidate([candidate],active),/invalid_version_list/);
assert.throws(()=>selectVerifiedCandidate(list,{...active,id:'other'}),/active_version_changed/);
const args=rolloutArguments(C);
assert.deepEqual(args,[
  'versions','deploy',C+'@100%',
  '--name','jill-order-desk-canary-work','--config','./wrangler.canary.jsonc',
  '--yes','--message','JILL HQ WORK owner-only read-only Google merchant feed',
]);
assert.throws(()=>rolloutArguments('garbage'),/invalid_candidate_id/);
const source=fs.readFileSync('scripts/release-work-hq-merchant-inbox.mjs','utf8');
assert.match(source,/shell:false/);
assert.match(source,/RELEASE JILL HQ WORK INBOX/);
assert.match(source,/activeStatus\(\)===ACTIVE,'active_version_changed_at_approval'/);
assert.match(source,/inspectVersions\(\{active:version\(ACTIVE\),candidate:version\(id\)\}\)/);
assert.match(source,/await checkAnonymous\('\/app\/requests','deny'\)/);
assert.match(source,/await checkAnonymous\('\/app\/setup-owner',410\)/);
assert.doesNotMatch(source,/versions','secret','put'|secret put|--token|Get-Clipboard|readFileSync\([^)]*JILL-SECRETS|shopify app deploy|wrangler deploy|versions upload|randomBytes|setProperty|customer.*write/i);
console.log('PASS WORK HQ merchant candidate: single newest staged secret, identical code/runtime/bindings, Owner OFF, isolated WORK D1, rollback target pinned, explicit release consent and no secret access.');
