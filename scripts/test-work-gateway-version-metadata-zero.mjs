// OFFLINE ONLY. Strict policy and source safety for the one-use WORK
// original@100% / new-runtime-metadata@0% Cloudflare deployment.
// No Cloudflare, Google, Shopify or customer network requests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORKER,ACTIVE,PREVIOUS,DEPLOYMENT,NEW,UPLOAD_COMMIT,HOST,
  OVERRIDE_HEADER,VERSION_HEADER,PROBE_PARAMETER,
  releaseArguments,overrideValue,metadataProbeUrl,
  verifyNewZeroAllocation,certifyProbe,certifyBaselineHealth,
} from './work-gateway-version-metadata-zero-policy.mjs';
const oldDeployment=[{id:DEPLOYMENT,created_on:'2026-10-17T23:16:13Z',
  versions:[{version_id:ACTIVE,percentage:100},
    {version_id:PREVIOUS,percentage:0}]}];
const deploymentId='11111111-2222-4333-8444-555555555555';
const made=(versions,id=deploymentId,created='2026-10-18T01:00:00Z')=>
  [{id,created_on:created,versions},...oldDeployment];
const good=made([{version_id:ACTIVE,percentage:100},
  {version_id:NEW,percentage:0}]);
const uuid='01234567-89ab-4cde-8123-456789abcdef';
let n=0;
const pass=fn=>{fn();n++;};
const reject=fn=>{assert.throws(fn,/gateway_metadata_zero_|gateway_metadata_upload_/);n++;};
pass(()=>assert.equal(WORKER,'jill-work-custom-orders-qa'));
pass(()=>assert.equal(HOST,'https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev'));
pass(()=>assert.equal(NEW,'9322193f-5e87-4479-88c9-39229dddb5f2'));
pass(()=>assert.equal(UPLOAD_COMMIT,'a4a9840ce83e04dd85f7f2e306cdcdd037b56d6a'));
pass(()=>{
  const args=releaseArguments();
  assert.deepEqual(args.slice(0,4),
    ['versions','deploy',ACTIVE+'@100%',NEW+'@0%']);
  assert.deepEqual(args.slice(4,8),
    ['--name',WORKER,'--config','./wrangler.toml']);
  assert.ok(args.includes('--yes'));
  assert.ok(!args.includes(PREVIOUS+'@0%'));
  assert.ok(Object.isFrozen(args));
});
pass(()=>{
  assert.equal(overrideValue(),WORKER+'="'+NEW+'"');
  assert.equal(OVERRIDE_HEADER,'Cloudflare-Workers-Version-Overrides');
  assert.equal(VERSION_HEADER,'x-jill-work-gateway-version');
  assert.equal(PROBE_PARAMETER,'jill_work_version_probe');
  assert.equal(metadataProbeUrl(uuid),HOST+'/healthz?'+PROBE_PARAMETER+'='+uuid);
});
for(const val of ['not-uuid',undefined,'','../admin',uuid+'?x=1'])
  reject(()=>metadataProbeUrl(val));
pass(()=>{
  const r=verifyNewZeroAllocation(good);
  assert.equal(r.deployment_id,deploymentId);
  assert.equal(r.original_pct,100);
  assert.equal(r.metadata_pct,0);
});
pass(()=>assert.equal(verifyNewZeroAllocation({deployments:good}).deployment_id,
  deploymentId));
pass(()=>assert.equal(verifyNewZeroAllocation({result:{deployments:good}}).deployment_id,
  deploymentId));
