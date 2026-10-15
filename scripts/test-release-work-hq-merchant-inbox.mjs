import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  selectVerifiedCandidate,inspectVersions,rolloutArguments,
  sameStructuredData,safeRuntimeDiffLabels,safeRuntimeDiffShapes,
  safeUnknownRuntimeDifferences,
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

// Cloudflare REST metadata may reorder JSON object properties while retaining
// precisely the same values. A plain JSON.stringify comparison would falsely
// identify such responses as runtime drift.
assert.equal(sameStructuredData(
  {limits:{cpu_ms:200,subrequests:100},usage_model:'standard'},
  {usage_model:'standard',limits:{subrequests:100,cpu_ms:200}}),true);
assert.equal(sameStructuredData(
  {limits:{cpu_ms:200}},{limits:{cpu_ms:201}}),false);
assert.equal(sameStructuredData(['nodejs_compat','other'],['other','nodejs_compat']),false);
const activeOrder=structuredClone(active);
const candidateOrder=structuredClone(candidate);
activeOrder.resources.script_runtime.limits={cpu_ms:200,subrequests:100};
candidateOrder.resources.script_runtime.limits={subrequests:100,cpu_ms:200};
candidateOrder.resources.script_runtime={
  usage_model:'standard',
  limits:candidateOrder.resources.script_runtime.limits,
  compatibility_flags:['nodejs_compat'],
  compatibility_date:'2026-10-14',
};
candidateOrder.resources.bindings=candidateOrder.resources.bindings.map(b=>{
  if(b.name==='JILL_ORDER_DESK_WORK_DB')
    return {id:b.id,type:b.type,name:b.name};
  return b;
});
assert.equal(inspectVersions({active:activeOrder,candidate:candidateOrder}).candidateId,C);
assert.deepEqual(safeRuntimeDiffLabels(activeOrder.resources.script_runtime,
  candidateOrder.resources.script_runtime),[]);
assert.deepEqual(safeRuntimeDiffLabels(active.resources.script_runtime,{
  ...active.resources.script_runtime,compatibility_flags:[],
  limits:{cpu_ms:99},
}),['compatibility_flags','limits']);
assert.deepEqual(safeRuntimeDiffLabels(active.resources.script_runtime,{
  ...active.resources.script_runtime,unexpected_private_value:'SHOULD_NOT_BE_LOGGED',
}),['other_runtime_settings']);

assert.deepEqual(safeRuntimeDiffLabels(active.resources.script_runtime,{
  ...active.resources.script_runtime,
  exports:{WorkerEntrypoint:{type:'worker',state:'created'}},
  migration_tag:'UNTRUSTED_OR_PRIVATE_VALUE',
}),['exports','migration_tag']);
const reports=safeRuntimeDiffShapes(active.resources.script_runtime,{
  ...active.resources.script_runtime,
  exports:{SENSITIVE_CLASS_NAME:{type:'durable-object',storage:'sqlite'}},
  migration_tag:'PRIVATE_MIGRATION_TAG',
});
assert.deepEqual(reports,[
  'exports (active=absent, candidate=object)',
  'migration_tag (active=absent, candidate=string)',
]);
assert.ok(!JSON.stringify(reports).includes('SENSITIVE_CLASS_NAME'));
assert.ok(!JSON.stringify(reports).includes('PRIVATE_MIGRATION_TAG'));
assert.deepEqual(safeRuntimeDiffShapes(active.resources.script_runtime,{
  ...active.resources.script_runtime,
  unknown_token:'DO_NOT_EXPOSE',
}),['other_runtime_settings (unknown API members; blocked)']);
assert.deepEqual(safeRuntimeDiffShapes(
  {...active.resources.script_runtime,exports:{WorkerEntrypoint:{type:'worker'}}},
  {...active.resources.script_runtime,exports:{WorkerEntrypoint:{type:'worker'}},
    migration_tag:'v1'},
),['migration_tag (active=absent, candidate=string)']);


// Only UNKNOWN Cloudflare API keys (not their values) may appear in output.
const unknownA={
  ...active.resources.script_runtime,
  placement:{mode:'smart',secret_token:'never log nested values'},
  compatibility_date:'2026-10-14',
  cloudflare_internal_setting:true,
  auth_token:'A SENSITIVE VALUE',
};
const unknownC={
  ...active.resources.script_runtime,
  placement:{mode:'off',secret_token:'never log nested values'},
  cloudflare_internal_setting:null,
  auth_token:'DIFFERENT SENSITIVE VALUE',
  observability:{head_sampling_rate:0.2},
  'BADDY<SECRET>':'DO NOT PRINT',
};
const safe=safeUnknownRuntimeDifferences(unknownA,unknownC);
assert.deepEqual(safe,[
  'redacted_field_name (active=absent, candidate=string)',
  'redacted_field_name (active=string, candidate=string)',
  'cloudflare_internal_setting (active=boolean, candidate=null)',
  'observability (active=absent, candidate=object)',
  'placement (active=object, candidate=object)',
]);
assert.ok(!JSON.stringify(safe).includes('SENSITIVE VALUE'));
assert.ok(!JSON.stringify(safe).includes('never log'));
assert.ok(!JSON.stringify(safe).includes('BADDY'));
assert.ok(!JSON.stringify(safe).includes('auth_token'));
assert.deepEqual(safeUnknownRuntimeDifferences({known_extra:{a:1}},
  {known_extra:{a:1}}),[]);
assert.deepEqual(safeUnknownRuntimeDifferences({},{runtime_options:false}),
  ['runtime_options (active=absent, candidate=boolean)']);
assert.equal(safeUnknownRuntimeDifferences(
  Object.fromEntries(Array.from({length:18},(_,i)=>['extra_'+i,0])),
  Object.fromEntries(Array.from({length:18},(_,i)=>['extra_'+i,1]))
).at(-1),'additional_fields_omitted');

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
assert.match(source,/safeRuntimeDiffLabels/);
assert.match(source,/safeRuntimeDiffShapes/);
assert.match(source,/safeUnknownRuntimeDifferences/);
assert.match(source,/unknown runtime key \\(name\\/type only\\)/);
assert.match(source,/'exports'/);
assert.match(source,/'migration_tag'/);
assert.match(source,/WORK runtime differences \(API fields only\):/);
assert.doesNotMatch(source,/JSON\.stringify\(active\.resources\.script_runtime\)===/);
assert.match(source,/RELEASE JILL HQ WORK INBOX/);
assert.match(source,/activeStatus\(\)===ACTIVE,'active_version_changed_at_approval'/);
assert.match(source,/inspectVersions\(\{active:version\(ACTIVE\),candidate:version\(id\)\}\)/);
assert.match(source,/await checkAnonymous\('\/app\/requests','deny'\)/);
assert.match(source,/await checkAnonymous\('\/app\/setup-owner',410\)/);
assert.doesNotMatch(source,/versions','secret','put'|secret put|--token|Get-Clipboard|readFileSync\([^)]*JILL-SECRETS|shopify app deploy|wrangler deploy|versions upload|randomBytes|setProperty|customer.*write/i);
console.log('PASS WORK HQ merchant candidate: single newest staged secret, identical code/runtime/bindings, Owner OFF, isolated WORK D1, rollback target pinned, explicit release consent and no secret access.');
