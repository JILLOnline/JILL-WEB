// Phase31 OFFLINE only. Synthetic Cloudflare v33/v34 metadata,
// no Wrangler, provider requests, Shopify, Google, customer data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {prepareWorkHqV34LocalUi}
  from './prepare-work-hq-v34-ui-local.mjs';
import {verifyWorkV34UiReadiness}
  from './inspect-work-hq-v34-ui-readiness.mjs';
import {DETAIL_OFF_CANDIDATE}
  from './release-work-hq-detail-v9-off.mjs';
import {DETAIL_ON_CANDIDATE}
  from './release-work-hq-detail-v9-on.mjs';
import {DETAIL_ON_MARKER}
  from './stage-work-hq-detail-v9-on.mjs';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const baseManifest={
  name:'jill-order-desk-canary-work',
  main:'./index.js',
  compatibility_date:'2026-10-14',
  compatibility_flags:['nodejs_compat'],
  assets:{directory:'../client'},
  d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
    database_name:'jill-order-desk-work',database_id:D1}],
  queues:{producers:[],consumers:[]},
  vars:{JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
    JILL_WORK_OAUTH_ENABLED:'false'},
};
const localCandidate=prepareWorkHqV34LocalUi(baseManifest).candidate;
const originalFlags={...localCandidate.vars};
delete originalFlags.JILL_WORK_HQ_DETAIL_ENABLED;
const secretNames=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const bind=[
  ...secretNames.map(name=>({name,type:'secret_text',
    id:'synthetic-'+name})),
  ...Object.entries(originalFlags).map(([name,text])=>
    ({name,type:'plain_text',text})),
  {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:D1},
];
const runtime={compatibility_date:'2026-10-14',
  assets:{html_handling:'auto-trailing-slash',
    not_found_handling:'none'}};
const resources={bindings:bind,
  script:{etag:'same-synthetic-work-code',handlers:['fetch']},
  script_runtime:runtime};
const baseline={
  id:DETAIL_OFF_CANDIDATE,
  metadata:{created_on:'2026-10-15T23:50:38Z'},
  resources,
};
const candidate={
  id:DETAIL_ON_CANDIDATE,
  annotations:{'workers/message':DETAIL_ON_MARKER},
  metadata:{created_on:'2026-10-16T02:07:45Z'},
  resources:{...structuredClone(resources),
    bindings:[...structuredClone(bind),
      {name:'JILL_WORK_HQ_DETAIL_ENABLED',type:'plain_text',text:'true'}]},
};
const sample={baseManifest,localCandidate,activeVersion:DETAIL_ON_CANDIDATE,
  baseline,candidate,versions:[baseline,candidate]};
let n=0;
const passed=verifyWorkV34UiReadiness(sample);
assert.equal(passed.state,'read_only_work_v34_binding_parity');
for(const key of [
  'local_config_exact','live_binding_names_types_and_flags_match',
  'work_d1_identity_matches','compatibility_date_matches',
])assert.equal(passed[key],true);
for(const key of [
  'local_asset_and_binary_equivalence_verified',
  'local_script_etag_matches_live','live_asset_equivalence_verified',
  'google_qa_source_checked_in_this_run',
  'authenticated_owner_status_mutation_verified',
  'cloudflare_upload_authorized','version_stage_authorized',
  'traffic_switch_authorized','billing_approved','live_keep_touched',
])assert.equal(passed[key],false);
assert.equal(Object.isFrozen(passed),true);
n++;
const reject=payload=>{
  assert.throws(()=>verifyWorkV34UiReadiness(payload),
    /work_hq_v34_ui_parity_/);
  n++;
};
function editCandidate(f){
  const v=structuredClone(candidate);
  f(v);return {...sample,candidate:v};
}
for(const x of [
  {...sample,activeVersion:DETAIL_OFF_CANDIDATE},
  {...sample,versions:[candidate]},
  {...sample,localCandidate:{...localCandidate,
    vars:{...localCandidate.vars,JILL_WORK_OAUTH_ENABLED:'false'}}},
  {...sample,localCandidate:{...localCandidate,r2_buckets:[{
    binding:'ART',bucket_name:'real'}]}},
  {...sample,baseManifest:{...baseManifest,name:'jill-order-desk-work'}},
  {...sample,baseManifest:{...baseManifest,queues:{consumers:[{
    queue:'real'}]}}},
  editCandidate(v=>v.resources.bindings.find(x=>
    x.name==='JILL_WORK_OAUTH_ENABLED').text='false'),
  editCandidate(v=>v.resources.bindings.find(x=>
    x.name==='JILL_ORDER_DESK_WORK_DB').id='wrong-database'),
  editCandidate(v=>v.resources.bindings.find(x=>
    x.name===secretNames[0]).type='plain_text'),
  editCandidate(v=>v.resources.bindings.push({
    name:'UNREVIEWED_BINDING',type:'plain_text',text:'true'})),
  editCandidate(v=>v.resources.bindings.pop()),
  editCandidate(v=>v.resources.script_runtime.compatibility_date=
    '2026-10-15'),
  editCandidate(v=>v.resources.script.handlers=['scheduled']),
  editCandidate(v=>v.resources.script.etag='changed-unreviewed-code'),
])reject(x);
const text=readFileSync(fileURLToPath(new URL(
  './inspect-work-hq-v34-ui-readiness.mjs',import.meta.url)),'utf8');
for(const safe of [
  'workLiveAuditReadArgs','verifyWorkDetailLive',
  'local_asset_and_binary_equivalence_verified:false',
  'cloudflare_upload_authorized:false',
  'version_stage_authorized:false','traffic_switch_authorized:false',
])assert.ok(text.includes(safe),safe);
assert.doesNotMatch(text,/\['versions','upload'|\['versions','deploy'|\br2\.put\(|\bdb\.prepare\(/);
console.log('PASS WORK Phase31 OFFLINE read-only UI v34 candidate parity: '+
  n+' synthetic cases, exact v34 live binding metadata vs local flags/D1; reject code, secret, runtime and source drift; never upload or deploy.');