for(const bad of [
  null,[],[{}],oldDeployment,
  made([{version_id:ACTIVE,percentage:100},{version_id:PREVIOUS,percentage:0}]),
  made([{version_id:ACTIVE,percentage:99},{version_id:NEW,percentage:1}]),
  made([{version_id:ACTIVE,percentage:0},{version_id:NEW,percentage:100}]),
  made([{version_id:ACTIVE,percentage:100}]),
  made([{version_id:NEW,percentage:100}]),
  made([{version_id:ACTIVE,percentage:100},{version_id:NEW,percentage:0},
    {version_id:PREVIOUS,percentage:0}]),
  made([{version_id:ACTIVE,percentage:100},{version_id:ACTIVE,percentage:0}]),
  made([{version_id:ACTIVE,percentage:'100'},{version_id:NEW,percentage:0}]),
  made([{version_id:ACTIVE,percentage:50},{version_id:NEW,percentage:0}]),
  made([{version_id:ACTIVE,percentage:100},{version_id:NEW,percentage:0}],DEPLOYMENT),
  made([{version_id:ACTIVE,percentage:100},{version_id:NEW,percentage:0}],deploymentId,
    '2026-10-17T20:00:00Z'),
  [good[0],{...oldDeployment[0],created_on:good[0].created_on}],
])reject(()=>verifyNewZeroAllocation(bad));
const healthy={
  status:200,mime:'application/json',
  body:{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'},
  versionHeader:NEW,redirect:null,cacheControl:'no-store',
};
pass(()=>{
  const p=certifyProbe(healthy);
  assert.equal(p.version_executed,NEW);
  assert.equal(p.google_hmac_verified,false);
  assert.equal(p.customer_order_submitted,false);
});
pass(()=>assert.equal(certifyBaselineHealth({...healthy,versionHeader:null}),true));
for(const diff of [
  {versionHeader:null},{versionHeader:ACTIVE},
  {versionHeader:PREVIOUS},{versionHeader:'not-a-version'},
  {status:503},{status:302},{mime:'text/html'},
  {body:{ok:true,environment:'LIVE'}},
  {body:{ok:true,environment:'WORK_CUSTOM_ORDERS_QA',secret:'x'}},
  {body:{ok:false,environment:'WORK_CUSTOM_ORDERS_QA'}},
  {redirect:'https://jillonlinestore.com'},
  {cacheControl:null},{cacheControl:'public, max-age=60'},
])reject(()=>certifyProbe({...healthy,...diff}));
for(const diff of [
  {versionHeader:NEW},{redirect:'https://example.invalid/'},
  {cacheControl:null},{status:503},{body:{ok:false}},
])reject(()=>certifyBaselineHealth({...healthy,versionHeader:null,...diff}));
const script=readFileSync(new URL(
  './deploy-work-gateway-version-metadata-zero-owner.mjs',import.meta.url),'utf8');
for(const token of [
  "process.platform==='win32'",
  "git('status','--porcelain','--untracked-files=no')",
  "git('diff','--name-only',UPLOAD_COMMIT,'HEAD'",
  "exactManifest(",
  "preflight()",
  "exactNewVersion(",
  "inspectNewInactiveVersion(",
  "certifyBaselineHealth(await health())",
  "cli([...releaseArguments(),'--dry-run']",
  "consumeOnce(receipt,currentCommit)",
  "fs.openSync(file,'wx'",
  "cli(releaseArguments(),{timeout:120000})",
  "verifyNewZeroAllocation(json(commands.deployments))",
  "certifyProbe(await health({pinned:true}))",
  "activeStatus()===ACTIVE",
  "randomUUID()",
  "redirect:'manual'",
  "method:'GET'",
  "credentials:'omit'",
  "ONE-TIME APPROVAL SPENT",
  "DO NOT RETRY",
  "No automatic rollback",
]){
  assert.ok(script.includes(token),'Missing exact safety gate: '+token);
  n++;
}
for(const illegal of [
  /['"]versions['"],['"]upload['"]/,
  /['"]secret['"],['"]put['"]/,
  /['"]d1['"],['"]execute['"]/,
  /['"]r2['"],/,
  /method:['"]POST['"]/,
  /fetch\(['"]https:\/\/script\.google/,
  /console\.log\(\s*secret/,
  /['"]versions['"],['"]deploy['"],PREVIOUS/,
  /restore\(\)/,
]){
  assert.doesNotMatch(script,illegal);
  n++;
}
console.log('PASS WORK metadata 0% release OFFLINE: '+n+
  ' immutable candidate, 100% original, exact 0% version, independent runtime header and one-use no-retry deployment guards.');
console.log('HOLD: Cloudflare version deployment NOT executed. Requires a NEW explicit Owner approval.');
