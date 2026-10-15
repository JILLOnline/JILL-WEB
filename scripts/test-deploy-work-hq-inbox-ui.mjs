import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertVersionBindings,selectUiVersion,assertReleaseReady}
  from './deploy-work-hq-inbox-ui.mjs';

const ACTIVE='76eda941-abcf-4838-a147-b5450a7c1148';
const NEXT='f8e64049-8e2d-42a4-b1db-7dc616edc520';
const MSG='JILL HQ WORK Custom Orders inbox UI v1; read-only release';
const db='3f17c186-c794-4e00-8f20-017191373a19';
const bindings=[
  {name:'JILL_WORK_HOST_STAGE',type:'plain_text',text:'canary'},
  {name:'JILL_WORK_OAUTH_ENABLED',type:'plain_text',text:'true'},
  {name:'JILL_WORK_OWNER_BOOTSTRAP_ENABLED',type:'plain_text',text:'false'},
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:db},
  {name:'SHOPIFY_API_SECRET',type:'secret_text'},
  {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
  {name:'JILL_HQ_MERCHANT_READ_SECRET',type:'secret_text'},
];
const active={
  id:ACTIVE,metadata:{created_on:'2026-10-15T00:01:00.000Z'},
  resources:{
    script:{etag:'old_code_hash',handlers:['fetch']},
    bindings,
    script_runtime:{
      compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
      usage_model:'standard',assets:{binding:'ASSETS',run_worker_first:true},
    },
  },
};
const candidate=structuredClone(active);
candidate.id=NEXT;
candidate.metadata.created_on='2026-10-15T14:10:00.000Z';
candidate.resources.script.etag='new_code_hash';
candidate.resources.script_runtime.assets={
  binding:'ASSETS',run_worker_first:true,
  html_handling:'auto-trailing-slash',
  not_found_handling:'none',
};
candidate.annotations={'workers/message':MSG};
assert.deepEqual(assertVersionBindings(active,candidate),{
  candidateId:NEXT,activeId:ACTIVE,
});
assert.equal(selectUiVersion([active,candidate],active),NEXT);
assert.equal(selectUiVersion([candidate,active],active),NEXT);
assert.throws(()=>selectUiVersion([active],active),/invalid_version_list/);
assert.throws(()=>selectUiVersion([active,
  {...candidate,annotations:{'workers/message':'wrong'}}],active),
  /missing_or_duplicate_ui_version/);
assert.throws(()=>selectUiVersion([active,candidate,candidate],active),
  /missing_or_duplicate_ui_version/);
assert.throws(()=>selectUiVersion([active,candidate,
  {id:'another',metadata:{created_on:'2026-10-15T15:00:00Z'}}],active),
  /newer_unknown_cloudflare_version/);
const options={
  branch:'jill/rewards-work',head:'sha',remote:'sha',dirty:'',
  activeVersion:ACTIVE,
  secrets:['SHOPIFY_API_SECRET','JILL_HQ_MERCHANT_READ_SECRET','JILL_WORK_SESSION_KEY_B64'],
};
assert.equal(assertReleaseReady(options),true);
for(const bad of [
  {branch:'main'},{head:'other'},{remote:'other'},{dirty:' M app.requests.tsx'},
  {activeVersion:'old'},
  {secrets:['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64']},
  {secrets:[]},
])assert.throws(()=>assertReleaseReady({...options,...bad}));
for(const mutate of [
  v=>{v.id='not expected';},
  v=>{v.resources.script.etag='old_code_hash';},
  v=>{v.resources.script.handlers=['scheduled'];},
  v=>{v.resources.script_runtime.compatibility_flags=[];},
  v=>{v.resources.script_runtime.assets.run_worker_first=false;},
  v=>{v.resources.script_runtime.assets.html_handling='none';},
  v=>{v.resources.script_runtime.assets.not_found_handling='single-page-application';},
  v=>{v.resources.bindings.find(b=>b.name==='JILL_WORK_OAUTH_ENABLED').text='false';},
  v=>{v.resources.bindings.find(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED').text='true';},
  v=>{v.resources.bindings.find(b=>b.name==='JILL_ORDER_DESK_WORK_DB').id='LIVE';},
  v=>{v.resources.bindings.find(b=>b.name==='JILL_HQ_MERCHANT_READ_SECRET').type='plain_text';},
  v=>{v.resources.bindings.pop();},
  v=>{v.resources.bindings.push({name:'EXTRA_ACCESS',type:'secret_text'});},
]){
  const wrong=structuredClone(candidate);mutate(wrong);
  assert.throws(()=>assertVersionBindings(active,wrong));
}
const source=readFileSync('scripts/deploy-work-hq-inbox-ui.mjs','utf8');
for(const phrase of [
  "versions','upload","versions','deploy",
  "RELEASE JILL HQ WORK UI",
  "work:hq:ui","test:work-merchant-inbox","test:work-hq-inbox-ui",
  "writeOAuthManifest","assertWorkHqInboxManifest",
  "test:workerd-oauth",
  "assertHttp('/app/requests','denied')",
  "assertHttp('/app/setup-owner',410)",
])if(phrase!=="work:hq:ui")assert.ok(source.includes(phrase),phrase);
assert.match(source,/shell:false/);
assert.doesNotMatch(source,/Get-Clipboard|JILL-SECRETS\.txt|secret put|secret delete|console\.log\(secret|shopify app deploy|scriptProperties\.setProperty/i);
console.log('PASS JILL HQ WORK UI rollout: 3 preserved secrets, read-only canonical source, changed UI only, WORK D1, Owner OFF, OAuth ON, static asset routing and typed release gate.');
