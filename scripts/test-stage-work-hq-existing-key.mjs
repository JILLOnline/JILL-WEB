import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  assertStageReady,assertActiveWorkerBinding,wranglerProcessSpec,safeWranglerError,
} from './stage-work-hq-existing-key.mjs';
const workerVersion='49b10c46-8e00-4ef3-8075-74eea29e9c9e';
const manifest={
  name:'jill-order-desk-canary-work',
  compatibility_flags:['nodejs_compat'],
  vars:{
    JILL_WORK_HOST_STAGE:'canary',
    JILL_WORK_OAUTH_ENABLED:'true',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  },
  d1_databases:[{
    binding:'JILL_ORDER_DESK_WORK_DB',
    database_name:'jill-order-desk-work',
    database_id:'3f17c186-c794-4e00-8f20-017191373a19',
  }],
};
const secretList=JSON.stringify([
  {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
  {name:'SHOPIFY_API_SECRET',type:'secret_text'},
]);
const valid={
  branch:'jill/rewards-work',head:'AB',remote:'AB',dirty:'',
  manifest,active:workerVersion,secretList,
};
assert.equal(assertStageReady(valid),true);
for(const changes of [
  {branch:'main'},{head:'X'},{remote:'X'},{dirty:' M app/routes.tsx'},
  {active:'dcd17f20-7b76-4332-8ea2-37fe74931f63'},
  {manifest:{...manifest,name:'jill-live'}},
  {manifest:{...manifest,vars:{...manifest.vars,JILL_WORK_OAUTH_ENABLED:'false'}}},
  {manifest:{...manifest,vars:{...manifest.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}}},
  {manifest:{...manifest,vars:{...manifest.vars,
    JILL_HQ_MERCHANT_READ_SECRET:'DONT_PUT_KEYS_IN_VARS'}}},
  {manifest:{...manifest,d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
    database_id:'LIVE'}]}},
  {secretList:JSON.stringify([
    {name:'JILL_WORK_SESSION_KEY_B64'},
    {name:'SHOPIFY_API_SECRET'},
    {name:'JILL_HQ_MERCHANT_READ_SECRET'},
  ])},
])assert.throws(()=>assertStageReady({...valid,...changes}));
const details=[
  'JILL_WORK_HOST_STAGE ("canary")',
  'JILL_WORK_OWNER_BOOTSTRAP_ENABLED ("false")',
  'JILL_WORK_OAUTH_ENABLED ("true")',
  '3f17c186-c794-4e00-8f20-017191373a19',
  'SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
].join('\n');
assert.equal(assertActiveWorkerBinding(details),true);
for(const line of details.split('\n')) {
  assert.throws(()=>assertActiveWorkerBinding(details.replace(line,'changed')),
    /active_worker_binding_mismatch/);
}
// Wrangler must be launched directly from Node: Windows shell:true
// concatenates multiword argv and breaks the secret put command.
const key='D'.repeat(32);
const message='JILL HQ WORK existing Google QA read key; NOT released';
const argv=[
  'versions','secret','put','JILL_HQ_MERCHANT_READ_SECRET',
  '--name','jill-order-desk-canary-work',
  '--config','C:\\work\\dist\\server\\wrangler.oauth-canary.json',
  '--message',message,
];
const spec=wranglerProcessSpec(argv,{input:key+'\n'});
assert.equal(spec.executable,process.execPath);
assert.match(spec.argv[0],/wrangler[\\\\/]bin[\\\\/]wrangler\\.js$/);
assert.deepEqual(spec.argv.slice(1),argv);
assert.equal(spec.argv.at(-1),message);
assert.equal(spec.options.shell,false);
assert.equal(spec.options.input,key+'\n');
assert.equal(spec.argv.includes(key),false);
assert.equal(spec.argv.join(' ').includes(key),false);
assert.throws(()=>wranglerProcessSpec(['versions',null]));
for(const [sample,expected] of [
  ['Unknown arguments: HQ, WORK','wrangler_invalid_arguments'],
  ['Error 403: insufficient permissions','wrangler_access_denied'],
  ['Could not read file: manifest','wrangler_missing_dependency_or_config'],
  ['ECONNRESET','wrangler_network_failure'],
  ['api error containing private source data','wrangler_failed'],
])assert.equal(safeWranglerError(sample),expected);
const source=readFileSync('scripts/stage-work-hq-existing-key.mjs','utf8');
assert.match(source,/testExistingMerchantSecret\(\{secret:key\}\)/);
assert.match(source,/signed\.ok && signed\.requestCount===2/);
assert.match(source,/validateCopiedExistingKey/);
assert.match(source,/STAGE EXISTING WORK KEY/);
assert.match(source,/versions','secret','put',SECRET_NAME/);
assert.match(source,/--config',CONFIG/);
assert.match(source,/ensure\(deployedVersion\(\)===active,'active_worker_changed_before_staging'\)/);
assert.match(source,/ensure\(deployedVersion\(\)===active,'active_worker_changed_after_staging'\)/);
assert.match(source,/clearClipboardIfStillMatching\(key\)/);
assert.match(source,/wranglerProcessSpec\(args,\{input\}\)/);
assert.match(source,/shell:false/);
assert.doesNotMatch(source,/shell:windows|shell:true|npx\\.cmd/);
assert.doesNotMatch(source,/randomBytes|secret put(?!.*version)|\['secret','put'|versions','deploy'|shopify app deploy|update-deployment|jill-work-owner-commissioning|writeFileSync\(/i);
assert.doesNotMatch(source,/console\.log\(key\)|console\.log\(secret\)|console\.error\(error\)|process\.argv.*key/);
console.log('PASS stage existing 32+ WORK QA key: active version locked, OAuth ON, Owner OFF, WORK D1, existing Shopify secrets, signed source 2 requests, clipboard privacy, inactive version only.');
