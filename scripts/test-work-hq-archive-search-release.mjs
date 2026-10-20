// OFFLINE release contract: no Cloudflare calls, schema or customer writes.
import assert from 'node:assert/strict';
import {ARCHIVE_SEARCH_PROFILE as p} from './release-work-hq-archive-search-owner.mjs';
import {WORKSPACE_LAYOUT_PROFILE as prior}
  from './release-work-hq-workspace-layout-owner.mjs';
import {QUICK_PILL_PROFILE as older}
  from './release-work-hq-quick-pill-owner.mjs';
import {ARCHIVE_SEARCH_RUNTIME_FILES,checkWorkHqArchiveSearchRuntime,
  archiveSearchRuntimeManifest} from './work-hq-archive-search-build.mjs';
import {ARCHIVE_SEARCH_BLOBS}
  from './work-hq-archive-search-package.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {visualBaseline,ownedVisualAllocation}
  from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';

const check=checkWorkHqArchiveSearchRuntime();
assert.equal(check.runtime_files,20);
assert.equal(check.inert_sql_proposal_excluded,true);
assert.equal(check.owner_search_gated,true);
const manifest=archiveSearchRuntimeManifest();
assert.equal(manifest.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual([...ARCHIVE_SEARCH_RUNTIME_FILES].sort(),Object.keys(manifest.files).sort());
assert.equal(Object.keys(ARCHIVE_SEARCH_BLOBS).length,21);
const sql=Object.keys(ARCHIVE_SEARCH_BLOBS).find(f=>f.endsWith('.sql'));
assert.ok(sql);
assert.ok(!(sql in manifest.files),'SQL proposals must NEVER be copied into runtime');
for(const digest of Object.values(manifest.files))assert.match(digest,/^[a-f0-9]{64}$/);
assert.ok(ARCHIVE_SEARCH_RUNTIME_FILES.includes(
  'services/jill-order-desk/app-home/app/routes/app.requests.search.tsx'));
assert.ok(ARCHIVE_SEARCH_RUNTIME_FILES.includes(
  'services/jill-order-desk/work-request-detail-search-action.mjs'));
assert.ok(ARCHIVE_SEARCH_RUNTIME_FILES.includes(
  'services/jill-order-desk/app-home/app/routes.ts'));
assert.equal(p.base,'66738e55-4890-4be1-868d-cc9dde19798d');
assert.equal(p.deployment,'d3df60a1-b715-48e7-a557-cb5af1fda868');
assert.equal(p.baseSource,'782d866944ca9cdef0220fba254f6cd0a30e865a');
assert.equal(p.receiptStem,'work-hq-archive-search-v1');
assert.equal(p.uploadOperation,'HQ_ARCHIVE_SEARCH_V1_INACTIVE_UPLOAD');
assert.equal(p.activationOperation,'HQ_ARCHIVE_SEARCH_V1_ACTIVATE');
assert.equal(p.restoreOperation,'HQ_ARCHIVE_SEARCH_V1_RESTORE');
assert.equal(p.visualOnly,false);
assert.equal(p.guard,checkWorkHqArchiveSearchRuntime);
assert.equal(p.testCommand,'test:work-hq-archive-search-release');
assert.equal(p.checkCommand,'work:hq:archive-search:runtime:check');
assert.equal(p.changeScope,'reviewed_twenty_file_archive_search_server_and_ui_no_schema');
for(const old of [prior,older]){
  for(const key of ['base','deployment','baseSource','receiptStem',
    'uploadOperation','activationOperation','restoreOperation'])
    assert.notEqual(p[key],old[key],'Earlier spent release re-used: '+key);
}
const before={deployment:p.deployment,versions:[
  {id:p.base,percentage:100},{id:HQ_QUOTE,percentage:0}
]};
visualBaseline(before,p);
for(const bad of [
  {...before,deployment:prior.deployment},
  {...before,versions:[{id:prior.base,percentage:100},{id:HQ_QUOTE,percentage:0}]},
  {...before,versions:[{id:p.base,percentage:99},{id:HQ_QUOTE,percentage:1}]},
  {...before,versions:[{id:p.base,percentage:100}]},
])assert.throws(()=>visualBaseline(bad,p));
const attempt={
  candidate:'11111111-2222-4333-8444-555555555555',
  nonce:'22222222-3333-4444-8555-666666666666'};
const activated={deployment:'33333333-4444-4555-8666-777777777777',
  message:p.activate+attempt.nonce,
  versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(activated,attempt,p);
assert.throws(()=>ownedVisualAllocation({...activated,message:'different release'},attempt,p));
ownedVisualAllocation({...activated,message:p.restore+attempt.nonce,
  versions:before.versions},attempt,{...p,restored:true});
console.log('PASS WORK HQ Archive/Search one-use release: 20 reviewed runtime files, approved latest allocation, SQL excluded, old receipts unusable, restored only if owned. OFFLINE.');
