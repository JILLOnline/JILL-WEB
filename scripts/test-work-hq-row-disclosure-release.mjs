// Offline assertions for one-use WORK Requests layout release profile.
import assert from 'node:assert/strict';
import {ROW_DISCLOSURE_PROFILE as current} from './release-work-hq-row-disclosure-owner.mjs';
import {TABLE_ROWS_PROFILE as last} from './release-work-hq-table-rows-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';
import {visualBaseline,ownedVisualAllocation}
  from './release-work-hq-visual-theme-owner.mjs';
import {reviewedRowRuntime,prepareRowDisclosureBuild}
  from './work-hq-row-disclosure-runtime-build.mjs';
const runtime=reviewedRowRuntime();
assert.equal(runtime.runtime_files,20);
assert.equal(runtime.changed_files.length,4);
assert.equal(runtime.catalog_messaging_quote_backend_from_HEAD_excluded,true);
assert.equal(runtime.customer_app_and_theme_excluded,true);
assert.equal(current.base,'f224e8f5-3919-45e3-8fb6-bf85f6e482f5');
assert.equal(current.deployment,'eb8c1ed6-2f03-4f9e-b0da-9b865ecb2bae');
assert.equal(current.baseSource,'e286e751a8c4e8345b89201fee167a43c5fd398f');
assert.equal(current.guard,reviewedRowRuntime);
assert.equal(current.prepareBuild,prepareRowDisclosureBuild);
assert.equal(current.visualOnly,false);
for(const field of ['base','deployment','baseSource','receiptStem',
  'uploadOperation','activationOperation','restoreOperation']){
  assert.notEqual(current[field],last[field],'Spent historical release identity');
}
const baseline={deployment:current.deployment,versions:[
  {id:current.base,percentage:100},{id:HQ_QUOTE,percentage:0},
]};
visualBaseline(baseline,current);
assert.throws(()=>visualBaseline({...baseline,deployment:last.deployment},current));
assert.throws(()=>visualBaseline({...baseline,versions:[
  {id:current.base,percentage:99},{id:HQ_QUOTE,percentage:1}]},current));
const attempt={
  candidate:'11111111-2222-4333-8444-555555555555',
  nonce:'22222222-3333-4444-8555-666666666666'
};
const active={deployment:'33333333-4444-4555-8666-777777777777',
  message:current.activate+attempt.nonce,
  versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(active,attempt,current);
assert.throws(()=>ownedVisualAllocation({...active,message:'foreign'},attempt,current));
ownedVisualAllocation({...active,message:current.restore+attempt.nonce,
  versions:baseline.versions},attempt,{...current,restored:true});
console.log('PASS WORK Requests-only release identity, pinned allocation, unique receipts, restoration, and excluded unreleased backend (OFFLINE).');
