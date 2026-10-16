// Phase 30: LOCAL manifest only. No Cloudflare, Shopify, Google API,
// Wrangler upload, Worker deployment or customer data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {prepareWorkHqV34LocalUi as build}
  from './prepare-work-hq-v34-ui-local.mjs';

const D1='3f17c186-c794-4e00-8f20-017191373a19';
const source={
  name:'jill-order-desk-canary-work',
  main:'./index.js',
  compatibility_flags:['nodejs_compat'],
  assets:{directory:'../client',binding:'ASSETS'},
  d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
    database_name:'jill-order-desk-work',database_id:D1}],
  vars:{JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
    JILL_WORK_OAUTH_ENABLED:'false'},
};
let count=0;
function reject(x){
  assert.throws(()=>build(x),/work_hq_v34_local_ui_/);
  count++;
}
const data=build(source);
assert.equal(data.local_manifest_only,true);
assert.equal(data.active_version_expected,
  '4973b74d-d479-41da-897c-e36129303279');
assert.equal(data.expected_fallback_version,
  '204d66c3-3296-430d-8288-39c354876600');
for(const field of [
  'provider_binding_parity_verified',
  'deployed_code_equivalence_verified',
  'rollback_simulated','actual_google_source_queried',
  'cloudflare_version_uploaded','deployment_authorized',
  'customer_mutation_authorized','storage_activation_authorized',
])assert.equal(data[field],false,field);
const candidate=data.candidate;
assert.deepEqual(candidate.d1_databases,source.d1_databases);
assert.deepEqual(Object.keys(candidate.vars).sort(),[
  'JILL_WORK_HOST_STAGE','JILL_WORK_HQ_DETAIL_ENABLED',
  'JILL_WORK_MERCHANT_WRITES_ENABLED',
  'JILL_WORK_OAUTH_ENABLED','JILL_WORK_OWNER_BOOTSTRAP_ENABLED',
].sort());
assert.equal(candidate.vars.JILL_WORK_HOST_STAGE,'canary');
assert.equal(candidate.vars.JILL_WORK_HQ_DETAIL_ENABLED,'true');
assert.equal(candidate.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
assert.equal(candidate.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(candidate.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
assert.equal(candidate.r2_buckets,undefined);
assert.equal(candidate.images,undefined);
assert.equal(candidate.queues,undefined);
assert.equal(candidate.vars.JILL_WORK_INTAKE_LEDGER_ENABLED,undefined);
assert.equal(candidate.vars.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED,undefined);
assert.equal(candidate.vars.SHOPIFY_API_SECRET,undefined);
assert.equal(candidate.vars.JILL_HQ_MERCHANT_READ_SECRET,undefined);
assert.equal(candidate.vars.JILL_HQ_MERCHANT_WRITE_SECRET,undefined);
assert.equal(candidate.vars.JILL_WORK_SESSION_KEY_B64,undefined);
assert.equal(source.vars.JILL_WORK_OAUTH_ENABLED,'false');
assert.equal(source.vars.JILL_WORK_HQ_DETAIL_ENABLED,undefined);
assert.equal(source.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,undefined);
count++;
for(const modified of [
  null,undefined,[],{},'string',
  {...source,name:'jill-order-desk-live'},
  {...source,vars:{...source.vars,JILL_WORK_HOST_STAGE:'live'}},
  {...source,vars:{...source.vars,JILL_WORK_OAUTH_ENABLED:'true'}},
  {...source,vars:{...source.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
  {...source,vars:{...source.vars,JILL_WORK_HQ_DETAIL_ENABLED:'true'}},
  {...source,vars:{...source.vars,JILL_WORK_MERCHANT_WRITES_ENABLED:'true'}},
  {...source,vars:{...source.vars,JILL_WORK_INTAKE_LEDGER_ENABLED:'true'}},
  {...source,vars:{...source.vars,JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED:'true'}},
  {...source,vars:{...source.vars,SHOPIFY_API_SECRET:'not_a_secret'}},
  {...source,d1_databases:[{...source.d1_databases[0],
    database_id:'00000000-0000-4000-8000-000000000019'}]},
  {...source,d1_databases:[{...source.d1_databases[0],
    database_name:'jill-order-desk-live'}]},
  {...source,d1_databases:[]},
  {...source,d1_databases:[source.d1_databases[0],
    source.d1_databases[0]]},
  {...source,r2_buckets:[{binding:'WORK_ART',bucket_name:'fake'}]},
  {...source,r2_buckets:[]},
  {...source,images:{binding:'IMAGES'}},
  {...source,queues:[]},
  {...source,services:[]},
  {...source,kv_namespaces:[]},
  {...source,unsafe:{}},
  {...source,routes:['*/*']},
  {...source,main:''},
  {...source,compatibility_flags:[]},
])reject(modified);
const raw=readFileSync(fileURLToPath(new URL(
  './prepare-work-hq-v34-ui-local.mjs',import.meta.url)),'utf8');
for(const marker of [
  'prepareOAuthManifest',
  'prepareWorkDetailOnManifest',
  'describeWorkReference(id)',
  'wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json',
  'cloudflare_version_uploaded:false',
  'NOUPLOAD',
])assert.ok(raw.includes(marker),marker);
assert.doesNotMatch(raw,
  /\[\s*['"]versions['"]\s*,\s*['"]upload['"]|\[\s*['"]versions['"]\s*,\s*['"]deploy['"]|\[\s*['"]deploy['"]|\[\s*['"]d1['"]|\br2\.put\(/);
console.log('PASS WORK Phase 30 LOCAL UI v34 candidate policy: '+count+
  ' accepted/rejected hypothetical manifests; exact OAuth ON, Owner OFF, writes ON, detail ON, pinned D1; no R2, Images, secret plaintext, Cloudflare upload or live changes.');
